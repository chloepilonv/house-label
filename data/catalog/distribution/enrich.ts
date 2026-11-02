/**
 * Detail passes: read each distributor's own pages for fields the crawl does
 * not extract. `--pass payout` (default), `delivery` or `addons`; a pass is one
 * PASSES entry, and fetching, retry, spend guard and attempt budget are shared.
 * Each pass counts its own attempts. After MAX_ATTEMPTS reads, missing fields go
 * to `not_stated`. Artist-facing rows only (label-facing publish no terms).
 *
 *   bun run catalog:enrich:distribution                     # payout terms (default)
 *   bun run catalog:enrich:distribution --pass delivery     # artwork + audio specs
 *   bun run catalog:enrich:distribution --pass addons       # what else they sell you
 *   bun run catalog:enrich:distribution --pass addons --engine agent --id distrokid
 *                                                           # a browser session, for a host that 403s Fetch
 *   … --engine agent --id distrokid --url <their add-ons page>
 *                                                           # skip the navigation, read a known page
 *   bun run catalog:enrich:distribution --offline           # stored pages only, no network
 *   bun run catalog:enrich:distribution --limit 5           # cheaper bite
 *   bun run catalog:enrich:distribution --id cd-baby        # one distributor
 */
import postgres from "postgres";
import { z } from "zod";
import { anthropic } from "../crawl/anthropic";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { fetchPages as fetchIntoStore, storedPages, markDerived, urlKey, usableUrl } from "../crawl/pages";
import { tinyfish } from "../crawl/engine";
import { marketingSite } from "../crawl/pages";

const dbUrl = process.env.CATALOG_DATABASE_URL;
if (!dbUrl) { console.error("✗ Set CATALOG_DATABASE_URL (see doc/DEVELOPMENT.md)."); process.exit(1); }
if (!process.env.TINYFISH_API_KEY && !process.argv.includes("--offline")) {
  console.error("✗ Set TINYFISH_API_KEY (or pass --offline to derive from stored pages only).");
  process.exit(1);
}

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const LIMIT = Number(arg("--limit") ?? 50);
const ID = arg("--id");
const PASS_NAME = arg("--pass") ?? "payout";
/**
 *   fetch (default)  TinyFish Fetch → markdown → Claude extracts. Cheap, but
 *                    blind to hosts that refuse a plain GET.
 *   agent            A TinyFish browser session returns the shape itself.
 *                    Bills the TinyFish wallet per page; use with --id.
 */
const ENGINE = arg("--engine") ?? "fetch";
/**
 * Overrides the page the pass would pick; requires --id. Still the vendor's own
 * page, read and written the normal way, for pages no column points at.
 */
const URL_OVERRIDE = arg("--url");
if (URL_OVERRIDE && !ID) {
  console.error("✗ --url names one row's page, so it needs --id <distributor>.");
  process.exit(1);
}
// Longer than the crawler's five minutes: agent sessions spend most of it navigating.
const AGENT_TIMEOUT_MS = 12 * 60 * 1000;
if (ENGINE !== "fetch" && ENGINE !== "agent") {
  console.error(`✗ Unknown --engine ${ENGINE}. One of: fetch, agent`);
  process.exit(1);
}
const MODEL = process.env.CRAWL_EXTRACT_MODEL ?? "claude-sonnet-5";
const MAX_ATTEMPTS = 3;

// Spend guard: the run stops at the budget. Prices are USD per million tokens.
const BUDGET_USD = Number(process.env.CRAWL_BUDGET_USD ?? 10);
const PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-5": { in: 5, out: 25 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};
let spentUsd = 0;
const priceOf = (m: string) =>
  PRICES[m] ?? PRICES[Object.keys(PRICES).find((k) => m.startsWith(k)) ?? ""] ?? { in: 3, out: 15 };
const FETCH_BATCH = 10;
const OFFLINE = argv.includes("--offline");

