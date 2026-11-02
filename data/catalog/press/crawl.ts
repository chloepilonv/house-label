/**
 * Press crawler, mapping half only (sources live in catalog.crawl_sources).
 * Writes press_outlets: one row per media, never a person; a masthead yields
 * one outlet with its desk address. No sources are active yet.
 */
import { z } from "zod";
import type { Crawler, Row, SourceRow, EngineUsed } from "../crawl/types";

/**
 * The field contract for the `fetch` engine. Plain scalars only, no enums or
 * nesting. `tier` and `outlet_type` come from the source's scope, not the page.
 */
const OUTLET = z.object({
  outlet: z.string().describe("Publication or show name, exactly as written"),
  website: z.string().nullable().describe("Only if the page links it"),
  submission_url: z.string().nullable().describe("The page that says how to send music or pitch, if linked"),
  desk_email: z.string().nullable().describe(
    "A ROLE address printed on the page — info@, tips@, music@, redaction@. Never a named person's address, never constructed"),
  submission_method: z.string().nullable().describe(
    "How this outlet says to send music, in its own words — 'email a private SoundCloud link', " +
    "'use the form below', 'no attachments'. Copy the instruction, do not summarize it into the word 'email'"),
  genre_fit: z.string().nullable().describe(
    "Genres this outlet covers, comma-separated, only if the page says so. Use these " +
    "words where they fit: hip hop, indie rock, electronic, jazz, folk, classical, experimental, " +
    "punk, metal, country, pop, rnb, soul, funk, ambient, world, reggae, alternative. " +
    "Answer 'all' if it explicitly covers everything"),
});

export const PRESS_SCHEMA = z.object({
  outlets: z.array(OUTLET).describe(
    "Every media outlet this page lists or describes. A masthead returns ONE outlet, not one row per person."),
});

const provenance = (engine: EngineUsed) =>
  engine === "puppeteer" ? "crawl_puppeteer" : "crawl_tinyfish";

const OUTLET_TYPES = ["newspaper", "magazine", "blog", "webzine", "tv"] as const;
const MARKETS = ["quebec", "canada", "us"] as const;
const LANGUAGES = ["fr", "en", "bilingual"] as const;
const GENRES = ["all", "hip_hop", "indie_rock", "electronic", "jazz", "folk", "classical",
  "experimental", "punk", "metal", "country", "pop", "rnb", "soul", "funk", "ambient", "world",
  "reggae", "alternative"] as const;

/** A desk mailbox, not a person: info@, tips@, musique@. */
const GENERIC_MAILBOX = /^(info|contact|r[eé]daction|music|musique|submissions?|submit|editors?|editorial|news|tips|press|presse|hello|bonjour|reviews?|media|pr|promo|publicity|culture|arts|general|office|staff|team|newsroom|desk|coverage|pitch|events|listings|features|communications)([._-][a-z0-9]+)?$/i;
const WEBMAIL = /^(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|me|proton|protonmail|videotron|sympatico|bell)\./i;

/** Keep an address only when it is a desk's, on a real domain. */
export const deskEmail = (v: unknown): string | undefined => {
  const e = typeof v === "string" ? v.trim().toLowerCase() : "";
  const [local, host] = e.split("@");
  if (!local || !host) return undefined;
  return GENERIC_MAILBOX.test(local) && !WEBMAIL.test(host) ? e : undefined;
};

const term = (x: string) =>
  x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const vocab = (v: unknown, allowed: readonly string[]): string[] =>
  typeof v === "string"
    ? [...new Set(v.split(/[,;/]/).map(term).filter((x) => allowed.includes(x)))]
    : [];

const text = (v: unknown): string | undefined => {
  const x = typeof v === "string" ? v.trim() : "";
  return x || undefined;
};

/**
 * Does the name survive the schema's slug generation with anything left?
 * An empty slug is a unique violation that costs the rest of the source.
 * Folds exactly as the Postgres expression does, not NFD.
 */
