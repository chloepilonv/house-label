/**
 * The Release-Credits sheet's shape. A column renamed here but not in the
 * importer is silently dropped on import.
 */
import { describe, expect, test } from "bun:test";
import {
  GLOSSARY_TERMS,
  LEGACY_TITLES,
  RIGHT_GROUPS,
  TITLES,
  bareTitle,
  RIGHT_TYPES,
  TABS,
  frozenColumns,
  groupRow,
  headerRows,
  labelOf,
  sheetName,
  systemColumns,
  targetTitle,
} from "./credits-sheet";
import { mmss } from "./workspace";
import { a1 } from "./sheets";

const tab = (title: string) => TABS.find((t) => t.title === title)!;
const keys = (title: string) => tab(title).columns.map((c) => c.key);

describe("the five tabs", () => {
  test("all present, in reading order — the artist's names (2026-09-09)", () => {
    expect(TABS.map((t) => t.title)).toEqual(["⭐ RELEASE_CREDITS", "⭐ SONG_CREDITS", "⭐ SONG_SPLITS", "⭐ PEOPLE_INFO", "📚 GLOSSARY"]);
    // The emoji are part of the artist's tab titles.
    expect(TABS.map((t) => bareTitle(t.title))).toEqual(["RELEASE_CREDITS", "SONG_CREDITS", "SONG_SPLITS", "PEOPLE_INFO", "GLOSSARY"]);
  });

  test("TEAM, SAMPLES and FUNDING are gone, not renamed", () => {
    for (const t of TABS) expect(t.title).not.toMatch(/TEAM|SAMPLES|FUNDING/);
  });

  test("every tab has a purpose line, and no duplicate key", () => {
    for (const t of TABS) {
      expect(t.purpose.length).toBeGreaterThan(10);
      expect(new Set(t.columns.map((c) => c.key)).size).toBe(t.columns.length);
    }
  });

  test("labels are unique — within their group on a grouped tab, outright elsewhere", () => {
    for (const t of TABS) {
      if (!t.groups) {
        expect(new Set(t.headers).size).toBe(t.headers.length);
        continue;
      }
      const qualified = groupRow(t.groups).reduce<string[]>((acc, g, i) => {
        const group = g || acc[i - 1]?.split("·")[0] || "";
        acc.push(`${group}·${t.headers[i]}`);
        return acc;
      }, []);
      expect(new Set(qualified).size).toBe(qualified.length);
    }
  });

  test("headers are the labels, in column order", () => {
    for (const t of TABS) expect(t.headers).toEqual(t.columns.map((c) => c.label));
  });
});

describe("written for a person, not the importer", () => {
  test("no header label is a snake_case key", () => {
    // Labels are for humans, never raw keys.
    for (const t of TABS) for (const h of t.headers) expect(h).not.toMatch(/^[a-z0-9]+(_[a-z0-9]+)+$/);
  });

  test("no header label is a bare code or symbol", () => {
    // Plain words with the term in parentheses. "%" is the exception, under a group name.
    for (const t of TABS)
      for (const h of t.headers) {
        expect(h).not.toMatch(/^[A-Z]{3,5}$/);
        expect(h).not.toMatch(/^[℗©]/);
      }
  });

  test("the copyright lines read as ℗ and ©", () => {
    // Plain words first, the symbol in parentheses.
    expect(labelOf(TITLES.release, "p_owner")).toMatch(/^Who owns the recording/);
    expect(labelOf(TITLES.release, "p_owner")).toContain("(℗)");
    expect(labelOf(TITLES.release, "c_owner")).toMatch(/^Who owns the song/);
    expect(labelOf(TITLES.release, "c_owner")).toContain("(©)");
  });

  test("a database id is never the first column, and is always marked system", () => {
    for (const t of TABS) {
      const first = t.columns[0];
      expect(first.system ?? false).toBe(false);
      expect(first.key).not.toMatch(/_id$/);
      for (const col of t.columns) if (col.key.endsWith("_id")) expect(col.system).toBe(true);
    }
  });

  test("system columns are last, and only RELEASE_CREDITS and SONG_CREDITS have one", () => {
    for (const t of TABS) {
      const sys = systemColumns(t);
      if (t.title === TITLES.release || t.title === TITLES.songs) expect(sys).toEqual([t.columns.length - 1]);
      else expect(sys).toEqual([]);
    }
  });

  test("a split row references its song by title, and names the tab the title lives on", () => {
    expect(labelOf(TITLES.splits, "song")).toMatch(/title/i);
    expect(labelOf(TITLES.splits, "song")).toContain(bareTitle(TITLES.songs));
  });

  test("the first two columns are the ones worth freezing: what the row is about", () => {
    // Frozen by `sheets.ts`, so a scrolled row still shows what it is.
    expect(keys(TITLES.release).slice(0, 2)).toEqual(["title", "release_type"]);
    expect(keys(TITLES.songs).slice(0, 2)).toEqual(["track_number", "title"]);
    expect(keys(TITLES.splits).slice(0, 2)).toEqual(["song", "composition_name"]);
    expect(keys(TITLES.people).slice(0, 2)).toEqual(["first_name", "last_name"]);
  });
});

