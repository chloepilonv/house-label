import postgres, { type Sql } from "postgres";
import { createHash } from "node:crypto";
import type { Row, SourceRow, Trigger } from "./types";

/**
 * Connect to the catalog database (CATALOG_DATABASE_URL). Never falls back to
 * DATABASE_URL, which is the artist's database.
 */
export function connect(): Sql {
  const url = process.env.CATALOG_DATABASE_URL;
  if (!url) throw new Error("CATALOG_DATABASE_URL not set (see doc/DEVELOPMENT.md)");
  return postgres(url, { max: 1 });
}

/**
 * Split "schema.table" into two identifiers (default schema: public).
 * postgres.js would otherwise quote "catalog.press_outlets" as one identifier.
 */
function qualify(table: string): [string, string] {
  const dot = table.indexOf(".");
  return dot === -1 ? ["public", table] : [table.slice(0, dot), table.slice(dot + 1)];
}

/** Columns the crawler owns; excluded from the content hash so that a
 *  re-observation with identical data does not read as a change. */
const PROVENANCE = new Set([
  "source", "source_url", "protected", "content_hash", "first_seen_at",
  "last_seen_at", "last_verified", "missing_since", "missing_runs", "lifecycle",
  "created_at", "updated_at",
]);

/** Stable hash of a row's meaningful content. */
export function contentHash(row: Row): string {
  const meaningful = Object.keys(row)
    .filter((k) => !PROVENANCE.has(k))
    .sort()
    .map((k) => `${k}=${JSON.stringify(row[k] ?? null)}`)
    .join("\x00");
  return createHash("sha256").update(meaningful).digest("hex").slice(0, 32);
}

// ── topics & sources ───────────────────────────────────────────────────────

/**
 * A source is due when it never succeeded or `cadence_days` have passed since.
 * Shared so `activeTopics` and `loadSources` cannot disagree on "due".
 */
const due = (sql: Sql) =>
  sql`(last_ok_at is null or last_ok_at < now() - make_interval(days => cadence_days))`;

/** Topics to crawl: whatever has active (and, unless forced, due) sources. */
export async function activeTopics(sql: Sql, force = false): Promise<string[]> {
  const rows = await sql<{ topic: string }[]>`
    select distinct topic from catalog.crawl_sources
    where status = 'active' ${force ? sql`` : sql`and ${due(sql)}`}
    order by topic`;
  return rows.map((r) => r.topic);
}

export async function loadSources(
  sql: Sql, topic: string, kind?: string, force = false,
): Promise<SourceRow[]> {
  return (await sql`
    select id, topic, url, kind, scope, extraction, status, consecutive_failures, cadence_days
    from catalog.crawl_sources
    where topic = ${topic} and status = 'active'
      ${kind ? sql`and kind = ${kind}` : sql``}
      ${force ? sql`` : sql`and ${due(sql)}`}
    order by id`) as unknown as SourceRow[];
}

export async function recordSourceResult(
  sql: Sql, sourceId: string, ok: boolean, rows: number, error?: string,
): Promise<void> {
  await sql`
    update catalog.crawl_sources set
      last_run_at = now(),
      last_ok_at = ${ok ? sql`now()` : sql`last_ok_at`},
      last_error = ${error ?? null},
      consecutive_failures = ${ok ? 0 : sql`consecutive_failures + 1`},
      rows_last_run = ${rows}
    where id = ${sourceId}`;
}

// ── runs & observations ────────────────────────────────────────────────────

export async function startRun(sql: Sql, topic: string, trigger: Trigger): Promise<string> {
  const [run] = await sql<{ id: string }[]>`
    insert into catalog.crawl_runs (topic, trigger, git_sha)
    values (${topic}, ${trigger}, ${process.env.GITHUB_SHA ?? null})
    returning id`;
  return run.id;
}

export async function finishRun(sql: Sql, runId: string, stats: Row, error?: string): Promise<void> {
  await sql`
    update catalog.crawl_runs set
      finished_at = now(), ok = ${!error}, error = ${error ?? null},
      ${sql(stats)}
    where id = ${runId}`;
}

