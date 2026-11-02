/**
 * The whole presskit path, end to end, against two invented artists.
 * Stops before Google Drive: the PPTX is written to disk and rendered with
 * LibreOffice. Runs on `EVAL_DATABASE_URL`, which it truncates; one profile
 * row per database, so fixtures run in turn. A failed assertion exits non-zero.
 *
 *   bun run agents/presskit/evals/e2e.ts            # both fixtures
 *   bun run agents/presskit/evals/e2e.ts lamprey-season    # one
 *   bun run agents/presskit/evals/e2e.ts --no-net   # skip the paid/API steps
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { resolveConfig } from "../../../engine/config";
import { scrapeBandcampDiscography } from "../skills/presskit-build/scripts/bandcamp";
import { extractShowsFromImages } from "../skills/presskit-build/scripts/poster";
import { searchPressCandidates } from "../skills/presskit-build/scripts/search";
import { buildDeck, type DeckItem } from "../skills/presskit-build/scripts/deck";
import { resolveTheme } from "../skills/presskit-build/scripts/theme";
import { FIXTURES, type Fixture } from "./fixtures";

const OUT = join(process.cwd(), "content", "presskit");
const args = process.argv.slice(2);
const noNet = args.includes("--no-net");
const only = args.filter((a) => !a.startsWith("--"));

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

function envUrl(key: string): string | null {
  try {
    const text = require("node:fs").readFileSync(".env.local", "utf8") as string;
    return new RegExp(`^${key}=(.*)$`, "m").exec(text)?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const evalUrl = envUrl("EVAL_DATABASE_URL");
  if (!evalUrl) {
    console.error("EVAL_DATABASE_URL is not set. Refusing to run against the artist's own database.");
    process.exit(1);
  }
  const cfg = await resolveConfig();
  if (!cfg) {
    console.error("No provider configured. Run `bun run houselabel init` first.");
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });

  const sql = postgres(evalUrl, { max: 2, onnotice: () => {} });
  const chosen = only.length ? FIXTURES.filter((f) => only.includes(f.slug)) : FIXTURES;
  if (!chosen.length) {
    console.error(`No fixture named ${only.join(", ")}. Have: ${FIXTURES.map((f) => f.slug).join(", ")}`);
    process.exit(1);
  }

  const results: { fixture: string; checks: Check[] }[] = [];

  for (const fx of chosen) {
    console.log(`\n${"─".repeat(70)}\n${fx.profile.artist_name} · ${fx.slug}\n${"─".repeat(70)}`);
    const checks = await runFixture(sql, cfg, fx);
    results.push({ fixture: fx.slug, checks });
  }

  await sql.end();

  console.log(`\n${"═".repeat(70)}\nRESULT\n${"═".repeat(70)}`);
  let failed = 0;
  for (const r of results) {
    for (const c of r.checks) {
      if (!c.ok) failed++;
      console.log(`${c.ok ? "✓" : "✗"} ${r.fixture.padEnd(12)} ${c.name.padEnd(26)} ${c.detail}`);
    }
  }
  console.log(
    `\n${results.reduce((n, r) => n + r.checks.filter((c) => c.ok).length, 0)} passed · ${failed} failed` +
      (noNet ? " · --no-net (network steps skipped)" : ""),
  );
  process.exit(failed ? 1 : 0);
}

/** Empty every artist table in the eval database, so fixtures cannot bleed. */
async function reset(sql: postgres.Sql): Promise<void> {
  await sql`truncate artist.presskit_items, artist.presskit_versions, artist.releases restart identity cascade`;
  await sql`delete from artist.presskit`;
  await sql`delete from artist.brand`;
  await sql`delete from artist.profile`;
}