describe("the artist's own spec", () => {
  test("RELEASE_CREDITS carries name, date, UPC and both copyright lines", () => {
    for (const k of ["title", "release_date", "upc", "p_owner", "p_year", "c_owner", "c_year"]) expect(keys(TITLES.release)).toContain(k);
  });

  test("SONG_CREDITS carries the codes and the store fields, not the fixation block", () => {
    for (const k of ["title", "isrc", "iswc", "duration", "version_type", "explicit", "genre", "subgenre", "language"])
      expect(keys(TITLES.songs)).toContain(k);
    // These columns were cut from the spec.
    for (const k of ["fixation_country", "fixation_year", "first_producer_name", "first_producer_country"])
      expect(keys(TITLES.songs)).not.toContain(k);
  });

  test("PEOPLE_INFO is exactly what the label collected: name, role, contact, SIN, IPI, GST, QST", () => {
    // Prénom · Nom · Poste · Courriel · Téléphone · Adresse postale · NAS ·
    // IPI (à défaut SOCAN) · TPS · TVQ.
    expect(keys(TITLES.people)).toEqual([
      "first_name",
      "last_name",
      "position",
      "email",
      "phone",
      "postal_address",
      "sin",
      "ipi",
      "gst_hst_number",
      "qst_number",
    ]);
    expect(labelOf(TITLES.people, "ipi")).toContain("SOCAN");
  });

  test("PEOPLE_INFO carries no tax-form bookkeeping", () => {
    for (const k of ["tax_id_type", "tax_id_on_file", "tax_id_location", "w8ben_on_file", "w9_on_file"])
      expect(keys(TITLES.people)).not.toContain(k);
  });

  test("PEOPLE_INFO says on its face that it holds a SIN", () => {
    // No per-cell permissions in Sheets, so the tab warns about sensitive data.
    expect(tab(TITLES.people).purpose).toMatch(/SIN/);
    expect(tab(TITLES.people).purpose).toMatch(/share/i);
  });
});

describe("SONG_SPLITS is three groups of Name and %", () => {
  test("the group row is COMPOSITION RIGHTS · MASTER · PERFORMER over Name and %", () => {
    const t = tab(TITLES.splits);
    expect(groupRow(t.groups!)).toEqual(["", "COMPOSITION RIGHTS", "", "MASTER", "", "PERFORMER", ""]);
    expect(t.headers).toEqual([labelOf(TITLES.splits, "song"), "Name", "%", "Name", "%", "Name", "%"]);
  });

  test("the header sits on row 2 there, and row 1 everywhere else", () => {
    for (const t of TABS) expect(headerRows(t)).toBe(t.title === TITLES.splits ? 2 : 1);
  });

  test("the groups are the three rights, in the sheet's order", () => {
    expect(RIGHT_TYPES).toEqual(["composition", "master", "performer"]);
    expect(RIGHT_TYPES.map((r) => RIGHT_GROUPS[r])).toEqual(["COMPOSITION RIGHTS", "MASTER", "PERFORMER"]);
    for (const r of RIGHT_TYPES) {
      expect(keys(TITLES.splits)).toContain(`${r}_name`);
      expect(keys(TITLES.splits)).toContain(`${r}_share`);
    }
  });

  test("no role, publisher, instrument or agreement column — that was the old shape", () => {
    for (const k of ["right_type", "role", "instrument", "featured", "publisher_name", "agreement_ref"])
      expect(keys(TITLES.splits)).not.toContain(k);
  });

  test("a tab refuses groups that do not span its columns", () => {
    // The guard lives in the `tab()` builder; a wrong span throws at import.
    const t = tab(TITLES.splits);
    expect(t.groups!.reduce((n, g) => n + g.span, 0)).toBe(t.columns.length);
  });
});

