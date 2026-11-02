/**
 * The Plan sheet: one Google Sheet in the release folder where the artist ticks
 * tasks off (Date · Action · Agent · Status · Source, plus a hidden key). A
 * sheet, not a local page, so the Monday email opens it on a phone. Its Status
 * wins both ways and is read back before rows are rewritten; the database is
 * never written from here.
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Lang } from "../../manager-plan-release/scripts/milestones";
import { DAY, iso, type Item, type Project } from "./items";

const TAB = "Plan";
export const HEADERS = { en: ["Date", "Action", "Agent", "Status", "Source", "Key — don't edit"], fr: ["Date", "Action", "Agent", "Statut", "Source", "Clé — ne pas modifier"] };
export const STATUSES = ["To do", "Done", "Won't do"] as const;
const STATUS_COL = 3;
const KEY_COL = 5;

/** The department folder that owns a step; "label-manager" when none does. */
export const agentOf = (owner: string): string => (!owner || owner === "you" ? "label-manager" : owner);

export interface PlanSheet {
  url: string;
  rows: number;
}

export const sheetName = (project: Project): string => `Plan — ${project.title}`;

/** The rows, in date order. Pure, so it is tested. `status` is already reconciled. */
export function sheetRows(items: Item[]): string[][] {
  return [...items]
    .sort((a, b) => +a.due - +b.due)
    .map((i) => [
      iso(i.due),
      i.title,
      agentOf(i.owner),
      i.status === "Won't do" ? "Won't do" : i.done ? "Done" : "To do",
      i.link ?? "",
      i.key,
    ]);
}

/** Apply what the artist set in the sheet to the list. Mutates `items`. */
export function applyStatuses(items: Item[], existing: string[][], keyHeader: string): void {
  const head = existing[0] ?? [];
  const keyCol = head.indexOf(keyHeader);
  // Found by name: a sheet written before the columns changed has Status first.
  const stCol = Math.max(0, head.findIndex((h) => /^(Status|Statut)$/.test(h)));
  const chosen = new Map(existing.slice(1).map((r) => {
    const st = r[stCol];
    return [r[keyCol >= 0 ? keyCol : r.length - 1], st === "TRUE" ? "Done" : st === "FALSE" ? "To do" : st] as const;
  }));
  for (const i of items) {
    const st = chosen.get(i.key);
    if (st && (STATUSES as readonly string[]).includes(st)) {
      i.status = st;
      i.done = st === "Done";
    } else i.status = i.status ?? (i.done ? "Done" : "To do");
  }
}

export async function syncPlanSheet(project: Project, items: Item[], lang: Lang): Promise<PlanSheet | null> {
  if (!project.driveFolderId) return null;
  const { ensureSpreadsheet, readTab } = await import("../../../../../engine/google/sheets");
  const { gapi } = await import("../../../../../engine/google/api");
  const headers = HEADERS[lang];
  const { findInFolder } = await import("../../../../../engine/google/sheets");
  const sheet = await ensureSpreadsheet({ folderId: project.driveFolderId, name: sheetName(project), tabs: [{ title: TAB, headers }] });
  // A sheet made under the other language keeps its header; the key column is found by either name.
  let existing = await readTab(sheet.id, TAB);
  // Carry ticks over from an earlier "To-do" sheet (same keys); leave it in place.
  if (sheet.created) {
    const legacy = await findInFolder(project.driveFolderId, `To-do — ${project.title}`);
    if (legacy) existing = await readTab(legacy, "To-do").catch(() => existing);
  }
  applyStatuses(items, existing, existing[0]?.find((h) => /Key|Clé/.test(h)) ?? headers[KEY_COL]!);

  const rows = sheetRows(items);
  const S0 = `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}`;
  // A sheet made with the earlier columns gets the new header row.
  if (existing[0]?.join() !== headers.join())
    await gapi("rewriting the Plan header", `${S0}/values/${encodeURIComponent(`${TAB}!A1:Z1`)}:clear`, { method: "POST", json: {} }).then(() =>
      gapi("writing the Plan header", `${S0}/values/${encodeURIComponent(`${TAB}!A1`)}?valueInputOption=RAW`, { method: "PUT", json: { values: [headers] } }));
  const S = `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}`;
  await gapi("clearing the Plan sheet", `${S}/values/${encodeURIComponent(`${TAB}!A2:Z`)}:clear`, { method: "POST", json: {} });
  if (rows.length) await gapi("writing the Plan sheet", `${S}/values/${encodeURIComponent(`${TAB}!A2`)}?valueInputOption=RAW`, { method: "PUT", json: { values: rows } });

  const meta = await gapi<{ sheets: { properties: { sheetId: number; title: string }; conditionalFormats?: unknown[] }[] }>(
    "reading the Plan sheet", `${S}?fields=sheets(properties(sheetId,title),conditionalFormats)`);
  const tab = meta.sheets.find((x) => x.properties.title === TAB);
  if (!tab) return { url: sheet.url, rows: rows.length };
  const sheetId = tab.properties.sheetId;
  const oldRules = tab.conditionalFormats?.length ?? 0;

  // Status menu, filters, overdue in red, done greyed, key hidden. Rules are
  // replaced, not stacked, on every run.
  const end = Math.max(rows.length, 1) + 1;
  const full = { sheetId, startRowIndex: 1, endRowIndex: end, startColumnIndex: 0, endColumnIndex: KEY_COL };
  const width = (i: number, px: number) => ({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: "pixelSize" } });
  await gapi("organising the Plan sheet", `${S}:batchUpdate`, { method: "POST", json: { requests: [
    ...[...Array(oldRules).keys()].map(() => ({ deleteConditionalFormatRule: { sheetId, index: 0 } })),
    { setDataValidation: { range: { ...full, startColumnIndex: STATUS_COL, endColumnIndex: STATUS_COL + 1 }, rule: { condition: { type: "ONE_OF_LIST", values: STATUSES.map((v) => ({ userEnteredValue: v })) }, showCustomUi: true, strict: true } } },
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: end, startColumnIndex: 0, endColumnIndex: KEY_COL } } } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.97, green: 0.94, blue: 0.9 } } }, fields: "userEnteredFormat(textFormat,backgroundColor)" } },
    { addConditionalFormatRule: { index: 0, rule: { ranges: [full], booleanRule: { condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: '=OR($D2="Done",$D2="Won\'t do")' }] }, format: { textFormat: { strikethrough: true, foregroundColor: { red: 0.6, green: 0.6, blue: 0.6 } } } } } } },
    { addConditionalFormatRule: { index: 1, rule: { ranges: [full], booleanRule: { condition: { type: "CUSTOM_FORMULA", values: [{ userEnteredValue: '=AND($D2="To do",DATEVALUE($A2)<TODAY())' }] }, format: { textFormat: { foregroundColor: { red: 0.7, green: 0.15, blue: 0.12 }, bold: true } } } } } },
    width(0, 95), width(1, 320), width(2, 140), width(3, 95), width(4, 320),
    { updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: KEY_COL, endIndex: KEY_COL + 1 }, properties: { hiddenByUser: true }, fields: "hiddenByUser" } },
  ] } });
  return { url: sheet.url, rows: rows.length };
}

export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`;
export { DAY };
