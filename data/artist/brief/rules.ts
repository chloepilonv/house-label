/**
 * What each department gets told about the artist, and how it is shaped.
 * The selection rules live here, in code, so two runs give the same brief.
 * client.ts is the plumbing; editing rules must not break it.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Artist, MemoryRow } from "../client";
import { readMembers, renderMembers } from "../members";

// ── shape ──────────────────────────────────────────────────────────────────

export interface Section {
  heading: string;
  lines: string[];
  /** Printed when there are no lines. A section is never omitted silently. */
  empty: string;
}

export interface Brief {
  agent: string;
  sections: Section[];
}

/** A department's rule: given the database, produce its sections. */
export type Rule = (artist: Artist, opts: BriefOpts) => Promise<Section[]>;

export interface BriefOpts {
  /** Force the focus release instead of letting the rule pick. */
  releaseId?: string;
  /** Today, injectable so the tests are not calendar-dependent. */
  today?: Date;
}

// ── shared helpers ─────────────────────────────────────────────────────────

type Release = {
  id: string;
  title: string;
  release_type: string;
  release_date: string | Date | null;
  upc: string | null;
  label: string | null;
  distributor: string | null;
};

const iso = (d: string | Date | null | undefined): string | null =>
  d == null ? null : (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);

/**
 * The current presskit deck: the `presskit_versions` row named by
 * `presskit.current_version`, not the newest row (a failed republish leaves a
 * newer row that is not current). Null means none was ever generated.
 */
async function currentDeck(
  artist: Artist,
  kit: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  const v = kit?.current_version;
  if (v == null) return null;
  const rows = await artist.query<Record<string, unknown>>(
    "presskit_versions",
    { version: v },
    { limit: 1 },
  );
  return rows[0] ?? null;
}

/**
 * The artist's own material a campaign builds content from: quotes, awards,
 * discography, brand colours. Pure, so it is testable without a database.
 */
export function dossierLines(input: {
  kit?: Record<string, unknown> | null;
  items?: Record<string, unknown>[];
  releases?: { title: string; release_type: string; release_date: string | Date | null }[];
  songCount?: number;
}): string[] {
  const kit = input.kit ?? null;
  const items = input.items ?? [];
  const releases = input.releases ?? [];
  const of = (kind: string) =>
    items.filter((i) => i.kind === kind).map((i) => (i.data ?? {}) as Record<string, unknown>);

  const quotes = of("quote");
  const awards = of("award");
  const shows = of("show");
  const colours = (kit?.visual_identity ?? {}) as Record<string, string>;

  return [
    kit?.short_bio ? `Bio: ${String(kit.short_bio).replace(/\s+/g, " ").slice(0, 300)}` : null,
    input.songCount ? `${input.songCount} songs in the catalogue` : null,
    releases.length
      ? `Discography: ${releases.map((r) => `${r.title} (${r.release_type}${iso(r.release_date) ? `, ${iso(r.release_date)!.slice(0, 4)}` : ""})`).join("; ")} — callbacks to these are content nobody has to shoot.`
      : null,
    quotes.length
      ? `Press quotes usable as social proof: ${quotes.slice(0, 3).map((q) => `"${String(q.text ?? "").slice(0, 90)}" — ${q.source ?? "unattributed"}`).join(" · ")}`
      : null,
    awards.length
      ? `Awards worth citing: ${awards.slice(0, 3).map((a) => `${a.title}${a.organization ? ` (${a.organization})` : ""}${a.year ? ` ${a.year}` : ""}`).join(" · ")}`
      : null,
    shows.length
      ? `Recent or upcoming shows: ${shows.slice(0, 3).map((sh) => `${sh.venue ?? "?"}${sh.city ? `, ${sh.city}` : ""}${sh.date ? ` (${sh.date})` : ""}`).join(" · ")}`
      : null,
    Object.keys(colours).length
      ? `Brand colours — name the hex inside every content brief: ${Object.entries(colours).map(([k, v]) => `${k} ${v}`).join(", ")}`
      : null,
    kit?.moodboard_notes ? `Visual direction: ${String(kit.moodboard_notes).replace(/\s+/g, " ").slice(0, 200)}` : null,
  ].filter(Boolean) as string[];
}

/**
 * Which release the department is working on:
 *   1. an explicit id, if passed
 *   2. the soonest release still ahead of today (nearest, not furthest)
 *   3. failing that, the most recent past release
 * Undated rows are drafts and never the focus.
 */
export function pickFocusRelease(
  releases: Release[],
  opts: { releaseId?: string; today?: Date } = {},
): Release | null {
  if (opts.releaseId) return releases.find((r) => r.id === opts.releaseId) ?? null;

  const today = iso(opts.today ?? new Date())!;
  const dated = releases.filter((r) => iso(r.release_date) !== null);

  const upcoming = dated
    .filter((r) => iso(r.release_date)! >= today)
    .sort((a, b) => iso(a.release_date)!.localeCompare(iso(b.release_date)!));
  if (upcoming.length) return upcoming[0]!;

  const past = dated.sort((a, b) => iso(b.release_date)!.localeCompare(iso(a.release_date)!));
  return past[0] ?? null;
}

/**
 * Turn platform_latest rows into citable traction lines. Null (never read)
 * and zero (nothing to cite) are both dropped; neither belongs in a pitch.
 */
