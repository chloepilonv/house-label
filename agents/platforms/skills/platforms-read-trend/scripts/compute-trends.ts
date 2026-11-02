/**
 * Turn self-reported platform numbers into trend statements that hold.
 *
 *   bun run agents/platforms/skills/platforms-read-trend/scripts/compute-trends.ts
 *   bun run .../compute-trends.ts --days 30 --json
 *   bun run .../compute-trends.ts --demo        worked example, no database
 *
 * Code, not prose, because one rule must hold every time: a change smaller
 * than the platform's rounding (Instagram "89K", YouTube's 3 significant
 * figures) is not a change. The bucket width comes from `extra.precision`,
 * written by platforms-log-numbers; no bucket means exact.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt.
 */

// ── types ──────────────────────────────────────────────────────────────────

export type Point = {
  date: string;
  value: number;
  /** Width of the range the true value sits in. 1 = exact. */
  bucket: number;
};

export type Verdict = "grew" | "fell" | "flat" | "indistinguishable" | "insufficient";

export type Trend = {
  platform: string;
  metric: string;
  latest: Point;
  earliest: Point | null;
  windowDays: number;
  delta: number | null;
  pctChange: number | null;
  /** The coarser of the two readings — what the comparison can actually see. */
  resolution: number;
  verdict: Verdict;
  statement: string;
};

const METRIC_LABEL: Record<string, string> = {
  followers: "followers",
  subscribers: "subscribers",
  monthly_listeners: "monthly listeners",
  total_views: "views",
  total_plays: "plays",
  total_streams: "streams",
  purchases_total: "purchases",
};

const PLATFORM_LABEL: Record<string, string> = {
  spotify: "Spotify",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  x: "X",
  soundcloud: "SoundCloud",
  deezer: "Deezer",
  bandcamp: "Bandcamp",
  apple_music: "Apple Music",
};

const label = (p: string) => PLATFORM_LABEL[p] ?? p;
const n = (v: number) => v.toLocaleString("en-US");

// ── the rule ───────────────────────────────────────────────────────────────

/**
 * Compare the newest reading against the oldest one in the window.
 *
 * `resolution` is the coarser of the two buckets: comparing an exact reading
 * against a rounded one is only as good as the rounded one.
 */
/**
 * YYYY-MM-DD from whatever the driver hands back. A `date` column arrives as
 * a JS Date at local midnight, so `String(date)` would not sort.
 */
export function isoDay(v: unknown): string {
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return String(v).slice(0, 10);
}

export function assess(platform: string, metric: string, points: Point[], windowDays: number): Trend {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const earliest = sorted.length > 1 ? sorted[0] : null;
  const name = METRIC_LABEL[metric] ?? metric;

  const base: Omit<Trend, "delta" | "pctChange" | "verdict" | "statement" | "resolution"> = {
    platform,
    metric,
    latest,
    earliest,
    windowDays,
  };

  if (!earliest) {
    return {
      ...base,
      delta: null,
      pctChange: null,
      resolution: latest?.bucket ?? 1,
      verdict: "insufficient",
      statement: latest
        ? `${label(platform)}: ${n(latest.value)} ${name}. First reading — no trend yet, ask again in a week.`
        : `${label(platform)}: no readings yet.`,
    };
  }

  const resolution = Math.max(latest.bucket, earliest.bucket);
  const delta = latest.value - earliest.value;
  const pctChange = earliest.value === 0 ? null : (delta / earliest.value) * 100;

  // A delta inside the rounding bucket is not observable.
  if (resolution > 1 && Math.abs(delta) < resolution) {
    return {
      ...base,
      delta,
      pctChange,
      resolution,
      verdict: "indistinguishable",
      statement:
        `${label(platform)}: ${n(latest.value)} ${name}, unchanged on the reading ${windowDays} days ago. ` +
        `${label(platform)} rounds to the nearest ${n(resolution)} at this size, so a move of up to ` +
        `${n(resolution - 1)} would look identical. Not a plateau — just below what we can see.`,
    };
  }

  const verdict: Verdict = delta > 0 ? "grew" : delta < 0 ? "fell" : "flat";
  const direction = delta > 0 ? "up" : "down";
  const pct = pctChange === null ? "" : ` (${pctChange > 0 ? "+" : ""}${pctChange.toFixed(1)}%)`;

  const statement =
    verdict === "flat"
      ? `${label(platform)}: ${n(latest.value)} ${name}, exactly level over ${windowDays} days.`
      : `${label(platform)}: ${n(latest.value)} ${name}, ${direction} ${n(Math.abs(delta))}${pct} over ${windowDays} days.` +
        (resolution > 1 ? ` Rounded to the nearest ${n(resolution)}, so treat the exact figure as approximate.` : "");

  return { ...base, delta, pctChange, resolution, verdict, statement };
}

// ── milestones ─────────────────────────────────────────────────────────────

