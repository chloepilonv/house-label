/**
 * Apply every data/catalog/<topic>/schema.sql (auto-discovered). Schema files
 * are re-runnable, so this is safe to repeat.
 *
 * Run:  bun run catalog:migrate        (into the workshop Postgres named by CATALOG_DATABASE_URL — see workshop.ts)
 */
import postgres from "postgres";
import { workshopUrl } from "./workshop";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dbUrl = workshopUrl();

const dataDir = dirname(fileURLToPath(import.meta.url));
const schemas = readdirSync(dataDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => join(dataDir, e.name, "schema.sql"))
  .filter(existsSync)
  .sort();

// Silence the NOTICEs that every "if not exists" emits on a re-run.

const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
for (const path of schemas) {
  await sql.unsafe(readFileSync(path, "utf8"));
  console.log(`✓ applied ${path.slice(dataDir.length + 1)}`);
}
await sql.end();
console.log("Done.");
