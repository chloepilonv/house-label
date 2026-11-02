/**
 * The brief selection rules, tested as pure functions. No database.
 *
 *   bun test data/artist
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { expect, test, describe } from "bun:test";
import {
  pickFocusRelease,
  tractionLines,
  shareWarnings,
  doubleRepresentation,
  dossierLines,
  RULES,
  CORE_ONLY,
  currentDistributorLine,
  editorialWindow,
  websiteLines,
  voiceLines,
  VOICE_SAMPLES_MAX,
  VOICE_SAMPLE_CHARS,
} from "./rules";
import { ARTIST_TABLES } from "../client";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TODAY = new Date("2026-08-26");
const rel = (id: string, title: string, release_date: string | null) =>
  ({ id, title, release_type: "album", release_date, upc: null, label: null, distributor: null }) as never;

describe("pickFocusRelease", () => {
  test("an explicit id always wins", () => {
    const rows = [rel("a", "A", "2026-09-12"), rel("b", "B", "2020-01-01")];
    expect(pickFocusRelease(rows, { releaseId: "b", today: TODAY })?.title).toBe("B");
  });

  test("an explicit id that matches nothing returns null rather than guessing", () => {
    expect(pickFocusRelease([rel("a", "A", "2026-09-12")], { releaseId: "zzz", today: TODAY })).toBeNull();
  });

  test("the SOONEST future release wins, not the furthest", () => {
    // The nearest future release wins, not the furthest.
    const rows = [rel("far", "2027 album", "2027-05-01"), rel("near", "September single", "2026-09-12")];
    expect(pickFocusRelease(rows, { today: TODAY })?.title).toBe("September single");
  });

  test("a release dated today is still upcoming", () => {
    const rows = [rel("today", "Out today", "2026-08-26"), rel("past", "Old", "2025-01-01")];
    expect(pickFocusRelease(rows, { today: TODAY })?.title).toBe("Out today");
  });

  test("with nothing upcoming, the most recent past release wins", () => {
    const rows = [rel("old", "Older", "2019-03-03"), rel("recent", "Most recent", "2025-11-30")];
    expect(pickFocusRelease(rows, { today: TODAY })?.title).toBe("Most recent");
  });

  test("undated releases are drafts and are never the focus", () => {
    const rows = [rel("draft", "Untitled draft", null), rel("real", "Real", "2024-01-01")];
    expect(pickFocusRelease(rows, { today: TODAY })?.title).toBe("Real");
  });

  test("only undated releases means no focus at all", () => {
    expect(pickFocusRelease([rel("draft", "Untitled draft", null)], { today: TODAY })).toBeNull();
  });

  test("no releases returns null instead of throwing", () => {
    expect(pickFocusRelease([], { today: TODAY })).toBeNull();
  });
});

describe("tractionLines", () => {
  const row = (over: Record<string, unknown>) => ({
    platform: "spotify",
    stats_date: "2026-08-01",
    is_primary: false,
    monthly_listeners: null,
    subscribers: null,
    followers: null,
    total_streams: null,
    total_plays: null,
    total_views: null,
    ...over,
  });

  test("a zero metric is dropped — never pitch '0 monthly listeners'", () => {
    expect(tractionLines([row({ monthly_listeners: 0 })])).toEqual([]);
  });

  test("a null metric is dropped — it was never read, not measured as nothing", () => {
    expect(tractionLines([row({ monthly_listeners: null })])).toEqual([]);
  });

  test("a real number is reported with its platform and reading date", () => {
    const [line] = tractionLines([row({ monthly_listeners: 4200 })]);
    expect(line).toContain("spotify");
    expect(line).toContain("4,200");
    expect(line).toContain("2026-08-01");
  });

  test("the primary platform ranks above a bigger number elsewhere", () => {
    const lines = tractionLines([
      row({ platform: "youtube", subscribers: 90_000 }),
      row({ platform: "bandcamp", is_primary: true, total_plays: 300 }),
    ]);
    expect(lines[0]).toContain("bandcamp");
  });

  test("at most three lines — a pitch citing six numbers cites none", () => {
    const lines = tractionLines([
      row({ platform: "spotify", monthly_listeners: 5 }),
      row({ platform: "youtube", subscribers: 4, total_views: 3 }),
      row({ platform: "tiktok", followers: 2 }),
      row({ platform: "bandcamp", total_plays: 1 }),
    ]);
    expect(lines.length).toBe(3);
  });

  test("no rows at all returns no lines", () => {
    expect(tractionLines([])).toEqual([]);
  });
});

describe("shareWarnings", () => {
  const s = (title: string, writer_total: number, master_total: number) => ({ title, writer_total, master_total });

  test("a song with nothing on either side is missing, not merely off", () => {
    // Different fixes: one needs data entered, the other a number corrected.
    const { missing, off } = shareWarnings([s("Nuit blanche", 0, 0)]);
    expect(missing[0]).toContain("no writers and no master splits");
    expect(off).toEqual([]);
  });

  test("one empty side is named specifically", () => {
    expect(shareWarnings([s("A", 100, 0)]).missing[0]).toContain("master splits");
    expect(shareWarnings([s("B", 0, 100)]).missing[0]).toContain("writer shares");
  });

  test("a total that does not reach 100 is a warning, not an error", () => {
    // A view, not a constraint: catalogs are imported incomplete.
    const { off } = shareWarnings([s("C", 50, 100)]);
    expect(off[0]).toContain("writers 50%");
  });

  test("over 100 is caught too", () => {
    expect(shareWarnings([s("D", 120, 100)]).off.length).toBe(1);
  });

  test("a clean song produces no warning at all", () => {
    expect(shareWarnings([s("E", 100, 100)])).toEqual({ missing: [], off: [] });
  });

  test("string totals from Postgres numeric are handled", () => {
    // node-postgres returns numeric as a string; comparing "100" !== 100 would
    // warn on every clean song.
    expect(shareWarnings([{ title: "F", writer_total: "100", master_total: "100" }])).toEqual({
      missing: [],
      off: [],
    });
  });
});

describe("currentDistributorLine", () => {
  // The fixture uses the shape Postgres returns: `numeric` as a string
  // ("29.00"), `date` as a Date. JS primitives would hide the bug.
  const d = (over: Partial<Parameters<typeof currentDistributorLine>[0]> = {}) =>
    ({
      service_slug: "cd-baby",
      status: "signed_up",
      plan_name: "Standard",
      annual_cost: "29.00",
      currency: "USD",
      cut_streaming_pct: "9.00",
      since: new Date("2025-03-01T00:00:00.000Z"),
      saved_name: "CD Baby",
      ...over,
    }) as never;

  test("prints the cost and the cut, which is what a comparison needs", () => {
    const line = currentDistributorLine(d());
    expect(line).toContain("CD Baby");
    expect(line).toContain("29.00 USD/yr");
    expect(line).toContain("keeps 9.00% of streaming");
  });

  test("a Postgres date renders as the stored day, not a locale timestamp", () => {
    // A raw Date interpolation prints the wrong day west of UTC.
    const line = currentDistributorLine(d());
    expect(line).toContain("since 2025-03-01");
    expect(line).not.toContain("GMT");
    expect(line).not.toContain("Feb");
  });

  test("a date that arrives as a string is left alone", () => {
    expect(currentDistributorLine(d({ since: "2025-03-01" }))).toContain("since 2025-03-01");
  });

  test("an unrecorded cost says so instead of vanishing", () => {
    // A missing price must not read as free.
    const line = currentDistributorLine(d({ annual_cost: null, currency: null }));
    expect(line).toContain("cost not recorded");
    expect(line).not.toContain("/yr");
  });

  test("a 0% cut is printed, because zero is a real answer", () => {
    // "0.00" is a string and truthy; 0 is a number and falsy. Both must print,
    // and the `!= null` guard in the function is what makes that true.
    expect(currentDistributorLine(d({ cut_streaming_pct: "0.00" }))).toContain("keeps 0.00% of streaming");
    expect(currentDistributorLine(d({ cut_streaming_pct: 0 }))).toContain("keeps 0% of streaming");
  });

  test("an unknown cut is omitted rather than shown as zero", () => {
    expect(currentDistributorLine(d({ cut_streaming_pct: null }))).not.toContain("keeps");
  });

  test("falls back to the slug when the catalog name was never frozen", () => {
    expect(currentDistributorLine(d({ saved_name: null }))).toContain("cd-baby");
  });
});

describe("doubleRepresentation", () => {
  const r = (org_slug: string, status = "registered") => ({ org_slug, status });

  test("one performer society is the correct state, not a warning", () => {
    expect(doubleRepresentation([r("artisti")])).toEqual([]);
  });

  test("two performer societies is the warning, and it says BLOCKED not split", () => {
    const [w] = doubleRepresentation([r("artisti"), r("actra_racs")]);
    expect(w).toContain("actra_racs + artisti");
    expect(w).toContain("BLOCKED");
  });

  test("Re:Sound direct counts as one of the three", () => {
    expect(doubleRepresentation([r("resound"), r("artisti")])).toHaveLength(1);
  });

  test("in_progress still conflicts — the claim is already filed", () => {
    expect(doubleRepresentation([r("artisti"), r("actra_racs", "in_progress")])).toHaveLength(1);
  });

  test("not_started is not a membership and never conflicts", () => {
    expect(doubleRepresentation([r("artisti"), r("actra_racs", "not_started")])).toEqual([]);
  });

  test("Panorama is the producer side and never conflicts with a performer society", () => {
    expect(doubleRepresentation([r("artisti"), r("panorama")])).toEqual([]);
  });

  test("a performer society plus a composition society is not double representation", () => {
    expect(doubleRepresentation([r("artisti"), r("socan"), r("soundexchange")])).toEqual([]);
  });

  test("nothing registered warns about nothing", () => {
    expect(doubleRepresentation([])).toEqual([]);
  });
});

describe("voiceLines — how the artist writes, handed to every drafter", () => {
  const row = {
    guide: "- Opens with the first name, never 'Bonjour à vous'.\n- Two-line paragraphs.\n\n- Signs 'à bientôt, Chloé'.",
    samples: [
      { lang: "fr", context: "to a booker", text: "Salut Marc,\nje t'écris pour la soirée du 14." },
      { lang: "en", context: "to a curator", text: "Hi Sam, quick one about the playlist." },
      { lang: "fr", context: "to a journalist", text: "Allo Julie, merci pour l'article." },
    ],
    source: "38 sent emails, 2025-01 to 2026-09",
  };

  test("no guide means no lines — the Section's `empty` text says what to do", () => {
    expect(voiceLines(null)).toEqual([]);
    expect(voiceLines({ guide: "  ", samples: [] })).toEqual([]);
  });

  test("the guide comes through line by line, blanks and its own bullets dropped, never reworded", () => {
    const lines = voiceLines(row);
    expect(lines[0]).toBe("Opens with the first name, never 'Bonjour à vous'.");
    expect(lines[1]).toBe("Two-line paragraphs.");
    expect(lines[2]).toBe("Signs 'à bientôt, Chloé'.");
  });

  test("samples are verbatim, tagged, and newlines become one line", () => {
    const s = voiceLines(row).find((l) => l.includes("to a booker"));
    expect(s).toBe('Sample (fr, to a booker): "Salut Marc, / je t\'écris pour la soirée du 14."');
  });

  test("the artist's language comes first, the other language still follows", () => {
    const samples = voiceLines(row, { lang: "en" }).filter((l) => l.startsWith("Sample"));
    expect(samples[0]).toContain("(en,");
    expect(samples).toHaveLength(3);
  });

  test("at most VOICE_SAMPLES_MAX samples, each cut at VOICE_SAMPLE_CHARS", () => {
    const many = { guide: "x", samples: Array.from({ length: 10 }, (_, i) => ({ text: "a".repeat(2000) + i })) };
    const samples = voiceLines(many).filter((l) => l.startsWith("Sample"));
    expect(samples).toHaveLength(VOICE_SAMPLES_MAX);
    for (const s of samples) expect(s.length).toBeLessThanOrEqual(VOICE_SAMPLE_CHARS + 'Sample: "…"'.length);
    expect(samples[0]).toContain("…");
  });

  test("a malformed sample is skipped rather than printed as [object Object]", () => {
    const lines = voiceLines({ guide: "x", samples: [null, 3, { text: "" }, { text: "ok" }] });
    expect(lines.filter((l) => l.startsWith("Sample"))).toEqual(['Sample: "ok"']);
  });

  test("the source is named, so a stale guide can be dated", () => {
    expect(voiceLines(row).at(-1)).toBe("Learned from: 38 sent emails, 2025-01 to 2026-09");
  });
});

describe("RULES", () => {
  test("every department under agents/ has an entry", () => {
    // A department missing from RULES silently falls back to core-only.
    const agentsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "agents");
    const departments = readdirSync(agentsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      // agent-recruitor builds departments and reads no artist.* tables.
      .filter((d) => d !== "agent-recruitor");

    const missing = departments.filter((d) => !(d in RULES)).sort();
    expect(missing).toEqual([]);
  });

  test("every CORE_ONLY department is itself a registered rule", () => {
    for (const d of CORE_ONLY) expect(RULES).toHaveProperty(d);
  });
});

describe("editorialWindow", () => {
  const today = "2026-09-03";

  test("open when the release is more than 7 days out", () => {
    const w = editorialWindow("2026-11-14", today);
    expect(w.state).toBe("open");
    expect(w.daysOut).toBe(72);
    expect(w.closesOn).toBe("2026-11-07");
  });

  // "At least 7 days": day seven is open, day six is not.
  test("exactly 7 days out is still open", () => {
    expect(editorialWindow("2026-09-10", today).state).toBe("open");
  });

  test("6 days out is closed", () => {
    expect(editorialWindow("2026-09-09", today).state).toBe("closed");
  });

  test("a released record is closed, not negative-open", () => {
    const w = editorialWindow("2026-08-01", today);
    expect(w.state).toBe("closed");
    expect(w.daysOut).toBeLessThan(0);
  });

  // A missing date must never read as "closed".
  test("no release date is unknown, never closed", () => {
    const w = editorialWindow(null, today);
    expect(w.state).toBe("unknown");
    expect(w.closesOn).toBeNull();
    expect(w.daysOut).toBeNull();
  });
});

describe("ARTIST_TABLES", () => {
  test("covers every table and view the schema files create", () => {
    // The client.ts allowlist guards the SQL string; a schema file without an
    // entry leaves its table silently unreachable.
    const dir = join(dirname(fileURLToPath(import.meta.url)), "..");
    const declared = new Set<string>(ARTIST_TABLES);
    const found = new Set<string>();

    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
      const sql = readFileSync(join(dir, file), "utf8");
      for (const m of sql.matchAll(/create table if not exists artist\.([a-z_]+)/g)) found.add(m[1]!);
      for (const m of sql.matchAll(/create or replace view artist\.([a-z_]+)/g)) found.add(m[1]!);
    }

    const missing = [...found].filter((t) => !declared.has(t) && !UNREACHABLE.has(t)).sort();
    expect(missing).toEqual([]);
  });

  test("the deliberate exclusions are still excluded", () => {
    // artist.connections holds an OAuth refresh token and must stay off the
    // allowlist: `artist_get` hands rows to a model. Never add it to pass a test.
    for (const t of UNREACHABLE) expect(ARTIST_TABLES as readonly string[]).not.toContain(t);
  });
});

describe("dossierLines — what a campaign builds content out of", () => {
  const kit = {
    short_bio: "Des chansons courtes, sans ornement.",
    moodboard_notes: "Sépia et crème, noir et blanc.",
    visual_identity: { primary: "#B5651D", background: "#F5F0E8" },
  };
  const items = [
    { kind: "quote", data: { text: "Elle écrit comme si chaque mot coûtait quelque chose.", source: "VOIR" } },
    { kind: "award", data: { title: "EP folk de l'année", organization: "GAMIQ", year: "2024" } },
    { kind: "show", data: { venue: "Le Ministère", city: "Montréal", date: "2026-10-14" } },
  ];
  const releases = [{ title: "Les fenêtres ouvertes", release_type: "album", release_date: "2026-03-01" }];

  test("brand colours are named by hex, because a content brief cannot use 'on brand'", () => {
    const line = dossierLines({ kit }).find((l) => l.startsWith("Brand colours"));
    expect(line).toContain("#B5651D");
    expect(line).toContain("#F5F0E8");
  });

  test("press quotes and awards come through attributed", () => {
    const lines = dossierLines({ items });
    expect(lines.find((l) => l.startsWith("Press quotes"))).toContain("VOIR");
    expect(lines.find((l) => l.startsWith("Awards"))).toContain("GAMIQ");
  });

  test("the discography is offered as content that needs no shoot", () => {
    const line = dossierLines({ releases }).find((l) => l.startsWith("Discography"));
    expect(line).toContain("Les fenêtres ouvertes (album, 2026)");
    expect(line).toContain("nobody has to shoot");
  });

  test("an artist with nothing on file produces no lines, never empty ones", () => {
    // The Section's `empty` text covers this; blank strings would read as facts.
    expect(dossierLines({})).toEqual([]);
    expect(dossierLines({ kit: null, items: [], releases: [] })).toEqual([]);
  });

  test("every field present yields all eight lines", () => {
    // bio · song count · discography · quotes · awards · shows · colours ·
    // visual direction. If this changes, check the digital-marketing skill too.
    expect(dossierLines({ kit, items, releases, songCount: 12 })).toHaveLength(8);
  });
});
/** Tables data/artist/*.sql creates that agents must NOT reach. See
 *  data/artist/connections.sql and data/artist/connections.test.ts. */
const UNREACHABLE = new Set(["connections"]);

describe("websiteLines — the site's state, as an action", () => {
  test("no row is no lines, so the section prints its `empty`", () => {
    expect(websiteLines(null)).toEqual([]);
  });

  test("a build newer than the deploy says the live site is behind", () => {
    const lines = websiteLines({
      vercel_url: "https://odile-ray.vercel.app",
      domain: "odile-ray.com",
      last_built_at: "2026-09-05T10:00:00Z",
      last_deployed_at: "2026-09-04T10:00:00Z",
      shop_url: "https://odile-ray.bandcamp.com/merch",
    });
    expect(lines[0]).toBe("Live: https://odile-ray.vercel.app (domain odile-ray.com)");
    expect(lines.some((l) => l.includes("live site is behind"))).toBe(true);
    // Every blank names the command that fills it — and only the blanks.
    const blanks = lines.find((l) => l.startsWith("Blank link-outs"))!;
    expect(blanks).toContain("newsletter_url");
    expect(blanks).not.toContain("shop_url");
    expect(blanks).toContain("artist:set website");
  });

  test("never built is said plainly", () => {
    expect(websiteLines({})).toEqual(["Not deployed yet.", "Never built.", expect.stringContaining("Blank link-outs")]);
  });
});
