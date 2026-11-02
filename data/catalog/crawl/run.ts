/**
 * Weekly refresh — brings the shared catalogs up to date in Postgres.
 *
 *   bun run catalog:refresh                          # every topic with active sources
 *   bun run catalog:refresh distribution             # just one topic
 *   bun run catalog:refresh distribution <id>,<id>   # just these sources (tuning runs)
 *   bun run catalog:refresh --force                  # ignore cadence_days
 *
 * Only sources due by `cadence_days` (vs `last_ok_at`) are crawled; cadence is
 * data, never a second workflow. TinyFish first, Puppeteer fallback, per source.
 * Writes the workshop DB; nothing reaches an artist until `catalog:build`.
 */
import { connect, activeTopics } from "./db";
import { closeBrowser } from "./engine";
import { runTopic } from "./harness";
import type { Crawler, Trigger } from "./types";

const argv = process.argv.slice(2).filter((a) => a !== "--force");
const force = process.argv.includes("--force");
const only = argv[0];
const onlySources = argv[1]?.split(",").map((s) => s.trim()).filter(Boolean);
const trigger: Trigger = process.env.GITHUB_ACTIONS ? "schedule" : "manual";

const sql = connect();
let failed = false;

try {
  // Topics come from source rows, so adding a crawl needs no code change.
  const topics = only ? [only] : await activeTopics(sql, force);
  if (!topics.length) {
    console.log(force
      ? "No active sources in catalog.crawl_sources — nothing to refresh."
      : "Nothing due — every active source is inside its cadence_days. Use --force to override.");
  }

  for (const topic of topics) {
    let crawler: Crawler | undefined;
    try {
      crawler = ((await import(`../${topic}/crawl.ts`)) as { crawler?: Crawler }).crawler;
    } catch {
      console.warn(`[${topic}] no data/catalog/${topic}/crawl.ts — skipping`);
      continue;
    }
    if (!crawler) {
      console.warn(`[${topic}] crawl.ts exports no \`crawler\` — skipping`);
      continue;
    }

    console.log(`\n── ${topic} ──`);
    const report = await runTopic(sql, crawler, trigger, onlySources, force);
    for (const s of report.perSource) {
      console.log(`  ${s.id}: ${s.engine} → ${s.rows} rows${s.error ? `  ⚠ ${s.error}` : ""}`);
    }
    console.log(
      `  = ${report.seen} seen · ${report.added} new · ${report.changed} changed · ` +
      `${report.missing} now unconfirmed · ${report.restored} restored · ${report.retired} retired`,
    );

    // Every source failing fails the job, so the cron cannot go green on 0 rows.
    // One source failing is normal and stays non-fatal.

    const ran = report.perSource.length;
    const broke = report.perSource.filter((s) => s.error).length;
    if (ran > 0 && broke === ran) {
      failed = true;
      console.error(`  ✗ ${topic}: all ${ran} source(s) failed — not a healthy run`);
    }
  }
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  await closeBrowser();
  await sql.end();
}

process.exit(failed ? 1 : 0);
