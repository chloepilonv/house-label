/**
 * The workshop → data/catalog/catalog.sqlite, the catalog that ships.
 *
 *   bun run catalog:build
 *
 * Exports every shipped dataset from the workshop Postgres into one SQLite file
 * plus manifest. SQLite: built into Bun and Python's stdlib, so no dependency.
 */
import postgres from "postgres";
import { Database } from "bun:sqlite";
import { rename } from "node:fs/promises";
import { DATASETS } from "./datasets";
import { workshopUrl } from "../workshop";
import { SHIPPED_CATALOG } from "../client";

const dbUrl = workshopUrl();
const version = new Date().toISOString().slice(0, 10);
const outFile = `${SHIPPED_CATALOG}.building`;
await Bun.file(outFile).delete().catch(() => {});

const sql = postgres(dbUrl, { max: 1 });
const snap = new Database(outFile, { create: true });

/** SQLite has no arrays, no jsonb, no timestamptz. Everything else is text. */
function encode(v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const rowCounts: Record<string, number> = {};
const completeness: Record<string, string> = {};
// Array columns per table, from information_schema, so the reader need not guess by name.
const arrayColumns: Record<string, string[]> = {};

snap.exec("pragma journal_mode = off");
snap.exec("begin");

for (const ds of DATASETS) {
  const withheld = ds.restricted ?? [];

  const colInfo = await sql<{ column_name: string; data_type: string }[]>`
    select column_name, data_type from information_schema.columns
    where table_schema = 'catalog' and table_name = ${ds.table}
    order by ordinal_position`;
  const cols = colInfo.map((c) => c.column_name);

  if (!cols.length) {
    console.warn(`  ⚠ catalog.${ds.table} not found — skipped (run catalog:migrate first?)`);
    continue;
  }
  const keep = cols.filter((c) => !withheld.includes(c));

  // Retired rows are excluded but never deleted upstream, so artist slugs still
  // resolve. Tables without lifecycle ship whole.

  const hasLifecycle = cols.includes("lifecycle");
  const rows = await sql<Record<string, unknown>[]>`
    select ${sql(keep)} from ${sql("catalog")}.${sql(ds.table)}
    ${hasLifecycle ? sql`where lifecycle <> 'retired'` : sql``}`;

  snap.exec(`create table ${ds.table} (${keep.map((c) => `"${c}"`).join(", ")})`);
  if (rows.length) {
    const stmt = snap.prepare(
      `insert into ${ds.table} values (${keep.map(() => "?").join(", ")})`,
    );
    for (const r of rows) stmt.run(...keep.map((c) => encode(r[c])));
    stmt.finalize();
  }
  if (ds.identity) {
    snap.exec(`create unique index ${ds.table}_identity on ${ds.table} ("${ds.identity}")`);
  }

  rowCounts[ds.table] = rows.length;
  completeness[ds.table] = ds.completeness;
  arrayColumns[ds.table] = colInfo
    .filter((c) => c.data_type === "ARRAY" && keep.includes(c.column_name))
    .map((c) => c.column_name);
  const note = withheld.length ? `  (withheld: ${withheld.join(", ")})` : "";
  console.log(`  ✓ ${ds.table.padEnd(20)} ${String(rows.length).padStart(5)} rows${note}`);
}

snap.exec("commit");
snap.close();

// ── manifest ───────────────────────────────────────────────────────────────
const bytes = Bun.file(outFile).size;
const sha256 = new Bun.CryptoHasher("sha256")
  .update(await Bun.file(outFile).arrayBuffer())
  .digest("hex");
const manifest = {
  version, bytes, sha256,
  built_at: new Date().toISOString(),
  row_counts: rowCounts,
  completeness,
  array_columns: arrayColumns,
};
await rename(outFile, SHIPPED_CATALOG);
await Bun.write(`${SHIPPED_CATALOG}.manifest.json`, JSON.stringify(manifest, null, 2));
await sql.end();

const total = Object.values(rowCounts).reduce((a, b) => a + b, 0);
console.log(`\n→ data/catalog/catalog.sqlite — ${total} rows, ${(bytes / 1024).toFixed(0)} KB (commit it)`);