const slugSurvives = (v: string): boolean => {
  const FROM = "àâäáãåçèéêëìíîïñòóôöõùúûüýÿ";
  const TO = "aaaaaaceeeeiiiinooooouuuuyy";
  const folded = v.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae")
    .split("").map((ch) => { const i = FROM.indexOf(ch); return i === -1 ? ch : TO[i]; }).join("");
  return /[a-z0-9]/.test(folded);
};

/**
 * Drop undefined keys. `upsertRow` writes every key present, so a null or a
 * default-looking value would erase what another source learned.
 */
const defined = (row: Record<string, unknown>): Row =>
  Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));

const oneOf = (source: SourceRow, key: string, v: unknown, allowed: readonly string[]): string => {
  if (typeof v !== "string") throw new Error(`source ${source.id}: scope.${key} must be a string, got ${JSON.stringify(v)}`);
  const t = term(v);
  if (!allowed.includes(t)) throw new Error(`source ${source.id}: scope.${key} must be one of ${allowed.join(", ")}, got ${JSON.stringify(v)}`);
  return t;
};

function outletsToRows(extracted: unknown, source: SourceRow, engine: EngineUsed): Row[] {
  // `{outlets: []}` is evidence. A non-array is a config error: returning []
  // would mark every row of this source missing.
  const raw = (extracted as { outlets?: unknown })?.outlets;
  if (raw !== undefined && raw !== null && !Array.isArray(raw)) {
    throw new Error(`source ${source.id}: extraction returned outlets as ${typeof raw}, not an array`);
  }
  const items = (Array.isArray(raw) ? raw : []) as Record<string, unknown>[];
  const scope = source.scope as {
    outlet_type?: string; market?: string; language?: string; city?: string;
    tier?: number; discovery_only?: boolean;
  };
  // scope is hand-written jsonb with no CHECK, so validate it loudly here.
  if (!scope.outlet_type || !scope.market) {
    throw new Error(`source ${source.id}: scope needs outlet_type and market`);
  }
  const outlet_type = oneOf(source, "outlet_type", scope.outlet_type, OUTLET_TYPES);
  const market = oneOf(source, "market", scope.market, MARKETS);
  const country = market === "us" ? "US" : "CA";
  // Absent when scope omits it, so the column default applies.

  const language = scope.language == null ? undefined : oneOf(source, "language", scope.language, LANGUAGES);
  const tier = Number.isInteger(scope.tier) && (scope.tier as number) >= 1 && (scope.tier as number) <= 3
    ? scope.tier : undefined;
  const city = text(scope.city);

  const named = items.filter((c) => c && typeof c.outlet === "string" && c.outlet.trim());

  // A directory of outlets DISCOVERS them; it must never write their fields.
  if (scope.discovery_only) {
    const names = named.map((c) => String(c.outlet).trim()).sort();
    console.log(`  [${source.id}] discovered ${names.length} outlets, wrote 0 rows (discovery_only)`);
    console.log(`    ${names.join(", ")}`);
    return [];
  }

  return named.flatMap((c) => {
    const outlet = String(c.outlet).trim();
    if (!slugSurvives(outlet)) {
      console.log(`  [${source.id}] skipped ${JSON.stringify(outlet)}: nothing left after slugification`);
      return [];
    }
    return [defined({
      outlet,
      outlet_type,
      market,
      country,
      city,
      language,
      tier,
      website: text(c.website),
      submission_url: text(c.submission_url),
      // A person's address is dropped here, in code, whatever the page printed.
      desk_email: deskEmail(c.desk_email),
      submission_method: text(c.submission_method),
      genre_fit: c.genre_fit == null ? undefined : vocab(c.genre_fit, GENRES),
      source: provenance(engine),
      source_url: source.url,
    })];
  });
}

export const crawler: Crawler = {
  topic: "press",
  table: "catalog.press_outlets",
  schema: PRESS_SCHEMA,
  conflict: ["outlet"],
  identity: "slug",
  toRows: outletsToRows,
  // The outlet's own site: a live site restores the row.
  detailUrl: (row) => (typeof row.website === "string" ? row.website : null),
};

export const __test = { term, vocab, text, defined, slugSurvives, deskEmail, OUTLET_TYPES, MARKETS, LANGUAGES, GENRES };