async function runFixture(sql: postgres.Sql, cfg: Awaited<ReturnType<typeof resolveConfig>>, fx: Fixture): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => {
    checks.push({ name, ok, detail });
    console.log(`  ${ok ? "✓" : "✗"} ${name.padEnd(26)} ${detail}`);
  };

  await reset(sql);
  const p = fx.profile;
  await sql`
    insert into artist.profile (id, artist_name, city, region, country, genres, career_stage, preferred_locale)
    values (1, ${p.artist_name}, ${p.city}, ${p.province}, ${p.country},
            ${sql.array(p.genres.split(/\s+/))}, ${p.career_stage}, ${p.preferred_locale})`;
  await sql`insert into artist.presskit (id, moodboard_notes) values (1, ${fx.moodboard})`;
  if (fx.brand) {
    await sql`insert into artist.brand ${sql({ id: 1, ...fx.brand })}`;
  }
  add("seed", true, `profile + moodboard${fx.brand ? " + brand" : ""}`);

  // ── Step 1 · the theme ────────────────────────────────────────────────
  const brandRow = fx.brand ? ((await sql`select * from artist.brand where id = 1`)[0] ?? null) : null;
  // Read the row back, not `p.genres`: the column is `text[]`, and testing
  // against the fixture string hides type bugs the runtime would hit.
  const profileRow = (await sql`select * from artist.profile where id = 1`)[0] as
    | Record<string, unknown>
    | undefined;
  const realGenres = profileRow?.genres as string[] | string | null | undefined;
  add(
    "reads real rows",
    Array.isArray(realGenres) && realGenres.length > 0,
    `profile.genres came back as ${Array.isArray(realGenres) ? `text[] ${JSON.stringify(realGenres)}` : typeof realGenres} — the shape the deck actually gets`,
  );
  const theme = resolveTheme({ genres: realGenres, brand: brandRow });
  add(
    "theme",
    theme.primary === fx.expect.themePrimary,
    `${theme.source} → #${theme.primary} (${theme.mood}) — expected #${fx.expect.themePrimary}`,
  );

  // ── Step 2 · discography off Bandcamp ─────────────────────────────────
  let releases: { title: string; kind?: string | null; year?: string | null }[] = [];
  if (fx.bandcamp && !noNet) {
    try {
      const scraped = await scrapeBandcampDiscography(fx.bandcamp);
      for (const r of scraped.slice(0, 12)) {
        await sql`insert into artist.releases (title, release_type, release_date)
                  values (${r.title}, ${r.kind === "track" ? "single" : "album"},
                          ${r.year ? `${r.year}-01-01` : null})
                  on conflict do nothing`;
      }
      releases = scraped.map((r) => ({ title: r.title, kind: r.kind, year: r.year }));
      add("bandcamp", releases.length >= fx.expect.minReleases,
          `${releases.length} releases (need ≥${fx.expect.minReleases}) — newest "${releases[0]?.title ?? "—"}"`);
    } catch (e) {
      add("bandcamp", false, `threw: ${String(e).slice(0, 90)}`);
    }
  } else {
    add("bandcamp", true, fx.bandcamp ? "skipped (--no-net)" : "no Bandcamp page — releases_typed branch");
  }

  // ── Step 3 · shows off the poster ─────────────────────────────────────
  const items: DeckItem[] = [];
  if (fx.poster && !noNet) {
    const r = await extractShowsFromImages(cfg!, [fx.poster]);
    for (const s of r.shows) {
      await sql`insert into artist.presskit_items (kind, dedupe_key, status, source, data)
                values ('show', ${`${s.venue}|${s.date}`.toLowerCase()}, 'suggested', 'presskit-poster',
                        ${sql.json({ venue: s.venue, city: s.city, date: s.date, event: s.event })})
                on conflict (kind, dedupe_key) do nothing`;
      items.push({ kind: "show", slot: null, data: { venue: s.venue, city: s.city, date: s.date } });
    }
    add("poster", r.shows.length >= fx.expect.minShowsFromPoster,
        `${r.shows.length} shows (need ≥${fx.expect.minShowsFromPoster})${r.unreadable.length ? `, ${r.unreadable.length} unreadable` : ""} — ${r.shows[0]?.venue ?? "—"}`);
  } else {
    add("poster", true, fx.poster ? "skipped (--no-net)" : "no poster supplied");
  }

  // ── Step 4 · press off the web ────────────────────────────────────────
  if (!noNet) {
    const r = await searchPressCandidates(cfg!, p.artist_name, { extraContext: fx.disambiguation });
    for (const c of r.candidates) {
      await sql`insert into artist.presskit_items (kind, dedupe_key, status, source, data)
                values ('clipping', ${c.url}, 'suggested', 'presskit-build',
                        ${sql.json({ title: c.title, outlet: c.publication, date: c.date, url: c.url })})
                on conflict (kind, dedupe_key) do nothing`;
    }
    add("press", r.candidates.length >= fx.expect.minPressCandidates,
        `${r.candidates.length} verified of ${r.offered} offered (need ≥${fx.expect.minPressCandidates}) — ${r.candidates[0]?.publication ?? "—"}`);

    // Everything the crawlers found is `suggested`, so the deck must ignore it.
    const [{ pending }] = await sql<{ pending: number }[]>`
      select count(*)::int as pending from artist.presskit_items where status = 'suggested'`;
    add("nothing auto-confirmed", pending > 0,
        `${pending} items await confirmation and stay off the deck`);
  } else {
    add("press", true, "skipped (--no-net)");
  }

  // ── Step 5 · the artist confirms, and photos get their slots ──────────
  await sql`update artist.presskit_items set status = 'confirmed' where kind = 'clipping'`;
  for (const ph of fx.photos) {
    await sql`insert into artist.presskit_items (kind, dedupe_key, status, slot, source, data)
              values ('photo', ${ph.url}, 'confirmed', ${ph.slot}, 'artist', ${sql.json({ url: ph.url })})
              on conflict (kind, dedupe_key) do update set slot = excluded.slot`;
  }
  const confirmed = await sql<{ kind: string; slot: string | null; data: Record<string, unknown> }[]>`
    select kind, slot, data from artist.presskit_items where status = 'confirmed'`;
  add("slots", confirmed.filter((c) => c.kind === "photo" && c.slot === "hero").length === 1,
      `${confirmed.filter((c) => c.kind === "photo").length} photos, one hero`);

  // ── Step 6 · the deck ─────────────────────────────────────────────────
  const out = join(OUT, `${fx.slug}.pptx`);
  const built = await buildDeck(
    {
      artistName: (profileRow?.artist_name as string) ?? p.artist_name,
      // Again the row, not the fixture — same reason as `realGenres` above.
      genres: realGenres as string[] | null,
      location: `${p.city}, ${p.province}`,
      shortBio: null,
      longBio: null,
      contactEmail: `press@${fx.slug}.example`,
      bookingEmail: null,
      releases,
      // Deliberately empty: platform_latest has no rows, so these must render
      // as "to be completed" and never as zero.
      stats: {},
      items: confirmed.map((c) => ({ kind: c.kind, slot: c.slot, data: c.data })),
      lang: p.preferred_locale,
    },
    out,
    { brand: brandRow },
  );
  const size = Bun.file(out).size;
  add("deck", size > 20_000, `${(size / 1024).toFixed(0)} KB · ${built.incomplete.length} slides incomplete${built.warnings.length ? ` · ${built.warnings.length} warnings` : ""}`);

  // The bio is null on purpose. The deck must say so, not invent one.
  add("no invention", built.incomplete.includes("biography"),
      `missing slides named: ${built.incomplete.join(", ") || "none"}`);

  // ── Step 7 · the version row ──────────────────────────────────────────
  await sql`
    insert into artist.presskit_versions (version, locale, reason, note, visual_identity, slide_count)
    values (1, ${p.preferred_locale}, 'initial', 'e2e run', ${sql.json({ primary_color: `#${built.theme.primary}` })}, 8)`;
  await sql`update artist.presskit set current_version = 1 where id = 1`;
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from artist.presskit_versions`;
  add("versioned", n === 1, `${n} version row, presskit.current_version = 1`);

  return checks;
}

await main();
