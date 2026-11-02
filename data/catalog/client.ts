/**
 * The read seam: every agent queries the catalog (data/catalog/catalog.sqlite,
 * shipped with the repo) through here. Offline; queries never leave the machine.
 * Python skills read the same file through data/catalog/query.py.
 *
 * Usage:
 *   import { openCatalog } from "./data/catalog/client";
 *   const catalog = await openCatalog();
 *   const outlets = await catalog.query("press_outlets", { market: "quebec" });
 */
import { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DATASETS, type Dataset } from "./publish/datasets";

export const SHIPPED_CATALOG = join(import.meta.dir, "catalog.sqlite");
/** CATALOG_FILE swaps in a scratch copy — the evals runner's, with a case's own rows. */
export const CATALOG_FILE = process.env.CATALOG_FILE ?? SHIPPED_CATALOG;
const MANIFEST_FILE = `${SHIPPED_CATALOG}.manifest.json`;

export interface Filter {
  /** Exact matches: { country: "CA", lifecycle: "active" }. */
  [column: string]: string | number | boolean | string[] | undefined;
}

export interface CatalogInfo {
  /** The day the file was built. */
  version: string | null;
  /** Per-dataset 'complete' | 'partial'. An agent must not say "all" of a
   *  partial dataset — see data/catalog/publish/datasets.ts. */
  completeness: Record<string, string>;
}

export interface Catalog {
  info: CatalogInfo;
  query<T = Record<string, unknown>>(table: string, filter?: Filter, limit?: number): Promise<T[]>;
  close(): Promise<void>;
}

const byTable = (table: string): Dataset => {
  const ds = DATASETS.find((d) => d.table === table);
  if (!ds) throw new Error(`unknown dataset '${table}' — see data/catalog/publish/datasets.ts`);
  return ds;
};

/**
 * Array columns are JSON text in a snapshot and text[] in Postgres.
 * ARRAY_HINT is a fallback for snapshots whose manifest lacks `array_columns`;
 * it misses many array columns, so the manifest's per-table set is the truth.
 */
const ARRAY_HINT = /_(tags|types|stages|fit|requirements|provided|disciplines|deadlines)$|^(genres|languages|accessibility|citizenship|regions|for_whom)$/;

function decode(row: Record<string, unknown>, arrayCols?: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const isArrayCol = arrayCols ? arrayCols.has(k) : ARRAY_HINT.test(k);
    if (typeof v === "string" && isArrayCol && v.startsWith("[")) {
      try { out[k] = JSON.parse(v); continue; } catch { /* leave as text */ }
    }
    out[k] = v;
  }
  return out;
}

// ── the file ───────────────────────────────────────────────────────────────

/** Open the catalog. A missing file is a broken clone, so it throws. */

export async function openCatalog(): Promise<Catalog> {
  if (!existsSync(CATALOG_FILE))
    throw new Error(`no catalog at ${CATALOG_FILE} — it ships with the repo; \`git checkout data/catalog/catalog.sqlite\``);
  const db = new Database(CATALOG_FILE, { readonly: true });
  const manifest = (existsSync(MANIFEST_FILE) ? JSON.parse(readFileSync(MANIFEST_FILE, "utf8")) : {}) as {
    version?: string;
    completeness?: Record<string, string>;
    array_columns?: Record<string, string[]>;
  };
  const arraySets: Record<string, Set<string>> = Object.fromEntries(
    Object.entries(manifest.array_columns ?? {}).map(([tbl, cs]) => [tbl, new Set(cs)]),
  );
  const tables = new Set((db.query("select name from sqlite_master where type='table'").all() as { name: string }[]).map((r) => r.name));

  return {
    info: { version: manifest.version ?? null, completeness: manifest.completeness ?? {} },
    async query(table, filter = {}, limit = 500) {
      byTable(table);
      // A declared dataset missing from the file is an empty answer, not a crash.
      if (!tables.has(table)) return [];
      const clauses: string[] = [];
      const params: (string | number)[] = [];
      const cols = new Set((db.query(`select name from pragma_table_info('${table}')`).all() as { name: string }[]).map((r) => r.name));
      if (cols.has("lifecycle")) clauses.push(`lifecycle <> 'retired'`);
      for (const [col, val] of Object.entries(filter)) {
        if (val === undefined) continue;
        if (Array.isArray(val)) {
          // Array columns are JSON text here, so containment is a LIKE on the
          // encoded form. Exact enough for the vocabularies in use (snake_case tags).
          clauses.push(`(${val.map(() => `"${col}" like ?`).join(" or ")})`);
          params.push(...val.map((v) => `%"${v}"%`));
        } else {
          clauses.push(`"${col}" = ?`);
          params.push(typeof val === "boolean" ? (val ? 1 : 0) : val);
        }
      }
      const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
      const rows = db.query(`select * from ${table} ${where} limit ${Number(limit)}`).all(...params);
      return (rows as Record<string, unknown>[]).map((r) => decode(r, arraySets[table])) as never;
    },
    async close() { db.close(); },
  };
}