/** Payout fields. All nullable; verbatim strings, since normalizing invites rounding. */
const PAYOUT = z.object({
  payout_frequency: z.string().nullable().describe(
    "How often the artist is paid, as the page states it — 'monthly', 'weekly', 'twice a year'. Include any stated delay, e.g. 'monthly, ~2 months after streams'"),
  payout_minimum: z.string().nullable().describe(
    "The minimum balance before a payout is sent, verbatim — '$10', '25 USD', 'no minimum'. Null if not stated"),
  payout_methods: z.array(z.string()).nullable().describe(
    "Every payout method the page names — e.g. 'PayPal', 'bank transfer', 'Payoneer', 'cheque'. Null if none are named"),
  next_url: z.string().nullable().describe(
    "A payout / getting-paid / pricing / help-centre page this page links that would state the above, if the fields are missing here. Only a URL the page itself links — never construct one"),
  help_center_url: z.string().nullable().describe(
    "The ROOT of this company's help centre / support site, if this page links one — the front door an artist would browse ('Help', 'Support', 'FAQ'), NOT the specific article. https://support.cdbaby.com/hc/en-us, not .../articles/360037660592. Only a URL this page links; never construct one"),
});

/**
 * What this distributor's upload form accepts, never what the stores accept
 * (that baseline is knowledge/delivery-requirements.md). A page that only
 * repeats a store rule must yield null.
 */
const DELIVERY = z.object({
  artwork_formats: z.array(z.string()).nullable().describe(
    "Image file formats THIS distributor's upload form accepts, lowercase, no dots — ['jpg'] or ['jpg','png','tiff']. Null if the page does not say"),
  artwork_min_px: z.number().nullable().describe(
    "The MINIMUM square pixel dimension this distributor requires, as a single number — 1000 from 'at least 1000x1000'. NOT a recommendation: 'ideally 3000x3000' is a recommendation and must be ignored. Null if only a recommendation is given"),
  artwork_max_px: z.number().nullable().describe(
    "The MAXIMUM square pixel dimension this distributor accepts, as a single number — 3000 from 'no larger than 3000x3000'. Null if the page states no upper limit"),
  audio_formats: z.array(z.string()).nullable().describe(
    "Audio file formats THIS distributor accepts for delivery, lowercase, no dots — ['wav'] or ['wav','flac']. Exclude formats named only as what the artist will RECEIVE or what stores stream. Null if the page does not say"),
  spec_url: z.string().nullable().describe(
    "The URL of this distributor's own file-requirements / artwork / audio specifications page, if this page links one. Only a URL the page itself links — never construct one"),
  help_center_url: z.string().nullable().describe(
    "The ROOT of this company's help centre / support site, if this page links one — the front door an artist would browse ('Help', 'Support', 'FAQ'), NOT the specific article. https://support.cdbaby.com/hc/en-us, not .../articles/360037660592. Only a URL this page links; never construct one"),
  // Artwork and audio specs are usually separate articles; next_url reaches the other.
  next_url: z.string().nullable().describe(
    "A page THIS page links that would state whichever fields above are still missing. If this page covered artwork but said nothing about accepted AUDIO file formats, link its audio/file-format article — they are separate pages in every help centre. Only a URL this page links; never construct one"),
});

/**
 * Paid extras sold beside the deal, by name. An add-on can bill twice (fee and
 * a percentage), so `price` and `cut_pct` are separate; it can also be free
 * inside another plan, which `included_in` records.
 */
const ADDONS = z.object({
  addons: z.array(z.object({
    name: z.string().describe(
      "The product's own name, exactly as this page calls it — 'CDB Boost', 'Store Maximizer', 'Leave a Legacy'. Never a generic description like 'publishing administration'"),
    does: z.string().describe(
      "What the artist gets for it, one sentence, from THIS page only. Never from your own knowledge of the product"),
    price: z.string().nullable().describe(
      "Verbatim, with currency and unit as written — '$39.99', '$4.95 per single per year', '$29 one-time'. Null if this page names the add-on but not its price"),
    price_unit: z.string().nullable().describe(
      "What the price is charged per, when the price string does not already say — 'per release', 'per track per year', 'one-time'. Null otherwise"),
    cut_pct: z.number().nullable().describe(
      "A percentage of revenue this add-on ALSO takes on top of any fee — 20 from 'DistroKid keeps 20% of Content ID revenue'. This is NOT the distribution cut. Null when the page states no percentage"),
    included_in: z.string().nullable().describe(
      "The plan or product that already includes this at no extra charge, if the page names one — 'free on releases distributed with CD Baby Pro'. Null otherwise"),
    excludes: z.string().nullable().describe(
      "What the page says this add-on does NOT cover — 'cover songs are not eligible for mechanical royalty collection'. Null if the page states no exclusion"),
    url: z.string().nullable().describe(
      "The page describing this add-on, if this page links one. Only a URL this page links; never construct one"),
  })).nullable().describe(
    "Every OPTIONAL paid product this page names beside the base distribution deal. Not the features included in a plan — an add-on is something the artist chooses and is billed for separately. Null if this page names none"),
  next_url: z.string().nullable().describe(
    "A pricing / add-ons / album-extras / help-centre page THIS page links that would name the optional paid products, if this page did not. Only a URL this page links — never construct one"),
});