const STEPS = [100, 500, 1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

/**
 * A round number crossed between two readings, unless the rounding is too
 * coarse to tell.
 */
export function milestone(t: Trend): number | null {
  if (!t.earliest || t.delta === null || t.delta <= 0) return null;
  const crossed = STEPS.filter((s) => t.earliest!.value < s && t.latest.value >= s);
  if (!crossed.length) return null;
  const top = crossed[crossed.length - 1];
  // Suppress when the rounding is coarser than 1% of the milestone.
  return t.resolution > 1 && t.resolution > top * 0.01 ? null : top;
}

// ── reading the database ───────────────────────────────────────────────────

type StatRow = {
  platform: string;
  date: string;
  followers: number | null;
  subscribers: number | null;
  monthly_listeners: number | null;
  total_views: number | null;
  total_plays: number | null;
  total_streams: number | null;
  extra: Record<string, unknown> | null;
};

const COLUMNS = ["followers", "subscribers", "monthly_listeners", "total_views", "total_plays", "total_streams"] as const;

/** Pull the bucket platforms-log-numbers stored for this field; assume exact if absent. */
function bucketOf(extra: Record<string, unknown> | null, field: string): number {
  const p = (extra?.precision ?? {}) as Record<string, { bucket?: number }>;
  return p[field]?.bucket ?? 1;
}

export function trendsFromRows(rows: StatRow[], windowDays: number): Trend[] {
  const byPlatform = new Map<string, StatRow[]>();
  for (const r of rows) {
    if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, []);
    byPlatform.get(r.platform)!.push(r);
  }

  const out: Trend[] = [];
  for (const [platform, prows] of byPlatform) {
    for (const col of COLUMNS) {
      const points = prows
        .filter((r) => r[col] != null)
        .map((r) => ({ date: isoDay(r.date), value: Number(r[col]), bucket: bucketOf(r.extra, col) }));
      if (points.length) out.push(assess(platform, col, points, windowDays));
    }
    // Bandcamp's number lives in extra: it is purchases, not an audience size.
    const purchases = prows
      .filter((r) => typeof r.extra?.purchases_total === "number")
      .map((r) => ({ date: String(r.date).slice(0, 10), value: Number(r.extra!.purchases_total), bucket: 1 }));
    if (purchases.length) out.push(assess(platform, "purchases_total", purchases, windowDays));
  }
  return out;
}

async function fromDatabase(windowDays: number): Promise<Trend[]> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("✗ Set DATABASE_URL (see doc/DEVELOPMENT.md), or run with --demo.");
    process.exit(1);
  }
  const { default: postgres } = await import("postgres");
  const sql = postgres(dbUrl, { onnotice: () => {} });
  try {
    const rows = await sql<StatRow[]>`
      select platform, date, followers, subscribers, monthly_listeners,
             total_views, total_plays, total_streams, extra
        from artist.platform_stats
       where date >= current_date - ${windowDays}::int
       order by platform, date
    `;
    return trendsFromRows(rows as unknown as StatRow[], windowDays);
  } finally {
    await sql.end();
  }
}

// ── a worked example, so the rule is visible without a database ────────────

const DEMO: StatRow[] = [
  // Rounded at 89K: a real gain of 700 is invisible.
  { platform: "instagram", date: "2026-07-15", followers: 89_000, subscribers: null, monthly_listeners: null, total_views: null, total_plays: null, total_streams: null, extra: { precision: { followers: { bucket: 1000 } } } },
  { platform: "instagram", date: "2026-08-14", followers: 89_000, subscribers: null, monthly_listeners: null, total_views: null, total_plays: null, total_streams: null, extra: { precision: { followers: { bucket: 1000 } } } },
  // Exact: every one of the 412 shows up.
  { platform: "soundcloud", date: "2026-07-15", followers: 4_120, subscribers: null, monthly_listeners: null, total_views: null, total_plays: null, total_streams: null, extra: { precision: { followers: { bucket: 1 } } } },
  { platform: "soundcloud", date: "2026-08-14", followers: 4_532, subscribers: null, monthly_listeners: null, total_views: null, total_plays: null, total_streams: null, extra: { precision: { followers: { bucket: 1 } } } },
  // Rounded, but the move clears the bucket.
  { platform: "spotify", date: "2026-07-15", followers: null, subscribers: null, monthly_listeners: 8_800, total_views: null, total_plays: null, total_streams: null, extra: { precision: { monthly_listeners: { bucket: 100 } } } },
  { platform: "spotify", date: "2026-08-14", followers: null, subscribers: null, monthly_listeners: 12_400, total_views: null, total_plays: null, total_streams: null, extra: { precision: { monthly_listeners: { bucket: 100 } } } },
];

// ── CLI ────────────────────────────────────────────────────────────────────

function report(trends: Trend[]): string {
  if (!trends.length) return "No readings yet. Log one with platforms-log-numbers first.";

  const lines: string[] = [];
  const moved = trends.filter((t) => t.verdict === "grew" || t.verdict === "fell");
  const hidden = trends.filter((t) => t.verdict === "indistinguishable");
  const rest = trends.filter((t) => !moved.includes(t) && !hidden.includes(t));

  for (const t of [...moved, ...hidden, ...rest]) {
    lines.push(`  ${t.statement}`);
    const m = milestone(t);
    if (m) lines.push(`    ★ crossed ${n(m)} ${METRIC_LABEL[t.metric] ?? t.metric} in this window.`);
  }
  return lines.join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const asJson = argv.includes("--json");
  const daysArg = argv.indexOf("--days");
  const windowDays = daysArg >= 0 ? parseInt(argv[daysArg + 1] ?? "30", 10) : 30;

  const trends = argv.includes("--demo") ? trendsFromRows(DEMO, 30) : await fromDatabase(windowDays);

  if (asJson) {
    console.log(JSON.stringify(trends, null, 2));
  } else {
    console.log(`\nLast ${windowDays} days\n`);
    console.log(report(trends));
    console.log();
  }
}
