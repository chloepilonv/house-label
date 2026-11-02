/**
 * Native Google Sheets via the Sheets API. Drive's CSV conversion yields one
 * tab, and cross-file lookups (IMPORTRANGE) break, so multi-tab files need this.
 * Nothing here overwrites a typed cell, except `replaceRows` on output tabs.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { gapi } from "./api";
import { frozenColumns, groupRow, headerRows, targetTitle, type HeaderGroup } from "./credits-sheet";

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const FILES = "https://www.googleapis.com/drive/v3/files";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";

/** A1 notation with the tab name quoted, e.g. `'â­ SONG_CREDITS'!A1`. Empty `ref` = whole tab. */
export const a1 = (tab: string, ref = ""): string => `'${tab.replace(/'/g, "''")}'${ref ? `!${ref}` : ""}`;

/** Drive's query language has no escape sequence but the doubled quote. */
const quote = (s: string) => s.replace(/'/g, "\\'");

export interface SheetTab {
  title: string;
  headers: string[];
  /** Merged group cells written ABOVE the header, pushing it to row 2. Optional. */
  groups?: HeaderGroup[];
  /** Written under the header, in the same order. Optional. */
  rows?: string[][];
}

/** What `styleSheet` needs per tab: the header width, the note, the grey columns. */
export interface StyledTab {
  title: string;
  headers: string[];
  /** The group row above the header, when the tab has one — merged and centred. */
  groups?: HeaderGroup[];
  /** Becomes the note on A1 — the tab explains itself on hover. */
  purpose: string;
  /** Column indexes to grey out below the header: database ids. */
  systemColumns?: number[];
}

export interface EnsuredSheet {
  id: string;
  url: string;
  /** False when the file was already there — nothing was written. */
  created: boolean;
}

/** The spreadsheet with these tabs in this folder. Find-or-create by name, like `ensurePath`. */
export async function ensureSpreadsheet(opts: {
  folderId: string;
  name: string;
  tabs: SheetTab[];
}): Promise<EnsuredSheet> {
  const existing = await findInFolder(opts.folderId, opts.name);
  if (existing) return { id: existing, url: sheetUrl(existing), created: false };

  // All tabs at once, so no default "Sheet1" is left behind.
  const made = await gapi<{ spreadsheetId: string }>("creating the spreadsheet", SHEETS, {
    method: "POST",
    json: {
      properties: { title: opts.name },
      sheets: opts.tabs.map((tab, index) => ({
        properties: {
          title: tab.title,
          index,
          // Freeze the header row and first two columns for hand editing.
          gridProperties: { frozenRowCount: headerRows(tab), frozenColumnCount: frozenColumns(tab) },
        },
      })),
    },
  });
  const id = made.spreadsheetId;

  // The Sheets API creates in My Drive's root; Drive then moves it.
  await gapi("filing the spreadsheet", `${FILES}/${id}?addParents=${opts.folderId}&removeParents=root&fields=id`, {
    method: "PATCH",
    json: {},
  });

  await gapi(
    "writing the headers",
    `${SHEETS}/${id}/values:batchUpdate`,
    {
      method: "POST",
      json: {
        // RAW, so values like `+1` or date-shaped ids are not reinterpreted.
        valueInputOption: "RAW",
        data: opts.tabs.map((tab) => ({
          range: a1(tab.title, "A1"),
          values: [...(tab.groups ? [groupRow(tab.groups)] : []), tab.headers, ...(tab.rows ?? [])],
        })),
      },
    },
  );

  return { id, url: sheetUrl(id), created: true };
}

/** The spreadsheet of this name already in this folder, or null. */
export async function findInFolder(folderId: string, name: string): Promise<string | null> {
  const q = encodeURIComponent(
    `mimeType = '${SHEET_MIME}' and name = '${quote(name)}' and '${folderId}' in parents and trashed = false`,
  );
  const { files } = await gapi<{ files?: { id: string }[] }>(
    "the spreadsheet lookup",
    `${FILES}?q=${q}&fields=files(id)&pageSize=1`,
  );
  return files?.[0]?.id ?? null;
}

/** Every row of one tab, header included, as it stands right now. */
export async function readTab(spreadsheetId: string, tab: string): Promise<string[][]> {
  const { values } = await gapi<{ values?: string[][] }>(
    `reading ${tab}`,
    `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(a1(tab))}`,
  );
  return values ?? [];
}

/** Rows appended under what is already in the tab. Never overwrites. */
export async function appendRows(spreadsheetId: string, tab: string, rows: string[][]): Promise<number> {
  if (!rows.length) return 0;
  await gapi(
    `appending to ${tab}`,
    `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(a1(tab))}:append` +
      `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", json: { values: rows } },
  );
  return rows.length;
}

/**
 * All data rows of a tab replaced, header kept. The only overwriting writer,
 * for output tabs like the budget's EXPECTED. Never use on a tab people fill.
 */
export async function replaceRows(spreadsheetId: string, tab: string, rows: string[][]): Promise<number> {
  const range = encodeURIComponent(a1(tab, "A2:Z"));
  await gapi(`clearing ${tab}`, `${SHEETS}/${spreadsheetId}/values/${range}:clear`, { method: "POST", json: {} });
  if (!rows.length) return 0;
  await gapi(
    `rewriting ${tab}`,
    `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(a1(tab, "A2"))}?valueInputOption=RAW`,
    { method: "PUT", json: { values: rows } },
  );
  return rows.length;
}

export const sheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

/** What `reconcileTabs` did to one spreadsheet, for the report the artist reads. */
export interface ReconcileReport {
  renamed: { from: string; to: string }[];
  added: string[];
  /** Header rewritten on a tab that had no data rows, or our own rows replaced. */
  rewritten: string[];
  deleted: string[];
  /** Left alone, with the reason — always because a person typed in it. */
  kept: { title: string; reason: string }[];
}

const HEADER_ROWS_OF = (t: SheetTab) => [...(t.groups ? [groupRow(t.groups)] : []), t.headers];
const nonEmpty = (r: string[]) => r.some((c) => (c ?? "").trim() !== "");

/**
 * An existing spreadsheet brought to the current spec without losing a typed
 * cell. Handles older specs and hand-renamed tabs.
 *
 * In order:
 *   1. rename — a tab whose title resolves (`targetTitle`) to a spec tab is
 *      renamed, which keeps its sheet id, its rows and every link to it
 *   2. add — a spec tab nobody has, with its header, group row and rows
 *   3. rewrite — a spec tab with NO data rows gets the current header; a tab
 *      that ships rows (GLOSSARY) is ours and is rewritten every time
 *   4. delete — a tab that is neither spec nor legacy, and holds no data row
 *   5. order — spec tabs in spec order
 *
 * A tab with data rows and a stale header is kept and reported, since a new
 * header would silently change what its rows mean.
 */
export async function reconcileTabs(spreadsheetId: string, tabs: SheetTab[]): Promise<ReconcileReport> {
  const report: ReconcileReport = { renamed: [], added: [], rewritten: [], deleted: [], kept: [] };
  const meta = await gapi<{ sheets?: { properties: { sheetId: number; title: string } }[] }>(
    "reading the tabs",
    `${SHEETS}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
  );
  const existing = (meta.sheets ?? []).map((s) => ({ id: s.properties.sheetId, title: s.properties.title }));
  const specOf = new Map(tabs.map((t) => [t.title, t]));

  // 1. rename — one tab per target; if two claim the same one, both stay.
  const claims = new Map<string, typeof existing>();
  for (const s of existing) {
    const target = targetTitle(s.title);
    if (!target || !specOf.has(target)) continue;
    claims.set(target, [...(claims.get(target) ?? []), s]);
  }
  const requests: unknown[] = [];
  const titleOf = new Map(existing.map((s) => [s.id, s.title]));
  for (const [target, claimants] of claims) {
    if (claimants.length > 1) {
      for (const s of claimants)
        if (s.title !== target) report.kept.push({ title: s.title, reason: `two tabs stand for ${target}` });
      continue;
    }
    const [s] = claimants;
    if (s.title === target) continue;
    requests.push({ updateSheetProperties: { properties: { sheetId: s.id, title: target }, fields: "title" } });
    titleOf.set(s.id, target);
    report.renamed.push({ from: s.title, to: target });
  }
  if (requests.length) {
    await gapi("renaming tabs", `${SHEETS}/${spreadsheetId}:batchUpdate`, { method: "POST", json: { requests } });
    requests.length = 0;
  }
  const byTitle = new Map([...titleOf].map(([id, title]) => [title, id]));

  // 2. add
  const missing = tabs.filter((t) => !byTitle.has(t.title));
  if (missing.length) {
    const made = await gapi<{ replies?: { addSheet?: { properties: { sheetId: number } } }[] }>(
      "adding tabs",
      `${SHEETS}/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        json: {
          requests: missing.map((t) => ({
            addSheet: {
              properties: {
                title: t.title,
                gridProperties: { frozenRowCount: headerRows(t), frozenColumnCount: frozenColumns(t) },
              },
            },
          })),
        },
      },
    );
    (made.replies ?? []).forEach((r, i) => {
      if (r.addSheet) byTitle.set(missing[i].title, r.addSheet.properties.sheetId);
    });
    await gapi("writing the new headers", `${SHEETS}/${spreadsheetId}/values:batchUpdate`, {
      method: "POST",
      json: {
        valueInputOption: "RAW",
        data: missing.map((t) => ({ range: a1(t.title, "A1"), values: [...HEADER_ROWS_OF(t), ...(t.rows ?? [])] })),
      },
    });
    report.added.push(...missing.map((t) => t.title));
  }

  // 3. rewrite — only where no person has typed a row.
  for (const t of tabs) {
    if (report.added.includes(t.title)) continue;
    const all = await readTab(spreadsheetId, t.title);
    const hr = headerRows(t);
    const want = HEADER_ROWS_OF(t);
    // Sheets drops trailing blank cells on read, so the group row comes back one
    // short: compare cell by cell, blank against missing.
    const sameHeader = want.every((row, i) => row.every((c, j) => c === ((all[i] ?? [])[j] ?? "")) && (all[i] ?? []).length <= row.length);
    const data = all.slice(hr).filter(nonEmpty);
    if (t.rows) {
      // Ours, never the artist's: rewritten whole, so the words match the labels.
      const sameRows = data.length === t.rows.length && data.every((r, i) => r.join("\t") === t.rows![i].join("\t"));
      if (sameHeader && sameRows) continue;
    } else if (data.length) {
      if (!sameHeader) report.kept.push({ title: t.title, reason: `${data.length} row(s) under an older header` });
      continue;
    } else if (sameHeader) continue;
    await gapi(`clearing ${t.title}`, `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(a1(t.title))}:clear`, { method: "POST", json: {} });
    await gapi(`rewriting ${t.title}`, `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(a1(t.title, "A1"))}?valueInputOption=RAW`, {
      method: "PUT",
      json: { values: [...want, ...(t.rows ?? [])] },
    });
    report.rewritten.push(t.title);
  }

  // 4. delete — strangers and retired tabs, only when empty.
  for (const [title, id] of byTitle) {
    if (specOf.has(title)) continue;
    const all = await readTab(spreadsheetId, title);
    const data = all.slice(1).filter(nonEmpty);
    if (data.length) {
      report.kept.push({ title, reason: `${data.length} row(s) — not in the current sheet, move them by hand` });
      continue;
    }
    requests.push({ deleteSheet: { sheetId: id } });
    report.deleted.push(title);
  }

  // 5. order
  tabs.forEach((t, index) => {
    const id = byTitle.get(t.title);
    if (id != null) requests.push({ updateSheetProperties: { properties: { sheetId: id, index }, fields: "index" } });
  });
  if (requests.length)
    await gapi("ordering the tabs", `${SHEETS}/${spreadsheetId}:batchUpdate`, { method: "POST", json: { requests } });

  return report;
}

/**
 * Human-readable formatting: bold frozen header, note on A1, greyed id
 * columns, readable widths. Formatting only and idempotent, so safe to re-run
 * on a filled sheet.
 */
export async function styleSheet(spreadsheetId: string, tabs: StyledTab[]): Promise<void> {
  const meta = await gapi<{ sheets?: { properties: { sheetId: number; title: string } }[] }>(
    "reading the tabs",
    `${SHEETS}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
  );
  const idOf = new Map((meta.sheets ?? []).map((x) => [x.properties.title, x.properties.sheetId]));

  const HEADER_FILL = { red: 0.16, green: 0.22, blue: 0.31 };
  const WHITE = { red: 1, green: 1, blue: 1 };
  const GREY = { red: 0.62, green: 0.62, blue: 0.62 };

  const requests: unknown[] = [];
  for (const t of tabs) {
    const sheetId = idOf.get(t.title);
    if (sheetId == null) continue;
    const width = t.headers.length;
    const hr = headerRows(t);

    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: hr, startColumnIndex: 0, endColumnIndex: width },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_FILL,
            textFormat: { bold: true, foregroundColor: WHITE },
            wrapStrategy: "WRAP",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment)",
      },
    });
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: hr, frozenColumnCount: frozenColumns(t) } },
        fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
      },
    });
    // Unmerge first so a re-run does not fail on an existing merge.
    if (t.groups) {
      requests.push({ unmergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: width } } });
      let col = 0;
      for (const g of t.groups) {
        if (g.span > 1) {
          requests.push({
            mergeCells: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: col, endColumnIndex: col + g.span },
              mergeType: "MERGE_ALL",
            },
          });
        }
        col += g.span;
      }
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: width },
          cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
          fields: "userEnteredFormat.horizontalAlignment",
        },
      });
    }
    requests.push({
      updateCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
        rows: [{ values: [{ note: t.purpose }] }],
        fields: "note",
      },
    });
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: width },
        properties: { pixelSize: 180 },
        fields: "pixelSize",
      },
    });
    for (const col of t.systemColumns ?? []) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: hr, startColumnIndex: col, endColumnIndex: col + 1 },
          cell: { userEnteredFormat: { textFormat: { foregroundColor: GREY, italic: true } } },
          fields: "userEnteredFormat.textFormat",
        },
      });
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: "COLUMNS", startIndex: col, endIndex: col + 1 },
          properties: { pixelSize: 120 },
          fields: "pixelSize",
        },
      });
    }
  }
  if (!requests.length) return;
  await gapi("styling the sheet", `${SHEETS}/${spreadsheetId}:batchUpdate`, { method: "POST", json: { requests } });
}

/**
 * Rewrite a tab's header (row 1, or group row + row 2). Only safe on a tab
 * with no data rows; the caller checks, this does not.
 */
export async function writeHeader(spreadsheetId: string, tab: SheetTab): Promise<void> {
  await gapi(
    `rewriting the header of ${tab.title}`,
    `${SHEETS}/${spreadsheetId}/values/${encodeURIComponent(a1(tab.title, "A1"))}?valueInputOption=RAW`,
    { method: "PUT", json: { values: [...(tab.groups ? [groupRow(tab.groups)] : []), tab.headers] } },
  );
}