describe("GLOSSARY explains the sheet in the sheet's own words", () => {
  test("has a row for each right, each identifier, the SIN and each copyright line", () => {
    for (const term of ["Right — composition", "Right — master", "Right — performer", "%", "Recording code (ISRC)", "Song code (ISWC)", "Writer number (IPI)", "SIN (NAS)"])
      expect(GLOSSARY_TERMS).toContain(term);
    expect(GLOSSARY_TERMS).toContain("Who owns the recording (℗)");
    expect(GLOSSARY_TERMS).toContain("Who owns the song (©)");
    expect(GLOSSARY_TERMS).toContain(labelOf(TITLES.release, "release_id"));
  });

  test("glosses nothing the sheet no longer has", () => {
    for (const gone of ["Featured?", "Role", "Publisher", "Arrangement", "Sample / interpolation", "W-8BEN / W-9", "Acknowledgement line", "Tax ID type / on file?", "Who first recorded it"])
      expect(GLOSSARY_TERMS).not.toContain(gone);
  });

  test("every row has one sentence, one example and the French", () => {
    for (const row of tab(TITLES.glossary).rows!) {
      expect(row).toHaveLength(4);
      for (const cell of row) expect(cell.length).toBeGreaterThan(0);
    }
  });

  test("no term is glossed twice, and no term is a snake_case key", () => {
    expect(new Set(GLOSSARY_TERMS).size).toBe(GLOSSARY_TERMS.length);
    for (const term of GLOSSARY_TERMS) expect(term).not.toMatch(/^[a-z0-9]+(_[a-z0-9]+)+$/);
  });
});

describe("naming", () => {
  test("the sheet is named from the release, and there is one per release", () => {
    expect(sheetName("Nightdrive")).toBe("Nightdrive — Release-Credits");
    expect(sheetName("Him/Her")).toBe("Him-Her — Release-Credits");
  });

  test("labelOf refuses a key that does not exist", () => {
    expect(() => labelOf(TITLES.songs, "nope")).toThrow();
  });

  test("durations are MM:SS for a person reading a waveform", () => {
    expect(mmss(214)).toBe("3:34");
    expect(mmss(5)).toBe("0:05");
  });
});

describe("an older sheet finds its way to the current tabs", () => {
  test("legacy names and hand-renamed tabs resolve to the spec tab", () => {
    expect(targetTitle("RELEASE")).toBe(TITLES.release);
    expect(targetTitle("SONGS")).toBe(TITLES.songs);
    expect(targetTitle("PEOPLE")).toBe(TITLES.people);
    expect(targetTitle("SPLITS")).toBe(TITLES.splits);
    // A hand-typed variant.
    expect(targetTitle("⭐ SONGS_SPLITS")).toBe(TITLES.splits);
    expect(targetTitle("⭐ SONGS_CREDITS")).toBe(TITLES.songs);
    expect(targetTitle("📚 GLOSSARY")).toBe(TITLES.glossary);
    // The bare spelling without the star.
    expect(targetTitle("SONG_SPLITS")).toBe(TITLES.splits);
    expect(targetTitle("GLOSSARY")).toBe(TITLES.glossary);
  });

  test("a spec title resolves to itself", () => {
    for (const t of TABS) expect(targetTitle(t.title)).toBe(t.title);
  });

  test("retired tabs and strangers resolve to nothing", () => {
    for (const t of ["TEAM", "SAMPLES", "FUNDING", "Sheet1", "Notes"]) expect(targetTitle(t)).toBeNull();
  });

  test("every legacy target is a tab that exists", () => {
    for (const to of Object.values(LEGACY_TITLES)) expect(TABS.map((t) => bareTitle(t.title))).toContain(to);
  });
});

describe("frozen columns", () => {
  test("two on every plain tab, one on SONG_SPLITS so the group merge does not straddle the freeze", () => {
    // Sheets refuses to merge frozen and non-frozen columns.
    for (const t of TABS) expect(frozenColumns(t)).toBe(t.title === TITLES.splits ? 1 : 2);
  });
});

describe("ranges", () => {
  test("a tab name is quoted in A1 notation, an apostrophe doubled", () => {
    expect(a1("⭐ SONG_CREDITS", "A1")).toBe("'⭐ SONG_CREDITS'!A1");
    expect(a1("📚 GLOSSARY")).toBe("'📚 GLOSSARY'");
    expect(a1("Marie's", "A2:Z")).toBe("'Marie''s'!A2:Z");
  });
});
