/**
 * data/catalog/catalog.sqlite → the workshop Postgres. The other half of build.ts.
 *
 *   bun run catalog:load
 *
 * Truncates and refills every shipped table: the file is the truth. Runs
 * catalog:migrate first so tables have today's columns.

 */
import postgres from "postgres";
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { DATASETS } from "./datasets";
import { workshopUrl } from "../workshop";
import { SHIPPED_CATALOG } from "../client";

const migrate = Bun.spawnSync(["bun", "run", `${import.meta.dir}/../migrate.ts`], { stdout: "inherit", stderr: "inherit" });
if (migrate.exitCode !== 0) process.exit(1);

const sql = postgres(workshopUrl(), { max: 1, onnotice: () => {} });
const file = new Database(SHIPPED_CATALOG, { readonly: true });
const manifest = JSON.parse(readFileSync(`${SHIPPED_CATALOG}.manifest.json`, "utf8")) as { array_columns?: Record<string, string[]> };

for (const ds of DATASETS) {
  const types = new Map(
    // A generated column (slug) is recomputed by Postgres, never inserted.
    (await sql<{ column_name: string; data_type: string }[]>`
      select column_name, data_type from information_schema.columns
      where table_schema = 'catalog' and table_name = ${ds.table} and is_generated = 'NEVER'`).map((c) => [c.column_name, c.data_type]),
  );
  if (!types.size) {
    console.warn(`  ⚠ catalog.${ds.table} has no schema.sql table — skipped`);
    continue;
  }
  const arrays = new Set(manifest.array_columns?.[ds.table] ?? []);
  const rows = (file.query(`select * from ${ds.table}`).all() as Record<string, unknown>[]).map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      const t = types.get(k);
      if (!t) continue; // a column the schema no longer has
      if (v === null) out[k] = null;
      else if (arrays.has(k) || t === "ARRAY") out[k] = JSON.parse(String(v));
      else if (t === "jsonb" || t === "json") out[k] = sql.json(JSON.parse(String(v)));
      else if (t === "boolean") out[k] = v === 1 || v === "1" || v === true;
      else out[k] = v;
    }
    return out;
  });
  await sql.begin(async (tx) => {
    await tx.unsafe(`truncate catalog.${ds.table} cascade`);
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      if (chunk.length) await tx`insert into ${tx(`catalog.${ds.table}`)} ${tx(chunk as never)}`;
    }
  });
  console.log(`  ✓ ${ds.table.padEnd(26)} ${String(rows.length).padStart(5)} rows`);
}
file.close();
await sql.end();
console.log("\nWorkshop = catalog.sqlite. Crawl, seed or enrich, then `bun run catalog:build`.");
