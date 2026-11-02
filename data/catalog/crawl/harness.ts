import type { Sql } from "postgres";
import { extractFromSource, stillLive } from "./engine";
import {
  loadSources, recordSourceResult, startRun, finishRun, observe, expectedFrom,
  upsertRow, markMissing, unconfirmed, setLifecycle,
} from "./db";
import type { Crawler, CrawlReport, SourceResult, Trigger } from "./types";

/** After this many CONFIRMED misses a row is retired. Never on the first. */
const RETIRE_AFTER_MISSES = 2;

/**
 * Run one topic: extract every active source, upsert, then reconcile misses.
 * Order matters: everything seen is written first, so a row another source
 * still lists is never counted missing.
 */
export async function runTopic(
  sql: Sql, crawler: Crawler, trigger: Trigger = "schedule", onlySources?: string[],
  force = false,
): Promise<CrawlReport> {
  const runId = await startRun(sql, crawler.topic, trigger);
  const report: CrawlReport = {
    topic: crawler.topic, runId, perSource: [],
    seen: 0, added: 0, changed: 0, missing: 0, retired: 0, restored: 0,
  };

  // Optional id filter for tuning runs. Safe because missing-row logic is per
  // source. An explicit filter implies force, so cadence never skips it.
  const sources = (await loadSources(sql, crawler.topic, "index", force || !!onlySources)).filter(
    (s) => !onlySources || onlySources.includes(s.id),
  );
  const seenAll = new Set<string>();

  for (const source of sources) {
    const result: SourceResult = { id: source.id, engine: "none", rows: 0 };
    try {
      const { engine, extracted } = await extractFromSource(sql, source, crawler);
      result.engine = engine;

      // An empty extraction is our failure, not evidence: skip reconciliation,
      // or every row this source surfaced would be marked unconfirmed.
      if (extracted == null) {
        result.error = "no engine returned data";
        await recordSourceResult(sql, source.id, false, 0, result.error);
        report.perSource.push(result);
        continue;
      }
      const rows = crawler.toRows(extracted, source, engine);

      const seenHere: string[] = [];
      const obs = [];
      for (const row of rows) {
        const r = await upsertRow(sql, crawler.table, crawler.conflict, crawler.identity, row);
        seenHere.push(r.identity);
        seenAll.add(r.identity);
        if (r.added) report.added++;
        if (r.changed) report.changed++;
        obs.push({ entity_slug: r.identity, source_id: source.id, seen: true, content_hash: r.hash });
      }
      result.rows = rows.length;
      report.seen += rows.length;

      // Rows this source used to surface and no longer does. Per source, so one
      // broken page never affects another source's rows.
      const expected = await expectedFrom(sql, source.id);
      const gone = expected.filter((slug) => !seenHere.includes(slug) && !seenAll.has(slug));
      for (const slug of gone) obs.push({ entity_slug: slug, source_id: source.id, seen: false });

      await observe(sql, runId, crawler.topic, obs);
      report.missing += await markMissing(sql, crawler.table, crawler.identity, gone);
      await recordSourceResult(sql, source.id, true, rows.length);
    } catch (e) {
      result.error = (e as Error).message;
      await recordSourceResult(sql, source.id, false, 0, result.error);
    }
    report.perSource.push(result);
  }

  const { retired, restored } = await recheckMissing(sql, crawler, runId);
  report.retired = retired;
  report.restored = restored;

  await finishRun(sql, runId, {
    sources_ok: report.perSource.filter((s) => !s.error).length,
    sources_failed: report.perSource.filter((s) => s.error).length,
    rows_seen: report.seen,
    rows_new: report.added,
    rows_changed: report.changed,
    rows_missing: report.missing,
    summary: sql.json({ retired: report.retired, restored: report.restored }) as never,
  });

  return report;
}

/**
 * Recheck missing rows on their own page. An index dropping a row is weak
 * evidence; a restore means our extractor broke, and is logged as such.
 * Retired only after RETIRE_AFTER_MISSES confirmed 404s, never if `protected`
 * or without a detail URL.
 */

async function recheckMissing(
  sql: Sql, crawler: Crawler, runId: string,
): Promise<{ retired: number; restored: number }> {
  if (!crawler.detailUrl) return { retired: 0, restored: 0 };

  const rows = await unconfirmed(sql, crawler.table, crawler.identity);
  let retired = 0, restored = 0;
  const obs = [];

  for (const row of rows) {
    const url = crawler.detailUrl(row);
    if (!url) continue;                      // unverifiable — flagged, never retired
    const id = String(row[crawler.identity]);
    const live = await stillLive(url);

    if (live === true) {
      await setLifecycle(sql, crawler.table, crawler.identity, id, "active");
      restored++;
      obs.push({ entity_slug: id, source_id: null, seen: true, changed: { recheck: "restored — index dropped it but its own page is live" } });
    } else if (live === false && Number(row.missing_runs ?? 0) >= RETIRE_AFTER_MISSES) {
      await setLifecycle(sql, crawler.table, crawler.identity, id, "retired");
      retired++;
      obs.push({ entity_slug: id, source_id: null, seen: false, changed: { recheck: "retired — own page returns 404/410" } });
    }
    // live === null is inconclusive: leave it unconfirmed and try again next week.
  }

  await observe(sql, runId, crawler.topic, obs);
  return { retired, restored };
}
