/**
 * The release's CREDITS document, assembled from rows.
 *
 *   bun run agents/label-manager/skills/manager-build-credits/scripts/credits.ts
 *   bun run .../credits.ts --release="Nightdrive"
 *   bun run .../credits.ts --gaps          # only what is missing, and who owns it
 *   bun run .../credits.ts --out=credits.txt   # a LOCAL file; Drive gets a Google Doc
 *
 * Code, not prose: writer shares must total 100, ℗ and © are distinct owners,
 * roles must match the distributor's DDEX dropdowns, and a performer with no
 * IPN cannot be paid. One direction only: never parse a CREDITS file back into
 * rows (engine/google/WORKSPACE.md).
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import postgres from "postgres";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const GAPS_ONLY = process.argv.includes("--gaps");
const OUT = arg("out");
const WANTED = arg("release");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "✗ DATABASE_URL is not set — that, and only that, means no artist data.\n" +
      "  A missing .env file does not: .env.local is gitignored and a hosted\n" +
      "  deployment has none.",
  );
  process.exit(1);
}

/**
 * Display names for the stored role vocabulary. The stored side is the DDEX
 * contributor role so it maps onto the distributor's dropdown; the printed side
 * is what a reader of a record sleeve expects to see.
 */
const ROLE_LABEL: Record<string, string> = {
  main_artist: "Main artist",
  featured_artist: "Featured artist",
  performer: "Performer",
  background_vocalist: "Background vocals",
  conductor: "Conductor",
  orchestra: "Orchestra",
  choir: "Choir",
  producer: "Produced by",
  co_producer: "Co-produced by",
  additional_production: "Additional production",
  vocal_producer: "Vocal production",
  recording_engineer: "Recorded by",
  assistant_engineer: "Assistant engineer",
  mixing_engineer: "Mixed by",
  mastering_engineer: "Mastered by",
  programmer: "Programming",
  editor: "Editing",
  cover_artwork: "Cover artwork",
  photography: "Photography",
  art_direction: "Art direction",
  design: "Design",
  layout: "Layout",
  executive_producer: "Executive producer",
  a_and_r: "A&R",
  funder: "Funder",
};

const PERFORMER_ROLES = new Set([
  "main_artist", "featured_artist", "performer", "background_vocalist", "conductor", "orchestra", "choir",
]);
const PRODUCTION_ROLES = new Set([
  "producer", "co_producer", "additional_production", "vocal_producer", "recording_engineer",
  "assistant_engineer", "mixing_engineer", "mastering_engineer", "programmer", "editor",
]);
const VISUAL_ROLES = new Set(["cover_artwork", "photography", "art_direction", "design", "layout"]);

/** A missing credit with a consequence, naming the department that closes it. */
type Gap = { item: string; detail: string; owner: string; blocks: string };
const gaps: Gap[] = [];
const gap = (item: string, detail: string, owner: string, blocks: string) => gaps.push({ item, detail, owner, blocks });

/** A postgres `date` arrives as a Date object; same helper as data/artist/brief/rules.ts. */
const iso = (d: string | Date | null | undefined): string | null =>
  d == null ? null : (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);

/** numeric(5,2) reads back as "50.00"; a credit sleeve says 50%. */
const pct = (n: unknown): string | null =>
  n == null ? null : `${Number(n).toFixed(2).replace(/\.?0+$/, "")}%`;

const dur = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
const row = (cells: (string | null)[]) => `| ${cells.map((c) => c ?? "—").join(" | ")} |`;