type Addon = z.infer<typeof ADDONS>["addons"];
type Detail = Partial<z.infer<typeof PAYOUT> & z.infer<typeof DELIVERY> & z.infer<typeof ADDONS>>
  & { next_url: string | null };

// Opened before PASSES, whose sql`` fragments are built at construction.
const sql = postgres(dbUrl, { max: 1 });
const client = anthropic();

/**
 * What differs between passes; everything else is shared. `fields` is the
 * not_stated vocabulary and must match real columns.
 */
interface Pass {
  name: "payout" | "delivery" | "addons";
  schema: typeof PAYOUT | typeof DELIVERY | typeof ADDONS;
  system: string;
  /** What the model is reading FOR, one clause, used in the log line. */
  subject: string;
  fields: string[];
  attemptsCol: "enrich_attempts" | "delivery_attempts" | "addons_attempts";
  enrichedCol: "enriched_at" | "delivery_enriched_at" | "addons_enriched_at";
  /** Which rows still have something to learn. */
  needs: ReturnType<typeof sql>;
  /** Which of the row's URLs to read on this attempt. */
  startUrl: (r: Row) => string | null;
  /** Did this read answer everything? If not, one hop to next_url is worth it. */
  complete: (d: Detail) => boolean;
  /** This pass's fields still blank after merging the read into the row. */
  stillEmpty: (r: Row, d: Detail) => string[];
  /** Did the run learn anything at all from this row? */
  learned: (d: Detail) => boolean;
  /** Closing coverage line: three predicates and their labels. */
  stat: [ReturnType<typeof sql>, ReturnType<typeof sql>, ReturnType<typeof sql>];
  labels: [string, string, string];
  /**
   * JSON skeleton for `--engine agent`, hand-written per pass; `agentNotes`
   * carries the what-not-to-fill guidance the Zod `describe()` text gives Claude.
   */
  agentQuery: string;
  agentNotes: string;
}

