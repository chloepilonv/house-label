/**
 * Markdown recap of the last crawl run for the cron's digest: new, changed,
 * failing sources, and field completeness. No model, no network.
 *

 *   bun run catalog:report [topic]
 */
import postgres from "postgres";

const dbUrl = process.env.CATALOG_DATABASE_URL;
if (!dbUrl) { console.error("✗ Set CATALOG_DATABASE_URL (see doc/DEVELOPMENT.md)."); process.exit(1); }
const sql = postgres(dbUrl, { max: 1 });
const topic = process.argv[2] ?? "distribution";

const [run] = await sql<{ started_at: Date; finished_at: Date | null; rows_seen: number; rows_new: number;
  rows_changed: number; rows_missing: number; sources_ok: number; sources_failed: number; summary: Record<string, number> }[]>`
  select started_at, finished_at, rows_seen, rows_new, rows_changed, rows_missing,
         sources_ok, sources_failed, summary
  from catalog.crawl_runs where topic = ${topic} order by started_at desc limit 1`;

const failing = await sql<{ id: string; last_error: string; consecutive_failures: number }[]>`
  select id, coalesce(last_error, 'no data returned') as last_error, consecutive_failures
  from catalog.crawl_sources
  where topic = ${topic} and status = 'active' and consecutive_failures > 0
  order by consecutive_failures desc, id limit 10`;

const [pages] = await sql<{ n: number; unchanged: number; models: string }[]>`
  select count(*)::int n,
    count(*) filter (where derived_at >= fetched_at)::int unchanged,
    coalesce(string_agg(distinct derived_model, ', '), 'n/a') as models
  from catalog.crawl_pages`;

const out: string[] = [];
out.push(`## Catalog refresh — ${topic}`, "");
if (run) {
  const mins = run.finished_at ? Math.round((+new Date(run.finished_at) - +new Date(run.started_at)) / 60000) : null;
  out.push(`**This run:** ${run.rows_new} new · ${run.rows_changed} changed · ${run.rows_missing} now unconfirmed · ` +
    `${run.summary?.retired ?? 0} retired · ${run.summary?.restored ?? 0} restored`);
  out.push(`**Sources:** ${run.sources_ok} ok · ${run.sources_failed} failed${mins !== null ? ` · ${mins} min` : ""}`, "");
} else {
  out.push("_No run recorded yet._", "");
}
out.push(`**Raw layer:** ${pages.n} pages stored · extraction model(s): ${pages.models}`, "");
if (failing.length) {
  out.push("### Sources needing attention", "", "| Source | Consecutive failures | Last error |", "|---|---|---|");
  for (const s of failing) out.push(`| \`${s.id}\` | ${s.consecutive_failures} | ${s.last_error.slice(0, 90)} |`);
  out.push("");
}
out.push("_A failed source never retires rows: the catalogue is only ever added to by a bad run, never emptied._");

console.log(out.join("\n"));
await sql.end();