export function tractionLines(rows: Record<string, unknown>[]): string[] {
  const METRICS: [string, string][] = [
    ["monthly_listeners", "monthly listeners"],
    ["subscribers", "subscribers"],
    ["followers", "followers"],
    ["total_streams", "total streams"],
    ["total_plays", "plays"],
    ["total_views", "views"],
  ];

  const out: { line: string; value: number; primary: boolean }[] = [];
  for (const row of rows) {
    for (const [col, label] of METRICS) {
      const v = row[col];
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || n <= 0) continue;
      out.push({
        line: `${row.platform}: ${n.toLocaleString("en-CA")} ${label} (read ${iso(row.stats_date as string) ?? "date unknown"})`,
        value: n,
        primary: row.is_primary === true,
      });
    }
  }

  // Primary platform first, then by magnitude. Capped at three.
  return out
    .sort((a, b) => Number(b.primary) - Number(a.primary) || b.value - a.value)
    .slice(0, 3)
    .map((m) => m.line);
}

/** The block every department gets. Only facts that are true regardless of job. */
export async function coreSection(artist: Artist): Promise<Section> {
  const p = await artist.one<Record<string, unknown>>("profile");
  if (!p) return { heading: "Artist", lines: [], empty: "No profile yet — ask for it before anything else." };

  const arr = (v: unknown) => (Array.isArray(v) && v.length ? v.join(", ") : null);
  const members = readMembers(p.members);
  const lines = [
    p.artist_name ? `Name: ${p.artist_name}` : null,
    // Names, not a count: pitches, riders and grant forms need the names.
    members.length ? `Members: ${renderMembers(members)}` : null,
    [p.city, p.region, p.country].filter(Boolean).join(", ") ? `Based: ${[p.city, p.region, p.country].filter(Boolean).join(", ")}` : null,
    // Where they sell, which differs from where they live.
    arr(p.target_markets) ? `Markets: ${arr(p.target_markets)}` : null,
    arr(p.genres) ? `Genres: ${arr(p.genres)}` : null,
    p.career_stage ? `Stage: ${p.career_stage}` : null,
    `Writes in: ${p.preferred_locale ?? "en"}`,
    arr(p.citizenship) ? `Citizenship: ${arr(p.citizenship)}` : null,
  ].filter(Boolean) as string[];

  return { heading: "Artist", lines, empty: "Profile row exists but is empty." };
}

/** One verbatim excerpt of something the artist wrote. */
export interface VoiceSample {
  lang?: string | null;
  context?: string | null;
  text: string;
}

/** Sample count and length cap. More samples make a drafter paraphrase. */
export const VOICE_SAMPLES_MAX = 4;
export const VOICE_SAMPLE_CHARS = 600;

/**
 * How the artist writes, shaped for a drafter. Pure. The guide passes through
 * as-is; samples are cut, never reworded. Samples in the requested language
 * come first, since drafting from another language copies the wrong habits.
 */