const PASSES: Record<string, Pass> = {
  payout: {
    name: "payout",
    schema: PAYOUT,
    subject: "payout terms",
    fields: ["payout_frequency", "payout_minimum", "payout_methods"],
    attemptsCol: "enrich_attempts",
    enrichedCol: "enriched_at",
    needs: sql`(payout_frequency is null or payout_minimum is null or cardinality(payout_methods) = 0)`,
    startUrl: (r) => (r.attempts < 2 ? r.url : r.signup_url),
    complete: (d) => Boolean(d.payout_frequency && d.payout_minimum && d.payout_methods?.length),
    stillEmpty: (r, d) => [
      !(r.payout_frequency ?? d.payout_frequency) && "payout_frequency",
      !(r.payout_minimum ?? d.payout_minimum) && "payout_minimum",
      !(r.payout_methods.length || d.payout_methods?.length) && "payout_methods",
    ].filter(Boolean) as string[],
    learned: (d) => Boolean(d.payout_frequency || d.payout_minimum || d.payout_methods?.length),
    stat: [sql`payout_frequency is not null`, sql`payout_minimum is not null`, sql`cardinality(payout_methods)>0`],
    labels: ["frequency", "minimum", "methods"],
    agentQuery: '{"payout_frequency":"string|null","payout_minimum":"string|null","payout_methods":["string"]}',
    agentNotes:
      "Only recording-royalty payouts from this distributor to the artist — not royalty splits, not " +
      "collection societies, not publishing. Copy amounts and frequencies exactly as written.",
    system:
      "You read one music distributor's page and report what it states about how artists get PAID OUT.\n" +
      "Only recording-royalty payouts from this distributor to the artist — not royalty splits, not " +
      "collection societies, not publishing.\n" +
      "NEVER invent a value. If the page does not state a field, return null for it — a null is a useful answer here.\n" +
      "Copy amounts and frequencies exactly as written, in the page's own language.\n" +
      "Report a next_url only if the page links a page that would plainly state the missing fields.",
  },
  delivery: {
    name: "delivery",
    schema: DELIVERY,
    subject: "file requirements",
    fields: ["artwork_formats", "artwork_min_px", "artwork_max_px", "audio_formats"],
    attemptsCol: "delivery_attempts",
    enrichedCol: "delivery_enriched_at",
    needs: sql`(cardinality(artwork_formats) = 0 or artwork_min_px is null or cardinality(audio_formats) = 0)`,
    // spec_url first: `url` is a signup page that never states file specs.
    startUrl: (r) => (r.attempts < 2 ? r.spec_url ?? r.url : r.signup_url),
    complete: (d) => Boolean(d.artwork_formats?.length && d.artwork_min_px && d.audio_formats?.length),
    stillEmpty: (r, d) => [
      !(r.artwork_formats.length || d.artwork_formats?.length) && "artwork_formats",
      !(r.artwork_min_px ?? d.artwork_min_px) && "artwork_min_px",
      !(r.audio_formats.length || d.audio_formats?.length) && "audio_formats",
    ].filter(Boolean) as string[],
    learned: (d) => Boolean(d.artwork_formats?.length || d.artwork_min_px || d.audio_formats?.length),
    stat: [sql`cardinality(artwork_formats)>0`, sql`artwork_min_px is not null`, sql`cardinality(audio_formats)>0`],
    labels: ["artwork formats", "artwork minimum", "audio formats"],
    agentQuery: '{"artwork_formats":["string"],"artwork_min_px":"number|null","artwork_max_px":"number|null","audio_formats":["string"],"spec_url":"string|null"}',
    agentNotes:
      "Report only what THIS distributor requires — never what Spotify or Apple Music requires, and never " +
      "an industry norm. A MINIMUM is not a RECOMMENDATION: 'ideally 3000x3000' is a recommendation and " +
      "artwork_min_px must be null for it.",
    system:
      "You read one music distributor's page and report the file requirements THAT DISTRIBUTOR imposes on " +
      "music uploaded to it.\n" +
      "THE ONE RULE THAT MATTERS: report only what THIS page states about THIS distributor. Do not report " +
      "what Spotify, Apple Music or any store requires, even if the page mentions it, and never fill a field " +
      "from your own knowledge of industry norms. '3000x3000' is the most repeated number in this industry " +
      "and is a recommendation almost everywhere — returning it when the page did not state it as a minimum " +
      "destroys the only thing this extraction is for.\n" +
      "A MINIMUM is not a RECOMMENDATION. 'must be at least 1000x1000' is a minimum. 'ideally 3000x3000', " +
      "'we recommend 3000x3000', 'for best results' are recommendations — return null for artwork_min_px " +
      "when only a recommendation is given.\n" +
      "NEVER invent a value. A null means the page did not say, which is the answer being measured.\n" +
      "Report a next_url or spec_url only if the page links one — never construct a URL.\n" +
      "Artwork and audio requirements live on SEPARATE help pages almost everywhere. If you were given an " +
      "artwork page, audio_formats will be null and that is correct — set next_url to the linked article about " +
      "audio or accepted file formats so it can be read next.",
  },
  addons: {
    name: "addons",
    schema: ADDONS,
    subject: "add-on services",
    // One field: the list is either found or not.
    fields: ["addons"],
    attemptsCol: "addons_attempts",
    enrichedCol: "addons_enriched_at",
    needs: sql`jsonb_array_length(addons) = 0`,
    // The site root, not `url` (a signup form names no products). The last
    // attempt reads signup_url, where a checkout upsell would appear.
    startUrl: (r) => {
      if (r.attempts >= 2) return r.signup_url ?? r.url;
      return marketingSite(r.url);
    },
    // Never complete: always take the hop to next_url.
    complete: () => false,
    stillEmpty: (r, d) => (r.addons.length || d.addons?.length ? [] : ["addons"]),
    learned: (d) => Boolean(d.addons?.length),
    stat: [sql`jsonb_array_length(addons) > 0`, sql`addons @? '$[*].price'`, sql`'addons' = any(not_stated)`],
    labels: ["any add-on", "with a price", "confirmed none"],
    agentQuery: '{"addons":[{"name":"string","does":"string","price":"string|null","price_unit":"string|null","cut_pct":"number|null","included_in":"string|null","excludes":"string|null","url":"string|null"}]}',
    agentNotes:
      "An add-on is an OPTIONAL paid product the artist chooses and is billed for separately — 'CDB Boost', " +
      "'Store Maximizer', 'Leave a Legacy'. A feature included in a plan the artist already pays for is NOT " +
      "an add-on, and reporting one as an add-on invents a bill. Report the product's OWN name as the page " +
      "writes it. If an add-on charges a fee AND keeps a percentage of what it collects, put the fee in " +
      "price and the percentage in cut_pct — never fold one into the other.\n" +
      "NAVIGATE FIRST, EXTRACT SECOND. You are usually given a homepage, and a homepage lists no products. " +
      "Find this site's pricing, plans, features or help-centre page — follow its own navigation, its footer, " +
      "or its 'Pricing' link — and read THAT. Measured: six sessions started at a homepage and five returned " +
      "nothing, because they never left it.\n" +
      "Returning an empty list is a real answer, but only after you have actually opened a pricing page. If " +
      "you could not find one, say so by returning an empty list rather than reporting the homepage's " +
      "marketing copy as products.",
    system:
      "You read one music distributor's page and report the OPTIONAL PAID PRODUCTS it sells beside the " +
      "distribution deal itself.\n" +
      "THE DISTINCTION THAT MATTERS: an add-on is something the artist CHOOSES and is billed for separately " +
      "— CD Baby's 'CDB Boost', DistroKid's 'Store Maximizer', an extra artist profile. A feature listed as " +
      "part of a plan the artist already pays for is NOT an add-on, and reporting one as an add-on invents a " +
      "bill. If the page is a plan-comparison table, report only what it prices outside the plans.\n" +
      "Report the product's OWN NAME, as the page writes it. 'CDB Boost' is the answer; 'publishing " +
      "administration' is a category and is not.\n" +
      "An add-on can bill twice — an annual fee AND a percentage of what it collects. Put the fee in price " +
      "and the percentage in cut_pct; never fold one into the other.\n" +
      "An add-on can be free inside something else. If the page says it is included with another product, " +
      "say so in included_in — otherwise the artist is quoted a bill they may not owe.\n" +
      "NEVER invent a price, and never supply one from your own knowledge of these companies. A named add-on " +
      "with a null price is a correct and useful answer; a remembered figure is not.\n" +
      "Return null for addons if this page names no optional paid products, and set next_url to the pricing " +
      "or add-ons page it links, if it links one.",
  },
};