export async function observe(
  sql: Sql, runId: string, topic: string,
  obs: { entity_slug: string; source_id: string | null; seen: boolean; content_hash?: string | null; changed?: Row | null }[],
): Promise<void> {
  if (!obs.length) return;
  await sql`insert into catalog.crawl_observations ${sql(
    obs.map((o) => ({
      run_id: runId, topic, entity_slug: o.entity_slug, source_id: o.source_id,
      seen: o.seen, content_hash: o.content_hash ?? null,
      changed: o.changed ? sql.json(o.changed) : null,
    })),
  )}`;
}

/**
 * Entities this source has surfaced before; any not returned this run is a
 * "missing" candidate. Derived from observations, so a source can only mark
 * its own rows missing, and seeded rows (never observed) never are.
 */
export async function expectedFrom(sql: Sql, sourceId: string): Promise<string[]> {
  const rows = await sql<{ entity_slug: string }[]>`
    select distinct entity_slug from catalog.crawl_observations
    where source_id = ${sourceId} and seen = true`;
  return rows.map((r) => r.entity_slug);
}

// ── catalog writes ─────────────────────────────────────────────────────────

export interface UpsertResult {
  identity: string;
  added: boolean;
  changed: boolean;
  hash: string;
}

/**
 * Upsert one catalog row. Seeing it resets it to `active` and clears missing
 * counters. `first_seen_at` is never updated: "added this week" is built on it.
 */
export async function upsertRow(
  sql: Sql, table: string, conflict: string[], identity: string, row: Row,
): Promise<UpsertResult> {
  const [schema, name] = qualify(table);
  const hash = contentHash(row);

  const where = conflict.map((c) => sql`${sql(c)} = ${row[c] as never}`).reduce((a, b) => sql`${a} and ${b}`);
  const [existing] = await sql<{ content_hash: string | null }[]>`
    select content_hash from ${sql(schema)}.${sql(name)} where ${where}`;

  const write = {
    ...row,
    content_hash: hash,
    last_seen_at: new Date(),
    last_verified: new Date(),
    lifecycle: "active",
    missing_since: null,
    missing_runs: 0,
  };

  // The parentheses are required: without them postgres.js reads the array as
  // a values builder and throws UNDEFINED_VALUE.
  const [out] = await sql<Row[]>`
    insert into ${sql(schema)}.${sql(name)} ${sql(write)}
    on conflict (${sql(conflict)}) do update set ${sql(write)}
    returning ${sql(identity)}`;

  return {
    identity: String(out[identity]),
    added: !existing,
    changed: !!existing && existing.content_hash !== hash,
    hash,
  };
}

/**
 * Flag entities a source stopped listing as `unconfirmed`, never delete or
 * retire: the likely cause is a layout change, not a dead program.
 * `protected` rows are exempt.
 */

export async function markMissing(
  sql: Sql, table: string, identity: string, missing: string[],
): Promise<number> {
  if (!missing.length) return 0;
  const [schema, name] = qualify(table);
  const res = await sql`
    update ${sql(schema)}.${sql(name)} set
      lifecycle = 'unconfirmed',
      missing_since = coalesce(missing_since, now()),
      missing_runs = missing_runs + 1
    where ${sql(identity)} in ${sql(missing)}
      and protected = false
      and lifecycle <> 'retired'`;
  return res.count;
}

/** Rows awaiting a targeted recheck, with the URL to check them against. */
export async function unconfirmed(sql: Sql, table: string, identity: string): Promise<Row[]> {
  const [schema, name] = qualify(table);
  return (await sql`
    select * from ${sql(schema)}.${sql(name)}
    where lifecycle = 'unconfirmed' and protected = false
    order by missing_since asc nulls last
    limit 200`) as unknown as Row[];
}

export async function setLifecycle(
  sql: Sql, table: string, identity: string, id: string, lifecycle: "active" | "retired",
): Promise<void> {
  const [schema, name] = qualify(table);
  if (lifecycle === "active") {
    await sql`update ${sql(schema)}.${sql(name)} set
      lifecycle = 'active', missing_since = null, missing_runs = 0, last_verified = now()
      where ${sql(identity)} = ${id}`;
  } else {
    await sql`update ${sql(schema)}.${sql(name)} set
      lifecycle = 'retired', last_verified = now()
      where ${sql(identity)} = ${id} and protected = false`;
  }
}