export function voiceLines(
  row: { guide?: string | null; samples?: unknown; source?: string | null } | null | undefined,
  opts: { lang?: string | null } = {},
): string[] {
  if (!row?.guide?.trim()) return [];
  const all = (Array.isArray(row.samples) ? row.samples : []).filter(
    (x): x is VoiceSample => !!x && typeof x === "object" && typeof (x as VoiceSample).text === "string" && !!(x as VoiceSample).text.trim(),
  );
  const want = opts.lang?.slice(0, 2).toLowerCase();
  const ranked = want ? [...all.filter((x) => x.lang?.slice(0, 2).toLowerCase() === want), ...all.filter((x) => x.lang?.slice(0, 2).toLowerCase() !== want)] : all;
  const samples = ranked.slice(0, VOICE_SAMPLES_MAX).map((x) => {
    const text = x.text.trim().replace(/\s*\n\s*/g, " / ");
    const cut = text.length > VOICE_SAMPLE_CHARS ? text.slice(0, VOICE_SAMPLE_CHARS - 1) + "…" : text;
    const tag = [x.lang, x.context].filter(Boolean).join(", ");
    return `Sample${tag ? ` (${tag})` : ""}: "${cut}"`;
  });
  return [
    // Strip bullets and headings: the brief adds its own bullets.
    ...row.guide.trim().split(/\r?\n/).map((l) => l.trim().replace(/^(?:[-*•]|#+)\s+/, "")).filter(Boolean),
    ...samples,
    row.source ? `Learned from: ${row.source}` : null,
  ].filter(Boolean) as string[];
}

/** Every department gets this: everything drafted is signed by the artist. */
export async function voiceSection(artist: Artist): Promise<Section> {
  const row = await artist.one<Record<string, unknown>>("voice");
  const p = await artist.one<{ preferred_locale?: string }>("profile");
  return {
    heading: "Voice — write every draft the way the artist writes",
    lines: voiceLines(row as never, { lang: p?.preferred_locale }),
    empty:
      "No voice guide yet. Drafts will read as generic — say so once, and tell the artist " +
      "`houselabel voice` learns how they write from emails they have sent.",
  };
}

/** What this agent has learned before. The other half of "ask once". */
export async function memorySection(artist: Artist, agent: string): Promise<Section> {
  const rows = await artist.recall(agent);
  return {
    heading: "Remembered",
    lines: rows.map((m: MemoryRow) => `${m.key}${m.agent === "shared" ? " (shared)" : ""}: ${m.value}`),
    empty: "Nothing remembered yet for this department.",
  };
}

// ── the departments ────────────────────────────────────────────────────────

/** The Press Agent. The reference implementation for other departments. */
const press: Rule = async (artist, opts) => {
  const releases = await artist.query<Release>("releases", {}, { orderBy: "release_date desc", limit: 20 });
  const focus = pickFocusRelease(releases, opts);

  const releaseSection: Section = {
    heading: "Focus release",
    lines: focus
      ? ([
          `${focus.title} (${focus.release_type})`,
          iso(focus.release_date) ? `Date: ${iso(focus.release_date)}` : "Date: NOT SET",
          focus.label ? `Label: ${focus.label}` : null,
          focus.distributor ? `Distributor: ${focus.distributor}` : null,
        ].filter(Boolean) as string[])
      : [],
    empty: "No releases on file. The pitch needs [RELEASE TITLE] and [RELEASE DATE] as placeholders.",
  };

  const traction: Section = {
    heading: "Traction worth citing",
    lines: tractionLines(await artist.query("platform_latest", {}, { limit: 20 })),
    empty: "No non-zero numbers reported. Cite none rather than inventing one.",
  };

  const kit = await artist.one<Record<string, unknown>>("presskit");
  const deck = await currentDeck(artist, kit);
  const presskit: Section = {
    heading: "Presskit",
    lines: [
      deck?.presentation_url ? `Deck: ${deck.presentation_url}` : null,
      deck?.pdf_url ? `PDF: ${deck.pdf_url}` : null,
      kit?.short_bio ? `Short bio: on file (${String(kit.short_bio).length} chars)` : null,
    ].filter(Boolean) as string[],
    empty: "No presskit generated — the pitch cannot link to one.",
  };

  // The campaign for this release, not merely the newest active one.
  const campaigns = await artist.query<Record<string, unknown>>(
    "press_campaigns",
    { status: "active", ...(focus ? { release_id: focus.id } : {}) },
    { orderBy: "created_at desc", limit: 1 },
  );
  const campaign = campaigns[0] ?? null;

  const pipeline: Section = { heading: "Campaign", lines: [], empty: "No active campaign for this release." };
  if (campaign) {
    const pitches = await artist.query<Record<string, unknown>>(
      "press_pitches",
      { campaign_id: campaign.id as string },
      { limit: 500 },
    );
    const byStatus = pitches.reduce<Record<string, number>>((acc, p) => {
      const s = String(p.status);
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});

    pipeline.lines = [
      `Name: ${campaign.name}`,
      String(campaign.pitch ?? "").trim()
        ? `Master pitch: WRITTEN — adapt it, do not write a competing one.`
        : `Master pitch: not written yet.`,
      Array.isArray(campaign.target_markets) && campaign.target_markets.length
        ? `Markets: ${(campaign.target_markets as string[]).join(", ")}`
        : null,
      pitches.length
        ? `Pipeline: ${Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(", ")}`
        : "Pipeline: nothing pitched yet.",
      // `opened` is in the status enum but nothing ever sets it.
      byStatus.opened ? `NOTE: 'opened' is never set by any skill — do not report open rates.` : null,
    ].filter(Boolean) as string[];
  }

  return [releaseSection, traction, presskit, pipeline];
};

/**
 * Share totals that are not 100 are a warning, not an error: catalogs are
 * imported incomplete, so `song_share_totals` is a view, not a constraint.
 * An empty side is reported apart from one that does not add up (different fix).
 */
export function shareWarnings(
  totals: { title: string; writer_total: string | number; master_total: string | number }[],
): { missing: string[]; off: string[] } {
  const missing: string[] = [];
  const off: string[] = [];
  for (const t of totals) {
    const w = Number(t.writer_total);
    const m = Number(t.master_total);
    if (w === 0 && m === 0) missing.push(`${t.title} — no writers and no master splits`);
    else if (w === 0) missing.push(`${t.title} — no writer shares (composition side unclaimed)`);
    else if (m === 0) missing.push(`${t.title} — no master splits (recording side unclaimed)`);
    else if (w !== 100 || m !== 100) off.push(`${t.title} — writers ${w}%, master ${m}%`);
  }
  return { missing, off };
}

/**
 * Two Canadian performer societies at once (double representation) blocks the
 * neighbouring-rights money until resolved with both. ACTRA RACS, Artisti and
 * Re:Sound direct are mutually exclusive; Panorama is producer-side, so excluded.
 */
export const CA_PERFORMER_SOCIETIES = ["actra_racs", "artisti", "resound"];

export function doubleRepresentation(regs: { org_slug: string; status: string }[]): string[] {
  const live = regs.filter(
    (r) => r.status !== "not_started" && CA_PERFORMER_SOCIETIES.includes(r.org_slug),
  );
  if (live.length < 2) return [];
  return [
    `${live.map((r) => r.org_slug).sort().join(" + ")} — two Canadian performer societies at once. ` +
      "This is double representation: the neighbouring-rights money is BLOCKED, not split, " +
      "until it is resolved with both. Only one of ACTRA RACS, Artisti or Re:Sound direct.",
  ];
}

/** The Rights Agent. */
/** The societies that withhold 30% from a non-US payee without a W-8BEN. */
const US_ORGS = new Set(["ascap", "bmi", "sesac", "soundexchange", "the-mlc", "mlc", "harry-fox", "hfa", "afm-sag-aftra-fund", "cmrra-us"]);

const rights: Rule = async (artist) => {
  const profile = await artist.one<Record<string, unknown>>("profile");

  const regs = await artist.query<{
    org_slug: string;
    status: string;
    member_id: string | null;
    saved_org_name: string | null;
    tax_form_filed: boolean;
    org_details: Record<string, unknown> | null;
  }>("registrations", {}, { limit: 100 });

  // The IPI is issued by the first society joined, so it is stored on that
  // registration's org_details, not on the profile.
  const ipi = regs.map((r) => r.org_details?.ipi_number).find(Boolean);
  const identifiers: Section = {
    heading: "Identifiers",
    lines: [
      ipi ? `IPI: ${ipi}` : "IPI: NOT ON FILE — every society asks for it. It comes from the first one joined.",
      profile?.country ? `Country: ${profile.country}` : "Country: NOT ON FILE — it decides which societies apply.",
    ],
    empty: "No profile yet.",
  };

  const registrations: Section = {
    heading: "Registrations",
    lines: [
      // Double representation goes first: it blocks all master-side money.
      ...doubleRepresentation(regs).map((w) => `⚠ ${w}`),
      ...regs.map((r) => {
        const name = r.saved_org_name ?? r.org_slug;
        const id = r.member_id ? ` · member ${r.member_id}` : "";
        // US orgs only: without a W-8BEN the payout is withheld at 30%.
        const tax = r.status === "registered" && !r.tax_form_filed && US_ORGS.has(r.org_slug) ? " · tax form NOT filed" : "";
        return `[${r.status}] ${name}${id}${tax}`;
      }),
    ],
    empty: "Nothing registered. Start with the artist's home-country PRO.",
  };

  const totals = await artist.query<{ title: string; writer_total: string; master_total: string }>(
    "song_share_totals",
    {},
    { limit: 500 },
  );
  const { missing, off } = shareWarnings(totals);

  const hygiene: Section = {
    heading: "Catalog hygiene",
    lines: totals.length
      ? ([
          `${totals.length} song${totals.length === 1 ? "" : "s"} on file.`,
          ...missing.slice(0, 5),
          ...off.slice(0, 5),
          missing.length + off.length > 10 ? `…and ${missing.length + off.length - 10} more.` : null,
          missing.length || off.length
            ? "Share totals are warnings, not errors — the schema allows partial imports on purpose."
            : "Every song has both sides totalling 100%.",
        ].filter(Boolean) as string[])
      : [],
    empty: "No songs on file. Import the catalog before recommending registrations.",
  };

  return [identifiers, registrations, hygiene];
};

/** The Digital Marketing Agent. */
const digitalMarketing: Rule = async (artist, opts) => {
  const today = iso(opts.today ?? new Date())!;
  const active = await artist.query<Record<string, unknown>>(
    "marketing_campaigns",
    {},
    { orderBy: "target_date desc", limit: 10 },
  );
  const live = active.filter((c) => ["draft", "qa", "generating", "active", "paused"].includes(String(c.status)));

  const campaign: Section = {
    heading: "Campaign",
    lines: [],
    empty: "No campaign in progress. Intake comes before a plan.",
  };

  if (live[0]) {
    const c = live[0];
    const tasks = await artist.query<Record<string, unknown>>(
      "marketing_tasks",
      { campaign_id: c.id as string },
      { orderBy: "due_date asc", limit: 500 },
    );
    const done = tasks.filter((t) => t.status === "done").length;
    const overdue = tasks.filter((t) => t.status !== "done" && t.status !== "skipped" && iso(t.due_date)! < today);
    const spend = tasks.reduce((n, t) => n + Number(t.estimated_cost ?? 0), 0);

    campaign.lines = [
      `${c.title} (${c.project_type}) — ${c.status}`,
      c.target_date ? `Target: ${iso(c.target_date)}` : "Target date NOT SET.",
      Array.isArray(c.platforms) && c.platforms.length ? `Platforms: ${(c.platforms as string[]).join(", ")}` : null,
      tasks.length ? `Tasks: ${done}/${tasks.length} done` : "No tasks materialized yet.",
      overdue.length ? `${overdue.length} OVERDUE — oldest ${iso(overdue[0]!.due_date)}` : null,
      // The plan's stated total must match the tasks' sum.
      c.total_estimated_cost != null
        ? `Budget: plan says ${c.total_estimated_cost}, tasks sum to ${spend.toFixed(2)}${
            Math.abs(Number(c.total_estimated_cost) - spend) > 0.01 ? " — THESE DISAGREE, reconcile before planning" : ""
          }`
        : null,
      Array.isArray(c.key_messages) && c.key_messages.length
        ? `Key messages already set: ${(c.key_messages as string[]).join(" · ")} — the press pitch carries these, don't invent a competing angle.`
        : null,
    ].filter(Boolean) as string[];
  }

  const traction: Section = {
    heading: "Where the audience is",
    lines: tractionLines(await artist.query("platform_latest", {}, { limit: 20 })),
    empty: "No platform numbers on file — a plan cannot be aimed at a platform nobody has measured.",
  };

  // ── the dossier ──
  // The artist's own material, so content briefs are specific, not generic.
  const [kit] = await artist.query<Record<string, unknown>>("presskit", { id: 1 });
  const items = await artist.query<Record<string, unknown>>("presskit_items", {}, { limit: 60 });

  const releases = await artist.query<Release>("releases", {}, { orderBy: "release_date desc", limit: 6 });
  const [songs] = await artist.query<{ n: string }>("songs", {}, { limit: 1 }).then(async (r) =>
    r.length ? [{ n: String((await artist.query("songs", {}, { limit: 500 })).length) }] : [],
  );


  const dossier: Section = {
    heading: "What the campaign has to work with",
    lines: dossierLines({ kit, items, releases, songCount: Number(songs?.n ?? 0) }),
    empty:
      "Nothing in the presskit yet — no bio, no quotes, no awards, no brand colours. " +
      "The plan can still be written, but every content brief will be generic and it is worth saying so: " +
      "the Presskit Agent fills this, and it is the cheapest thing the artist can do to make the content specific.",
  };

  const website: Section = {
    heading: "Website",
    lines: websiteLines(await artist.one<Record<string, unknown>>("website", { id: 1 })),
    empty: "No website yet. `bun run website:build` renders a preview from what is on file; nothing to ask first.",
  };

  return [campaign, traction, dossier, website];
};

/**
 * The website row: live or not, stale or not, and which link-outs are blank.
 * Every blank names the command that fills it.
 */
export function websiteLines(row: Record<string, unknown> | null): string[] {
  if (!row) return [];
  const built = iso(row.last_built_at as string | null);
  const deployed = iso(row.last_deployed_at as string | null);
  const lines = [
    row.vercel_url ? `Live: ${row.vercel_url}${row.domain ? ` (domain ${row.domain})` : ""}` : "Not deployed yet.",
    built ? `Last built ${built}${deployed ? `, deployed ${deployed}` : ", never deployed"}` : "Never built.",
    built && deployed && built > deployed ? "Built AFTER the last deploy — the live site is behind. `bun run website:deploy`." : null,
  ];
  const blanks = (["shop_url", "newsletter_url", "sms_url", "bandsintown_artist", "presave_url"] as const).filter((k) => !row[k]);
  if (blanks.length) lines.push(`Blank link-outs: ${blanks.join(", ")} — \`artist:set website '{"id":1,"<field>":"…"}' --conflict id\``);
  return lines.filter(Boolean) as string[];
}

/** The Platforms Agent. */
const platforms: Rule = async (artist, opts) => {
  const today = iso(opts.today ?? new Date())!;
  const latest = await artist.query<Record<string, unknown>>("platform_latest", {}, { limit: 50 });

  const onFile: Section = {
    heading: "Platforms on file",
    lines: latest.map((p) => {
      const read = iso(p.stats_date as string);
      // A platform added but never read is a real state, not a zero.
      const age = read ? Math.round((Date.parse(today) - Date.parse(read)) / 86_400_000) : null;
      const when = read ? `last read ${read} (${age} day${age === 1 ? "" : "s"} ago)` : "NEVER READ";
      return `${p.platform}${p.is_primary ? " (primary)" : ""} — ${when}`;
    }),
    empty: "No platforms added. Ask which ones the artist actually uses.",
  };

  const stats = await artist.query<{ platform: string; date: string }>(
    "platform_stats",
    {},
    { orderBy: "date desc", limit: 500 },
  );
  const byPlatform = stats.reduce<Record<string, number>>((acc, s) => {
    acc[s.platform] = (acc[s.platform] ?? 0) + 1;
    return acc;
  }, {});

  const coverage: Section = {
    heading: "Readings available",
    lines: Object.entries(byPlatform).map(([p, n]) =>
      // Fewer than two readings cannot show a trend.
      n < 2
        ? `${p}: ${n} reading — not enough for a trend, report the number and say so`
        : `${p}: ${n} readings`,
    ),
    empty: "No readings logged. Nothing can be compared until the artist reports numbers twice.",
  };

  return [onFile, coverage];
};

/** The Presskit Agent. */
const presskit: Rule = async (artist) => {
  const kit = await artist.one<Record<string, unknown>>("presskit");
  const deck = await currentDeck(artist, kit);
  const brand = await artist.one<Record<string, unknown>>("brand");
  const versions = await artist.query<Record<string, unknown>>("presskit_versions", {}, { limit: 50 });
  const items = await artist.query<{ kind: string; status: string; slot: string | null }>(
    "presskit_items",
    {},
    { limit: 500 },
  );
  // Suggested items are counted apart: they are not on the deck until confirmed.
  const byKind = items.reduce<Record<string, { ok: number; pending: number }>>((acc, i) => {
    const c = (acc[i.kind] ??= { ok: 0, pending: 0 });
    if (i.status === "suggested") c.pending++;
    else if (i.status !== "rejected") c.ok++;
    return acc;
  }, {});

  const KINDS = ["quote", "clipping", "award", "show", "team", "video", "photo"];

  const state: Section = {
    heading: "Presskit",
    lines: [
      kit?.short_bio ? "Short bio: on file" : "Short bio: MISSING",
      kit?.long_bio ? "Long bio: on file" : "Long bio: MISSING",
      kit?.contact_email ? `Contact: ${kit.contact_email}` : "Contact email: MISSING",
      kit?.visual_identity && Object.keys(kit.visual_identity as object).length
        ? "Visual identity: derived"
        : "Visual identity: not derived yet",
      // Null in artist.brand means "derive it", not a gap.
      brand?.primary_color
        ? `Brand colours: set by the artist (${brand.primary_color})`
        : "Brand colours: none set — derived from the moodboard",
      brand?.font_display
        ? `Typeface: ${brand.font_display}${brand.font_source === "uploaded" ? " (uploaded" + (brand.font_embed_ok ? ", embeddable)" : ", NOT cleared for embedding)") : ""}`
        : "Typeface: none set — derived",
      brand?.logo_url ? "Logo: on file" : "Logo: none",
      deck?.presentation_url ? `Deck: ${deck.presentation_url} (v${deck.version})` : null,
      deck?.generated_at
        ? `Last generated: ${iso(deck.generated_at as string)} · ${versions.length} version${versions.length === 1 ? "" : "s"} kept`
        : "Never generated.",
    ].filter(Boolean) as string[],
    empty: "No presskit row at all — intake has not started.",
  };

  const lists: Section = {
    heading: "Items",
    lines: KINDS.map((k) => {
      const c = byKind[k] ?? { ok: 0, pending: 0 };
      return c.pending
        ? `${k}: ${c.ok} — plus ${c.pending} awaiting your confirmation, kept off the deck`
        : `${k}: ${c.ok}`;
    }),
    empty: "Nothing collected yet.",
  };

  // Never copied into the presskit tables (copies drift); joined at read time.
  const releases = await artist.query<Release>("releases", {}, { orderBy: "release_date desc", limit: 10 });
  const links = await artist.query<Record<string, unknown>>("platforms", {}, { limit: 20 });

  const elsewhere: Section = {
    heading: "Pulled from elsewhere, never copied",
    lines: [
      `Discography: ${releases.length} release${releases.length === 1 ? "" : "s"} in artist.releases`,
      `Social links: ${links.length} in artist.platforms`,
      "Streaming metrics: artist.platform_latest. The presskit tables deliberately hold none of these — copies drift.",
    ],
    empty: "",
  };

  return [state, lists, elsewhere];
};

/** The Label Management Agent. */
const labelManager: Rule = async (artist, opts) => {
  const today = iso(opts.today ?? new Date())!;
  const projects = await artist.query<Record<string, unknown>>(
    "projects",
    {},
    // Latest scoped project, the same rule as plan.ts, readiness.ts and brief.ts.
    { orderBy: "created_at desc", limit: 20 },
  );
  const live = projects.filter((p) => ["scoping", "planned", "active"].includes(String(p.status)));
  const p = live[0] ?? null;

  const project: Section = {
    heading: "Project",
    lines: p
      ? ([
          `${p.title} (${p.project_type}) — ${p.status}`,
          p.street_date
            ? `Street date: ${iso(p.street_date)}${p.date_is_target ? " (a target, not fixed)" : ""}`
            : "STREET DATE NOT SET — no phase can be given an absolute date until it is.",
          `Physical: ${p.physical} · Recording: ${p.recording_status}`,
          Array.isArray(p.markets) && p.markets.length ? `Markets: ${(p.markets as string[]).join(", ")}` : null,
          p.budget_amount ? `Budget: ${p.budget_amount} ${p.budget_currency ?? ""}`.trim() : null,
        ].filter(Boolean) as string[])
      : [],
    empty: "No project scoped. Ten questions come before any dates.",
  };

  const phases: Section = { heading: "Phases", lines: [], empty: "Scoped but not planned yet." };
  if (p) {
    const rows = await artist.query<Record<string, unknown>>(
      "project_phases",
      { project_id: p.id as string },
      { orderBy: "sort_order asc", limit: 100 },
    );
    const street = iso(p.street_date);
    phases.lines = rows.map((ph) => {
      // Windows are stored as week offsets from the street date, resolved at
      // read, so moving the date moves the plan.
      const when =
        street && ph.starts_week != null
          ? iso(new Date(Date.parse(street) + Number(ph.starts_week) * 7 * 86_400_000))
          : null;
      const window = when ? `${when}` : ph.starts_week != null ? `week ${ph.starts_week} (no street date)` : "unscheduled";
      // A null owner is real (e.g. merch has no department), not missing data.
      const who = ph.owner ?? `NO DEPARTMENT${ph.gap_reason ? ` — ${ph.gap_reason}` : ""}`;
      const blockers = Array.isArray(ph.blockers) && ph.blockers.length ? ` · blocked on ${(ph.blockers as string[]).join(", ")}` : "";
      const flag = ph.unestimated ? " · unestimated" : "";
      const overdue = when && when < today && ph.status === "pending" ? " · OVERDUE" : "";
      return `${ph.sort_order}. ${ph.title} — ${window} · ${who} · ${ph.status}${blockers}${flag}${overdue}`;
    });
  }

  return [project, phases];
};

/** One row of artist.saved_distributors. */
interface SavedDistributor {
  service_slug: string;
  status: string;
  is_current: boolean;
  plan_name: string | null;
  annual_cost: string | number | null;
  currency: string | null;
  cut_streaming_pct: string | number | null;
  // postgres.js returns `date`/`timestamptz` as Date. Print through `iso()`.
  since: string | Date | null;
  left_at: string | Date | null;
  ruled_out_reason: string | null;
  saved_name: string | null;
  saved_at: string | Date;
}

/**
 * The current distributor with its annual cost and streaming cut, the basis
 * of any comparison. A null cost prints "cost not recorded", never nothing.
 */
export function currentDistributorLine(d: {
  service_slug: string;
  status: string;
  plan_name: string | null;
  /** A Postgres `numeric`, so it arrives as a string: "29.00", not 29. */
  annual_cost: string | number | null;
  currency: string | null;
  cut_streaming_pct: string | number | null;
  /** A Postgres `date`, so postgres.js hands back a Date. */
  since: string | Date | null;
  saved_name: string | null;
}): string {
  const name = d.saved_name ?? d.service_slug;
  const plan = d.plan_name ? ` · ${d.plan_name}` : "";
  const cost =
    d.annual_cost != null
      ? ` · ${d.annual_cost}${d.currency ? ` ${d.currency}` : ""}/yr`
      : " · cost not recorded";
  const cut =
    d.cut_streaming_pct != null ? ` · keeps ${d.cut_streaming_pct}% of streaming` : "";
  // Through `iso()`: interpolating a raw Date prints the wrong day west of UTC.
  const since = d.since ? ` · since ${iso(d.since)}` : "";
  return `${name} — ${d.status}${plan}${cost}${cut}${since}`;
}

/** One item of artist.release_checklist. */
interface ChecklistRow {
  item: string;
  label: string;
  status: string;
  required: boolean;
  detail: string | null;
  fix: string | null;
  whose_rule: string;
  source: string | null;
}

/**
 * A saved checklist, blocking first, optional last; ready items collapse to
 * one line. Whose rule (store or distributor) is always printed, since the
 * fix differs: re-export versus switch distributor.
 */
export function checklistLines(rows: ChecklistRow[]): string[] {
  if (!rows.length) return [];
  const rank = { missing: 0, unknown: 1, not_applicable: 2, ready: 3 } as Record<string, number>;
  const sorted = [...rows].sort(
    (a, b) =>
      Number(b.required) - Number(a.required) ||
      (rank[a.status] ?? 9) - (rank[b.status] ?? 9) ||
      a.item.localeCompare(b.item),
  );
  const ready = sorted.filter((r) => r.status === "ready");
  const blocking = sorted.filter((r) => r.required && r.status !== "ready" && r.status !== "not_applicable");
  const rest = sorted.filter((r) => !ready.includes(r) && !blocking.includes(r));

  const line = (r: ChecklistRow) => {
    const whose = r.whose_rule === "distributor" ? ` · ${r.source ?? "your distributor"}'s rule` : r.whose_rule === "store" ? " · the stores' rule" : "";
    const why = r.detail ? ` — ${r.detail}` : "";
    const fix = r.fix ? ` → ${r.fix}` : "";
    const head = r.status === "missing" ? "BLOCKED" : "NOT CHECKED";
    return `${head}: ${r.label}${why}${whose}${fix}`;
  };

  return [
    `${ready.length} of ${rows.length} ready${blocking.length ? ` · ${blocking.length} blocking` : " · nothing blocking"}`,
    ...blocking.map(line),
    ...rest.map(
      (r) =>
        `${r.status === "not_applicable" ? "n/a" : r.status}: ${r.label}${r.required ? "" : " (optional)"}` +
        `${r.detail ? ` — ${r.detail}` : ""}`,
    ),
    ...(ready.length ? [`ready: ${ready.map((r) => r.label).join(", ")}`] : []),
  ];
}

/**
 * The Distribution Agent. The saved choice leads; `releases.distributor` is a
 * fallback for catalogues that predate the label.
 */
const distribution: Rule = async (artist) => {
  // `orderBy` takes a single column (it is parsed, then interpolated into SQL),
  // so current-first is sorted in JS.
  const saved = (await artist.query<SavedDistributor>("saved_distributors", {}, { orderBy: "saved_at desc" }))
    .sort((a, b) => Number(b.is_current) - Number(a.is_current));
  const releases = await artist.query<Release>("releases", {}, { orderBy: "release_date desc", limit: 50 });

  const current = saved.find((s) => s.is_current);
  const ruledOut = saved.filter((s) => s.status === "ruled_out");
  // Only distributors not already saved, so none is printed twice.
  const savedSlugs = new Set(saved.map((s) => (s.saved_name ?? s.service_slug).toLowerCase()));
  const inferred = [...new Set(releases.map((r) => r.distributor).filter(Boolean) as string[])]
    .filter((d) => !savedSlugs.has(d.toLowerCase()));

  const chosen: Section = {
    heading: "Distribution in use",
    lines: [
      current ? currentDistributorLine(current) : null,
      ...inferred.map(
        (d) =>
          `${d} — ${releases.filter((r) => r.distributor === d).length} release(s), inferred from artist.releases and never confirmed`,
      ),
      releases.some((r) => !r.distributor)
        ? `${releases.filter((r) => !r.distributor).length} release(s) have no distributor recorded.`
        : null,
    ].filter(Boolean) as string[],
    empty: "No distributor chosen and none on any release. Nothing to compare against yet.",
  };

  // Read on every comparison so a refused distributor is not re-proposed.
  const rejected: Section = {
    heading: "Already ruled out",
    lines: ruledOut.map(
      (s) => `${s.saved_name ?? s.service_slug}${s.ruled_out_reason ? ` — ${s.ruled_out_reason}` : ""}`,
    ),
    empty: "Nothing ruled out yet.",
  };

  // Saved by distribution-prepare-package.
  const focus = releases[0];
  const rows = focus
    ? await artist.query<ChecklistRow>("release_checklist", { release_id: focus.id }, { limit: 40 })
    : [];
  const checklist: Section = {
    heading: focus ? `Package checklist — ${focus.title}` : "Package checklist",
    lines: checklistLines(rows),
    empty: "No checklist saved yet. distribution-prepare-package writes one.",
  };

  return [chosen, rejected, checklist];
};

/**
 * Any other department: core profile and memory only. Deliberately thin.
 * To add one: write a Rule, add it to RULES, add a case to rules.test.ts, and
 * give its skills a `## Data` section.
 */
const DEFAULT_RULE: Rule = async () => [];

/**
 * The Spotify editorial pitch window: at least 7 days before release, and it
 * does not reopen for that record. Computed in code so skills don't re-derive it.
 */
export function editorialWindow(
  releaseDate: string | Date | null | undefined,
  today: string | Date,
): { state: "open" | "closed" | "unknown"; closesOn: string | null; daysOut: number | null } {
  const date = iso(releaseDate);
  const now = iso(today);
  if (!date || !now) return { state: "unknown", closesOn: null, daysOut: null };
  const daysOut = Math.round((Date.parse(date) - Date.parse(now)) / 86_400_000);
  const closesOn = iso(new Date(Date.parse(date) - 7 * 86_400_000));
  return { state: daysOut >= 7 ? "open" : "closed", closesOn, daysOut };
}

/** The Promotion Agent. Leads with days to release and the editorial window. */
const promotion: Rule = async (artist, opts) => {
  const today = iso(opts.today ?? new Date())!;
  const releases = await artist.query<Release>("releases", {}, { orderBy: "release_date desc", limit: 20 });
  const focus = pickFocusRelease(releases, opts);

  const date = focus ? iso(focus.release_date) : null;
  const win = editorialWindow(focus?.release_date, today);
  const days = win.daysOut;

  const targets = await artist.query<{ target_id: string; kind: string; name: string | null; status: string; route: string | null; pitched_at: unknown }>(
    "promotion_targets",
    focus ? { release_id: focus.id } : {},
    { orderBy: "updated_at desc", limit: 100 },
  );
  const shortlist: Section = {
    heading: "Shortlist (promotion_targets)",
    lines: targets.map((t) => `[${t.status}] ${t.name ?? t.target_id} · ${t.kind}${t.route ? ` · ${t.route}` : ""}${iso(t.pitched_at) ? ` · pitched ${iso(t.pitched_at)}` : ""}`),
    empty: "No target saved yet. A station or playlist the artist agrees to reach is one `artist:set promotion_targets` row.",
  };

  const release: Section = {
    heading: "Focus release",
    lines: focus
      ? ([
          `${focus.title} (${focus.release_type})`,
          date ? `Date: ${date}${days !== null ? ` — ${days} days out` : ""}` : "Date: NOT SET",
          win.state === "unknown"
            ? "Editorial window: CANNOT BE COMPUTED without a release date."
            : win.state === "open"
              ? `Editorial window: OPEN — closes ${win.closesOn}.`
              : "Editorial window: CLOSED for this release. Do not offer the Spotify pitch.",
          focus.label ? `Label: ${focus.label}` : null,
        ].filter(Boolean) as string[])
      : [],
    empty: "No releases on file. A pitch needs [RELEASE TITLE] and [RELEASE DATE] as placeholders.",
  };

  // Country and language decide which broadcast quota applies.
  const profile = await artist.one<Record<string, unknown>>("profile");
  const country = profile?.country ? String(profile.country) : null;
  const locale = profile?.preferred_locale ? String(profile.preferred_locale) : null;
  const quota: Section = {
    heading: "Which rules apply",
    lines: (
      [
        country ? `Country: ${country}` : null,
        profile?.province ? `Province: ${profile.province}` : null,
        locale ? `Language: ${locale}` : null,
        country === "CA"
          ? "CanCon applies — campus and community stations owe ≥35% Canadian weekly. Rank them first."
          : country === "US"
            ? "No quota exists in the US. Nothing obliges a station to answer; rank on fit and relationship."
            : null,
        country === "CA" && locale === "fr"
          ? "French-language stations owe ≥65% francophone vocal music weekly — a second quota working for this artist."
          : null,
      ].filter(Boolean) as string[]
    ),
    empty: "No country on file. The strategy cannot be chosen — ask before ranking anything.",
  };

  const traction: Section = {
    heading: "Traction worth citing",
    lines: tractionLines(await artist.query("platform_latest", {}, { limit: 20 })),
    empty: "No non-zero numbers reported. Cite none rather than inventing one.",
  };

  return [release, shortlist, quota, traction];
};

/**
 * Every department in `agents/`. A missing one silently falls back to the
 * core-only default; `rules.test.ts` fails when this map and `agents/` disagree.
 */
export const RULES: Record<string, Rule> = {
  "digital-marketing": digitalMarketing,
  distribution,
  "label-manager": labelManager,
  platforms,
  press,
  presskit,
  promotion,
  rights,
};

/** Departments deliberately core-only, so `--list` can tell them from unwritten ones. */
export const CORE_ONLY: string[] = [];

// ── assembly ───────────────────────────────────────────────────────────────

export async function buildBrief(artist: Artist, agent: string, opts: BriefOpts = {}): Promise<Brief> {
  const rule = RULES[agent] ?? DEFAULT_RULE;
  const sections = [
    await coreSection(artist),
    await voiceSection(artist),
    ...(await rule(artist, opts)),
    await memorySection(artist, agent),
  ];
  return { agent, sections };
}

/** Plain text, because that is what lands in an agent's context. */
export function renderBrief(brief: Brief): string {
  const out = [`# What we know about the artist — for the ${brief.agent} department`, ""];
  for (const s of brief.sections) {
    out.push(`## ${s.heading}`);
    out.push(...(s.lines.length ? s.lines.map((l) => `- ${l}`) : [`- ${s.empty}`]));
    out.push("");
  }
  if (!RULES[brief.agent])
    out.push(
      `(No department-specific rule for '${brief.agent}' yet — this is the core brief only.`,
      ` Query anything else with \`bun run artist:get <table>\`.)`,
      "",
    );
  return out.join("\n");
}