const PASS = PASSES[PASS_NAME];
if (!PASS) {
  console.error(`\u2717 Unknown --pass ${PASS_NAME}. One of: ${Object.keys(PASSES).join(", ")}`);
  process.exit(1);
}


async function getPages(urls: string[]): Promise<Map<string, { text: string; links: string[] }>> {
  const out = new Map<string, { text: string; links: string[] }>();
  const pages = OFFLINE
    ? await storedPages(sql, urls)
    : await fetchIntoStore(sql, urls, { topic: "distribution", kind: "detail" });
  for (const [k, p] of pages)
    if (p.status === "ok" && p.markdown.trim()) out.set(k, { text: p.markdown, links: p.links });
  return out;
}

/**
 * `landed` is whether the model answered at all. A call that failed (auth,
 * quota, network) must not spend an attempt, or not_stated would be written
 * for fields nobody read.
 */
interface Attempt<T> {
  value: T | null;
  /** False when the call itself failed — auth, quota, network, a refusal. */
  landed: boolean;
}

async function withRetry<T>(fn: () => Promise<T>, label: string, tries = 3): Promise<Attempt<T>> {
  for (let i = 1; i <= tries; i++) {
    try { return { value: await fn(), landed: true }; }
    catch (e) {
      const m = (e as Error).message ?? "";
      const transient = /ECONNRESET|socket|timeout|429|rate.?limit|overloaded|50\d/i.test(m);
      if (!transient || i === tries) {
        console.warn(`  ${label}: ${m.slice(0, 100)}`);
        return { value: null, landed: false };
      }
      await new Promise((r) => setTimeout(r, 2000 * i * i));
    }
  }
  return { value: null, landed: false };
}

