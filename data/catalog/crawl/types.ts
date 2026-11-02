
/**
 * Which engine produced a source's data this run.
 *   fetch     — TinyFish Fetch (free) → markdown → Claude extracts. The default.
 *   tinyfish  — TinyFish agent session; bills per run. For JS apps, WAFs, filters.
 *   puppeteer — hand-written per-source fallback.
 */
export type EngineUsed = "fetch" | "tinyfish" | "puppeteer" | "none";

export type Row = Record<string, unknown>;

/** One source row of catalog.crawl_sources (rows, so the crawler can add sources). */
export interface SourceRow {
  id: string;
  topic: string;
  url: string;
  kind: "index" | "detail" | "api" | "feed";
  scope: Record<string, unknown>;
  /** { tinyfishQuery?: string, waitFor?: string, … } — config, not code. */
  extraction: Record<string, unknown>;
  status: "active" | "pending_review" | "paused" | "dead";
  consecutive_failures: number;
  /** Days between re-reads. */
  cadence_days: number;
}

/**
 * Each crawled dataset exports one of these from data/catalog/<topic>/crawl.ts.
 * URLs live in catalog.crawl_sources, not here. Changing which artifacts a
 * dataset needs? Update the dataset step of
 * agents/agent-recruitor/skills/recruit-research/SKILL.md in the same commit.
 */
export interface Crawler {
  /** Matches catalog.crawl_sources.topic and the folder name. */
  topic: string;
  /** Fully qualified target, e.g. "catalog.distribution_services". */
  table: string;
  /** Natural key for upserts, e.g. ["funder_id", "name"]. */
  conflict: string[];
  /**
   * Column holding the row's stable text identity (what artist.* rows point at).
   * Read back after upsert so the slug logic lives only in the schema.
   */
  identity: string;
  /**
   * Zod schema wrapping the array, e.g. z.object({ programs: z.array(...) }).
   * Required by the `fetch` engine; the agent engine uses `tinyfishQuery`.
   */
  schema?: import("zod").ZodType;
  /** Map extracted data into rows of `table`. */
  toRows: (extracted: unknown, source: SourceRow, engine: EngineUsed) => Row[];
  /** The row's own page, rechecked when an index stops listing it. null: never auto-retired. */

  detailUrl?: (row: Row) => string | null;
  /** Per-source Puppeteer fallbacks, keyed by catalog.crawl_sources.id. */
  puppeteer?: Record<string, (page: import("puppeteer").Page) => Promise<unknown>>;
}

export interface SourceResult {
  id: string;
  engine: EngineUsed;
  rows: number;
  error?: string;
}

export interface CrawlReport {
  topic: string;
  runId: string;
  perSource: SourceResult[];
  seen: number;
  added: number;
  changed: number;
  missing: number;
  retired: number;
  restored: number;
}

export type Trigger = "schedule" | "manual" | "recheck";

