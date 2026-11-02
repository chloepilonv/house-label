/**
 * Total a song's writer and master splits, and report what is wrong with them.
 *
 *   bun run agents/rights/skills/rights-manage-catalog/scripts/check-splits.ts song.json
 *
 * Code, not model arithmetic: a wrong total is a share that never gets paid.
 * A total off 100% is a warning, never an error; nothing here blocks a save.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt.
 */

/** The extractor's sentinel for "this field could not be read". Never invented,
 *  never translated, and NULL in the database on confirm. */
export const MISSING = "MISSING";

export type Share = { name?: string; share_percent?: number | string | null; role?: string; ipi?: string | null };
export type Song = { title?: string; isrc?: string | null; writers?: Share[]; master_splits?: Share[] };

export type Finding = { level: "error" | "warning"; field: string; message: string };

/** A share cell is either a number, the MISSING sentinel, or junk. Junk is a
 *  finding, not a zero. */
function readShare(v: Share["share_percent"]): { value: number | null; missing: boolean; junk: boolean } {
  if (v === MISSING) return { value: null, missing: true, junk: false };
  if (v === null || v === undefined || v === "") return { value: null, missing: false, junk: false };
  const n = typeof v === "number" ? v : Number(String(v).replace("%", "").trim());
  if (!Number.isFinite(n)) return { value: null, missing: false, junk: true };
  return { value: n, missing: false, junk: false };
}

function checkSide(rows: Share[] | undefined, side: "writers" | "master_splits"): { total: number; findings: Finding[] } {
  const findings: Finding[] = [];
  if (!rows?.length) return { total: 0, findings };

  let total = 0;
  const seen = new Map<string, number>();

  rows.forEach((r, i) => {
    const at = `${side}[${i}]`;
    const label = r.name === MISSING || !r.name ? `(unnamed)` : r.name;
    if (r.name === MISSING) findings.push({ level: "error", field: `${at}.name`, message: "name is MISSING — cannot be registered or paid" });

    const { value, missing, junk } = readShare(r.share_percent);
    if (missing) findings.push({ level: "error", field: `${at}.share_percent`, message: `${label}: share is MISSING — ask the artist, never assume an even split` });
    else if (junk) findings.push({ level: "error", field: `${at}.share_percent`, message: `${label}: share "${r.share_percent}" is not a number` });
    else if (value !== null) {
      if (value < 0) findings.push({ level: "error", field: `${at}.share_percent`, message: `${label}: negative share` });
      total += value;
      const key = label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  });

  for (const [name, n] of seen) if (n > 1) findings.push({ level: "warning", field: side, message: `"${name}" appears ${n} times — a duplicate is the usual cause of a total over 100` });

  const rounded = Math.round(total * 100) / 100;
  if (rows.length && rounded !== 100)
    findings.push({
      level: "warning",
      field: side,
      message: `${side.replace("_", " ")} total ${rounded}% — ${rounded < 100 ? `${Math.round((100 - rounded) * 100) / 100}% unallocated` : `${Math.round((rounded - 100) * 100) / 100}% over`}`,
    });

  return { total: rounded, findings };
}

export function checkSplits(song: Song) {
  const writers = checkSide(song.writers, "writers");
  const master = checkSide(song.master_splits, "master_splits");
  const findings = [...writers.findings, ...master.findings];
  if (song.isrc && song.isrc !== MISSING && !/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(song.isrc.replace(/[^A-Za-z0-9]/g, "").toUpperCase()))
    findings.push({ level: "warning", field: "isrc", message: `"${song.isrc}" is not a valid ISRC (CCXXXYYNNNNN)` });
  if (!song.title || song.title === MISSING)
    findings.push({ level: "error", field: "title", message: "title is MISSING — import is blocked until every row has a real title" });

  return {
    title: song.title ?? "(untitled)",
    writer_total: writers.total,
    master_total: master.total,
    findings,
    blocked: findings.some((f) => f.level === "error"),
  };
}

if (import.meta.main) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: check-splits.ts <song.json>");
    process.exit(2);
  }
  const input = await Bun.file(file).json();
  const songs: Song[] = Array.isArray(input) ? input : [input];
  const results = songs.map(checkSplits);
  console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
  process.exit(results.some((r) => r.blocked) ? 1 : 0);
}