async function readDetail(name: string, page: { text: string; links: string[] }, url: string) {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4_000,
    ...(MODEL.startsWith("claude-haiku") ? {} : { thinking: { type: "adaptive" as const } }),
    output_config: {
      format: zodOutputFormat(PASS.schema as typeof PAYOUT, "detail"),
      ...(MODEL.startsWith("claude-haiku") ? {} : { effort: "low" as const }),
    },
    system: PASS.system,
    messages: [{
      role: "user",
      content: `Distributor: ${name}\nPage: ${url}\n\n${page.text.slice(0, 60_000)}` +
        (page.links.length ? `\n\nLinks on this page:\n${page.links.slice(0, 120).join("\n")}` : ""),
    }],
  });
  const msg = await stream.finalMessage();
  const p = priceOf(MODEL);
  spentUsd += ((msg.usage?.input_tokens ?? 0) * p.in + (msg.usage?.output_tokens ?? 0) * p.out) / 1_000_000;
  if (msg.stop_reason === "refusal") return null;
  const block = msg.content.find((b) => b.type === "text");
  if (!block) return null;
  if ("parsed" in block && block.parsed) return block.parsed as Detail;
  try { return JSON.parse((block as { text: string }).text) as Detail; }
  catch { return null; }
}

/** A row mid-pass. All passes' columns are selected so the write can coalesce. */
interface Row {
  id: string; name: string; url: string; signup_url: string | null;
  payout_frequency: string | null; payout_minimum: string | null; payout_methods: string[];
  artwork_formats: string[]; artwork_min_px: number | null; audio_formats: string[];
  spec_url: string | null;
  addons: NonNullable<Addon>;
  not_stated: string[]; attempts: number;
}

// Hand-written per pass: arrays and jsonb are empty, not null.
const needs = PASS.needs;
const attemptsCol = sql(PASS.attemptsCol);

const rows = await sql<Row[]>`
  select id, name, url, signup_url,
         payout_frequency, payout_minimum, payout_methods,
         artwork_formats, artwork_min_px, audio_formats, spec_url, addons,
         not_stated, ${attemptsCol} as attempts
  from catalog.distribution_services
  where lifecycle <> 'retired'
    and layer = 'artist_facing'
    and ${attemptsCol} < ${MAX_ATTEMPTS}
    and ${needs}
    ${ID ? sql`and id = ${ID}` : sql``}
  order by ${attemptsCol}, id
  limit ${LIMIT}`;

/**
 * The one write for every pass and engine. Existing values always win:
 * coalesce scalars, write arrays only when none are recorded.
 */