const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  const releases = await sql<Record<string, any>[]>`
    select id, title, artist_name, release_type, upc, label, distributor,
           release_date, credits_url, p_year, p_owner, c_year, c_owner
      from artist.releases
     order by release_date desc nulls last, created_at desc
  `;
  if (releases.length === 0) {
    console.error("✗ No release in the catalog yet. Credits describe a release; scope or add one first.");
    process.exit(1);
  }
  const release = WANTED
    ? releases.find((r) => String(r.title).toLowerCase().includes(WANTED.toLowerCase()))
    : releases[0];
  if (!release) {
    console.error(`✗ No release matching "${WANTED}". Have: ${releases.map((r) => r.title).join(", ")}`);
    process.exit(1);
  }

  const songs = await sql<Record<string, any>[]>`
    select id, title, isrc, iswc, duration_seconds
      from artist.songs where release_id = ${release.id} order by created_at asc
  `;
  const ids = songs.map((s) => s.id);
  const writers = ids.length
    ? await sql<Record<string, any>[]>`select * from artist.song_writers where song_id in ${sql(ids)}`
    : [];
  const credits = await sql<Record<string, any>[]>`
    select * from artist.release_credits where release_id = ${release.id}
     order by sort_order asc, created_at asc
  `;
  const samples = ids.length
    ? await sql<Record<string, any>[]>`select * from artist.song_samples where song_id in ${sql(ids)}`
    : [];

  const at = (songId: string | null, pred: (r: Record<string, any>) => boolean) =>
    credits.filter((c) => (songId === null ? c.song_id === null : c.song_id === songId) && pred(c));

  // ---- gaps -------------------------------------------------------------
  if (!release.p_year || !release.p_owner)
    gap("℗ line", "the sound-recording owner is not recorded", "Rights", "delivery — stores use it to attribute the master");
  if (!release.c_year || !release.c_owner)
    gap("© line", "the composition owner is not recorded", "Rights", "delivery");
  if (!release.upc) gap("UPC", "not assigned", "Rights", "delivery");
  if (at(null, (c) => c.role === "cover_artwork" || c.role === "photography").length === 0)
    gap("Cover credit", "nobody is credited for the cover", "Presskit", "the credits document");

  for (const s of songs) {
    const label = `“${s.title}”`;
    if (!s.isrc) gap(`ISRC · ${label}`, "not assigned", "Rights", "delivery and every royalty claim");
    const w = writers.filter((x) => x.song_id === s.id);
    if (w.length === 0) {
      gap(`Writers · ${label}`, "no writer recorded", "Rights", "every performance royalty on this song");
    } else {
      const total = w.reduce((n, x) => n + Number(x.share_percent ?? 0), 0);
      if (Math.abs(total - 100) > 0.01)
        gap(`Writer shares · ${label}`, `total ${total}%, not 100%`, "Rights", "registration and delivery");
      const noIpi = w.filter((x) => !x.ipi).map((x) => x.name);
      if (noIpi.length) gap(`Writer IPI · ${label}`, `no IPI for ${noIpi.join(", ")}`, "Rights", "the payment of their share");
    }
    if (at(s.id, (c) => c.role === "mastering_engineer").length === 0)
      gap(`Mastering credit · ${label}`, "nobody credited", "the artist", "the credits document");
    const unpayable = at(s.id, (c) => PERFORMER_ROLES.has(c.role) && c.featured === false && !c.ipn && !c.isni);
    for (const p of unpayable)
      gap(`Performer id · ${label}`, `${p.name} (${p.instrument ?? "performer"}) has no IPN`, "Rights",
        "payment by their society — Artisti in QC, the AFM & SAG-AFTRA Fund in the US");
    for (const smp of samples.filter((x) => x.song_id === s.id && !x.cleared_on))
      gap(`Sample · ${label}`, `“${smp.source_work}” is not cleared`, "the artist",
        "delivery — an uncleared sample is a takedown, not a credit");
  }

  if (GAPS_ONLY || gaps.length) {
    const head = `CREDITS GAPS · ${release.title}${gaps.length ? "" : " — none"}`;
    const lines = gaps.map((g) => `  ✗ ${g.item.padEnd(34)} ${g.detail}\n      ${g.owner} · blocks ${g.blocks}`);
    // `#` lines are for the manager, never relayed to the artist — the AGENT.md rule.
    console.error([head, ...lines, gaps.length ? "# brief each owner above before regenerating" : ""].join("\n"));
  }
  if (GAPS_ONLY) process.exit(gaps.length ? 1 : 0);

  // ---- the document -----------------------------------------------------
  const out: string[] = [];
  const push = (...l: string[]) => out.push(...l);
  const TYPE = String(release.release_type).toUpperCase();

  push(`# CREDITS — ${release.title}`, "");
  push("<!-- Generated from the artist's catalog by manager-build-credits.", "     Do not edit by hand: the next run overwrites this file. Corrections",
       "     go into the rows, then regenerate. -->", "");
  push(`**${release.artist_name ?? "—"}** · ${TYPE}`);
  push(`Released ${iso(release.release_date) ?? "TBD"} · UPC ${release.upc ?? "NOT ASSIGNED"}`);
  push(`Label: ${release.label ?? "self-released"} · Distributor: ${release.distributor ?? "—"}`, "");
  push("```",
       `℗ ${release.p_year ?? "YYYY"} ${release.p_owner ?? "MASTER OWNER — NOT RECORDED"}`,
       `© ${release.c_year ?? "YYYY"} ${release.c_owner ?? "COMPOSITION OWNER — NOT RECORDED"}`,
       "```", "");

  const releaseLevel = at(null, () => true);
  if (releaseLevel.length) {
    push("## Release credits", "", row(["Role", "Name", "Where"]), row(["---", "---", "---"]));
    for (const c of releaseLevel)
      push(row([ROLE_LABEL[c.role] ?? c.role, c.name, [c.studio, c.city].filter(Boolean).join(", ") || null]));
    push("");
  }

  push("## Track credits", "");
  songs.forEach((s, i) => {
    push(`### ${i + 1}. ${s.title} — ${dur(s.duration_seconds)}`, "");
    push(`\`ISRC ${s.isrc ?? "NOT ASSIGNED"}\` · \`ISWC ${s.iswc ?? "—"}\``, "");

    const w = writers.filter((x) => x.song_id === s.id);
    if (w.length) {
      const total = w.reduce((n, x) => n + Number(x.share_percent ?? 0), 0);
      push("**Written by**" + (Math.abs(total - 100) > 0.01 ? `  ⚠ shares total ${total}%, not 100%` : ""), "");
      push(row(["Writer", "Role", "Share", "IPI", "Publisher"]), row(["---", "---", "---", "---", "---"]));
      for (const x of w)
        push(row([x.name, String(x.role ?? "—").replace(/_/g, " "),
                  pct(x.share_percent), x.ipi, x.publisher]));
      push("");
    }

    const perf = at(s.id, (c) => PERFORMER_ROLES.has(c.role));
    if (perf.length) {
      push("**Performed by**", "", row(["Performer", "Instrument", "Featured", "IPN / ISNI"]),
           row(["---", "---", "---", "---"]));
      for (const c of perf)
        push(row([c.name, c.instrument,
                  c.featured === true ? "featured" : c.featured === false ? "non-featured" : "not stated",
                  c.ipn ?? c.isni]));
      push("");
    }

    const prod = at(s.id, (c) => PRODUCTION_ROLES.has(c.role) || VISUAL_ROLES.has(c.role));
    if (prod.length) {
      push("**Production**", "", row(["Role", "Name", "Studio, city"]), row(["---", "---", "---"]));
      for (const c of prod)
        push(row([ROLE_LABEL[c.role] ?? c.role, c.name, [c.studio, c.city].filter(Boolean).join(", ") || null]));
      push("");
    }

    const smp = samples.filter((x) => x.song_id === s.id);
    if (smp.length) {
      push("**Samples and interpolations**", "", row(["Source work", "Rights holder", "Cleared on", "Terms"]),
           row(["---", "---", "---", "---"]));
      for (const x of smp)
        push(row([`${x.source_work} (${x.kind})`, x.rights_holder,
                  iso(x.cleared_on) ?? "⚠ NOT CLEARED", x.terms]));
      push("");
    }
  });

  const funders = at(null, (c) => c.role === "funder");
  if (funders.length) {
    // Verbatim: funders set the wording and a paraphrase can affect the claim.
    push("## Funders and acknowledgements", "", ...funders.map((f) => `> ${f.name}`), "");
  }

  const doc = out.join("\n").replace(/\n{3,}/g, "\n\n");
  if (OUT) {
    await Bun.write(OUT, doc);
    console.error(`✓ wrote ${OUT} — ${songs.length} track${songs.length === 1 ? "" : "s"}, ${gaps.length} gap${gaps.length === 1 ? "" : "s"}`);
  } else {
    console.log(doc);
  }
} finally {
  await sql.end();
}