async function writeDetail(r: Row, d: Detail, attempts: number, notStated: string[]): Promise<void> {
  const enrichedCol = sql(PASS.enrichedCol);
  // Serialized, not bound as an array: postgres.js would send text[], which
  // does not cast to jsonb. null coalesces to the existing value.
  const addonsJson = d.addons?.length ? JSON.stringify(d.addons) : null;
  // ::text::jsonb, never bare ::jsonb: a bare cast stores the array as a jsonb
  // string, which only fails on the next run's jsonb_array_length().
  await sql`update catalog.distribution_services set
    payout_frequency = coalesce(payout_frequency, ${d.payout_frequency ?? null}),
    payout_minimum   = coalesce(payout_minimum, ${d.payout_minimum ?? null}),
    payout_methods   = case when cardinality(payout_methods) > 0 then payout_methods
                            when ${(d.payout_methods ?? null) as string[] | null}::text[] is null then payout_methods
                            else ${(d.payout_methods ?? null) as string[] | null} end,
    artwork_formats  = case when cardinality(artwork_formats) > 0 then artwork_formats
                            when ${(d.artwork_formats ?? null) as string[] | null}::text[] is null then artwork_formats
                            else ${(d.artwork_formats ?? null) as string[] | null} end,
    artwork_min_px   = coalesce(artwork_min_px, ${d.artwork_min_px ?? null}),
    artwork_max_px   = coalesce(artwork_max_px, ${d.artwork_max_px ?? null}),
    audio_formats    = case when cardinality(audio_formats) > 0 then audio_formats
                            when ${(d.audio_formats ?? null) as string[] | null}::text[] is null then audio_formats
                            else ${(d.audio_formats ?? null) as string[] | null} end,
    spec_url         = coalesce(spec_url, ${d.spec_url ?? null}),
    -- coalesce, unlike spec_url's siblings, because help-centres.ts is the
    -- checked value and a crawl guess must never displace it. This fills the
    -- rows that list has never heard of — a distributor discovered next week.
    help_center_url  = coalesce(help_center_url, ${d.help_center_url ?? null}),
    addons           = case when jsonb_array_length(addons) > 0 then addons
                            else coalesce(${addonsJson}::text::jsonb, addons) end,
    not_stated       = ${notStated},
    ${enrichedCol}   = now(),
    ${attemptsCol}   = ${attempts}
    where id = ${r.id}`;
}

/** One line of what a row just learned, for the agent engine's per-row log. */
const summarize = (d: Detail): string =>
  d.addons?.length ? `${d.addons.length} add-on(s): ${d.addons.map((a) => a.name).join(", ").slice(0, 90)}`
  : [d.payout_frequency, d.payout_minimum, d.payout_methods?.join("/"),
     d.artwork_formats?.join("/"), d.artwork_min_px, d.audio_formats?.join("/")]
      .filter(Boolean).join(" · ").slice(0, 110) || "nothing";

console.log(`${rows.length} distributor(s) to enrich for ${PASS.subject} (model: ${MODEL})`);
let filled = 0, marked = 0, failed = 0;

for (let i = 0; i < rows.length; i += FETCH_BATCH) {
  if (spentUsd >= BUDGET_USD) {
    console.log(`\n■ stopping at $${spentUsd.toFixed(2)} — CRAWL_BUDGET_USD is $${BUDGET_USD}. ` +
      `${rows.length - i} row(s) left for the next run; nothing is lost.`);
    break;
  }
  const batch = rows.slice(i, i + FETCH_BATCH);

  // ── --engine agent: one browser session per row, no Fetch, no Claude ──
  // Shares the attempt budget, not_stated rule and write; nothing else.
  if (ENGINE === "agent") {
    for (const r of batch) {
      const url = URL_OVERRIDE ?? PASS.startUrl(r) ?? r.url;
      const shape = `${PASS.agentQuery}\n${PASS.agentNotes}\nNever invent a value; null is a useful answer.`;
      let d: Detail | null = null;
      try {
        d = (await tinyfish(url, shape, "stealth", undefined, AGENT_TIMEOUT_MS)) as Detail;
      } catch (e) {
        console.warn(`  ${r.name}: agent session failed — ${(e as Error).message.slice(0, 100)} — attempt not spent`);
        failed++;
        continue;
      }
      if (!d || typeof d !== "object") {
        console.warn(`  ${r.name}: agent returned nothing usable — attempt not spent`);
        failed++;
        continue;
      }
      const attempts = r.attempts + 1;
      const stillEmpty = PASS.stillEmpty(r, d);
      const notStated = attempts >= MAX_ATTEMPTS
        ? [...new Set([...r.not_stated, ...stillEmpty])]
        : r.not_stated;
      if (notStated.length > r.not_stated.length) marked++;
      await writeDetail(r, d, attempts, notStated);
      if (PASS.learned(d)) { filled++; console.log(`  ✓ ${r.name} — ${summarize(d)}`); }
      else console.log(`  · ${r.name} — nothing on ${url}`);
    }
    console.log(`  ${Math.min(i + FETCH_BATCH, rows.length)}/${rows.length} · filled ${filled} · not-stated ${marked} · unreachable ${failed}`);
    continue;
  }

  // Each pass picks its page per attempt; see startUrl.
  const urls = batch.map((r) => PASS.startUrl(r) ?? r.url);
  const pages = await getPages(urls);

  for (const [j, r] of batch.entries()) {
    const url = usableUrl(urls[j]) ?? urls[j];
    const page = pages.get(urlKey(url));
    if (!page) {
      // A stored record means the page answered with nothing: spend an attempt.
      // No record means the fetch layer failed (e.g. an outage): do not.
      failed++;
      const stored = (await storedPages(sql, [url])).get(urlKey(url));
      if (stored) await sql`update catalog.distribution_services set ${attemptsCol} = ${attemptsCol} + 1 where id = ${r.id}`;
      else console.warn(`  ${r.name}: fetch layer returned nothing for ${url} — attempt not spent`);
      continue;
    }

    const first = await withRetry(() => readDetail(r.name, page, url), `extract ${r.name.slice(0, 30)}`);
    await markDerived(sql, url, MODEL);
    if (!first.value) {
      failed++;
      // Spend an attempt only if the model answered. See Attempt above.
      if (first.landed) await sql`update catalog.distribution_services set ${attemptsCol} = ${attemptsCol} + 1 where id = ${r.id}`;
      else console.warn(`  ${r.name}: extraction never landed — attempt not spent`);
      continue;
    }
    let d = first.value;
    // One hop to the page the site links; further hops are the next run's job.
    if (d.next_url && !PASS.complete(d)) {
      // Captured before `d` is reassigned below.
      const nextUrl = d.next_url;
      const g = await getPages([nextUrl]);
      const gp = g.get(urlKey(nextUrl));
      if (gp) {
        const gd = (await withRetry(() => readDetail(r.name, gp, nextUrl), `${PASS.name} page`)).value;
        // Merge, first answer wins.
        if (gd) d = {
          payout_frequency: d.payout_frequency ?? gd.payout_frequency,
          payout_minimum: d.payout_minimum ?? gd.payout_minimum,
          payout_methods: d.payout_methods?.length ? d.payout_methods : gd.payout_methods,
          artwork_formats: d.artwork_formats?.length ? d.artwork_formats : gd.artwork_formats,
          artwork_min_px: d.artwork_min_px ?? gd.artwork_min_px,
          audio_formats: d.audio_formats?.length ? d.audio_formats : gd.audio_formats,
          spec_url: d.spec_url ?? gd.spec_url ?? nextUrl,
          // Add-ons concatenate (each page may list different ones), deduped on name.
          addons: [...(d.addons ?? []), ...(gd.addons ?? [])]
            .filter((a, i, all) => all.findIndex((b) => b.name.toLowerCase() === a.name.toLowerCase()) === i),
          help_center_url: d.help_center_url ?? gd.help_center_url,
          next_url: null,
        };
      }
    }

    const attempts = r.attempts + 1;
    // not_stated only after the last attempt, and only for this pass's fields.
    const stillEmpty = PASS.stillEmpty(r, d);
    const notStated = attempts >= MAX_ATTEMPTS
      ? [...new Set([...r.not_stated, ...stillEmpty])]
      : r.not_stated;
    if (notStated.length > r.not_stated.length) marked++;

    await writeDetail(r, d, attempts, notStated);
    if (PASS.learned(d)) filled++;
  }
  console.log(`  ${Math.min(i + FETCH_BATCH, rows.length)}/${rows.length} · filled ${filled} · not-stated ${marked} · unreachable ${failed} · $${spentUsd.toFixed(2)}`);
}

const { stat, labels } = PASS;
const [after] = await sql`select
  round(100.0*count(*) filter (where ${stat[0]!})/nullif(count(*),0))::int a,
  round(100.0*count(*) filter (where ${stat[1]!})/nullif(count(*),0))::int b,
  round(100.0*count(*) filter (where ${stat[2]!})/nullif(count(*),0))::int c
  from catalog.distribution_services where layer = 'artist_facing' and lifecycle <> 'retired'`;
console.log(`\n✓ artist-facing rows now — ${labels[0]} ${after.a}% · ${labels[1]} ${after.b}% · ${labels[2]} ${after.c}%`);
console.log(`  spent this run: $${spentUsd.toFixed(2)} of $${BUDGET_USD} budget`);
await sql.end();
