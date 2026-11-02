/**
 * Distribution crawler, mapping half only: extracted page → catalog.distribution_services
 * rows. Sources live in catalog.crawl_sources.
 * Store counts are kept as marketing claims, never coverage; signup URLs come
 * from the page's own links, never guessed.
 */
import { z } from "zod";
import type { Crawler, Row, SourceRow, EngineUsed } from "../crawl/types";

/**
 * The extraction schema for the `fetch` engine. All but `name` is nullable so
 * the model can say "not stated" instead of inventing.
 * Kept small: large schemas with enums or nested objects exceed the API's
 * grammar limit, so enums are plain strings narrowed by the mapper. Other
 * columns come from enrich.ts.
 */
const SERVICE = z.object({
  name: z.string().describe("Company name exactly as written"),
  description: z.string().nullable().describe("One or two sentences: who they are, who they suit"),
  layer: z.string().nullable().describe("artist_facing | label_facing | platform"),
  hq_country: z.string().nullable().describe("Two-letter country of head office"),
  founded_year: z.number().nullable(),
  parent_company: z.string().nullable().describe("Owner if not independent"),
  submission_policy: z.string().nullable().describe("open | application | referral | closed"),
  signup_url: z.string().nullable().describe("Only if the page links it — never construct one"),
  contact_email: z.string().nullable(),
  currency: z.string().nullable().describe("ISO code of the currency the prices are in. A page written in French from a Canadian company showing '40$' is CAD, not USD. Only answer USD if the page shows US$ or is a US company. Null if genuinely unclear"),
  fee_model: z.string().nullable().describe("subscription | per_release | per_track | revenue_share | hybrid | negotiated"),
  price_tiers: z.string().nullable().describe("Every plan as one line each: 'Musician $24.99/year, 1 artist'"),
  // Extract the artist's share as printed; the company's cut is computed here,
  // because models misread "keep 100%" as a 100% cut.
  artist_keeps_streaming_pct: z.number().nullable().describe("The percentage of streaming royalties the ARTIST keeps, exactly as the page states it. 'Keep 100% of your earnings' is 100. 'Keep 85%' is 85. 'We take 9%' is 91. Null if no percentage is printed"),
  artist_keeps_social_pct: z.number().nullable().describe("Same, for TikTok/Meta/YouTube earnings, if stated separately"),
  payout_frequency: z.string().nullable(),
  lapse_behavior: z.string().nullable().describe("What happens to released music if the artist stops paying"),
  store_count_claimed: z.string().nullable().describe("The vendor's own marketing figure, e.g. '150+'"),
  delivery_lead_time_days: z.number().nullable().describe("Days from upload to live in stores, only if stated"),
  content_id: z.boolean().nullable().describe("YouTube Content ID included"),
  grant_eligibility_ca: z.string().nullable().describe("Canadian funders the page claims membership makes you eligible for"),
  not_stated: z.string().nullable().describe("Comma-separated field names you looked for on this page and could not find"),
});

export const DISTRIBUTION_SCHEMA = z.object({
  services: z.array(SERVICE).describe(
    "The distribution companies this page is ABOUT. A company's own website is about exactly ONE company — itself — so return a single entry, " +
    "even when the page names partners, clients, competitors or platforms it integrates with. Only a directory that exists to list many providers returns more than one."),
});

/** Artist's share → the company's cut. 100 kept means 0 taken. */
const pctTaken = (keeps: unknown): number | null =>
  typeof keeps === "number" && keeps >= 0 && keeps <= 100 ? 100 - keeps : null;

const provenance = (engine: EngineUsed) =>
  engine === "puppeteer" ? "crawl_puppeteer"
  : engine === "fetch" ? "crawl_fetch"
  : "crawl_tinyfish";

function servicesToRows(extracted: unknown, source: SourceRow, engine: EngineUsed): Row[] {
  const services = (extracted as { services?: Record<string, unknown>[] })?.services ?? [];
  const scope = source.scope as {
    layer?: string; country?: string; directory_section?: string; discovery_only?: boolean;
  };

  // A directory source only discovers names and writes nothing: its thin rows
  // would overwrite detailed ones, and it lists out-of-scope (non CA/US)
  // companies. Names worth tracking become detail sources at review.
  if (scope.discovery_only) {
    const names = services
      .map((x) => (typeof x?.name === "string" ? x.name.trim() : ""))
      .filter(Boolean)
      .sort();
    console.log(`  [${source.id}] discovered ${names.length} providers, wrote 0 rows (discovery_only)`);
    console.log(`  [${source.id}] review for CA/US scope, then add as detail sources:`);
    console.log(`    ${names.join(", ")}`);
    return [];
  }

  return services
    .filter((s) => s && typeof s.name === "string" && s.name.trim())
    .map((s) => {
      const oneOf = (v: unknown, allowed: string[], fallback: string) =>
        typeof v === "string" && allowed.includes(v) ? v : fallback;
      const list = (v: unknown) =>
        typeof v === "string" ? v.split(",").map((x) => x.trim()).filter(Boolean) : [];
      return {
        // Keyed on the source id, not the extracted name, which varies per crawl.
        id: source.id,
        name: String(s.name).trim(),
        url: (s.signup_url as string) ?? source.url,
        description: s.description ?? null,

        layer: oneOf(s.layer, ["artist_facing", "label_facing", "platform"], (scope.layer as string) ?? "artist_facing"),
        hq_country: s.hq_country ?? null,
        founded_year: s.founded_year ?? null,
        parent_company: s.parent_company ?? null,

        submission_policy: oneOf(s.submission_policy, ["open", "application", "referral", "closed"], "unknown"),
        signup_url: s.signup_url ?? null,
        contact_email: s.contact_email ?? null,

        // Never default: cad_pricing derives from it.
        currency: (s.currency as string) ?? null,
        fee_model: oneOf(s.fee_model, ["subscription", "per_release", "per_track", "revenue_share", "hybrid", "negotiated"], "unknown"),
        price_tiers: JSON.stringify(list(s.price_tiers).map((t) => ({ raw: t }))),
        cut_streaming_pct: pctTaken(s.artist_keeps_streaming_pct),
        cut_social_pct: pctTaken(s.artist_keeps_social_pct),
        payout_frequency: s.payout_frequency ?? null,

        lapse_behavior: s.lapse_behavior ?? null,

        store_count_claimed: s.store_count_claimed ?? null,
        content_id: s.content_id ?? null,
        delivery_lead_time_days: s.delivery_lead_time_days ?? null,

        // Derived from the quoted currency, not asked for.
        cad_pricing: String(s.currency ?? "").toUpperCase() === "CAD",  // explicit CAD only
        grant_eligibility_ca: list(s.grant_eligibility_ca),

        spotify_directory_section: scope.directory_section ?? null,

        not_stated: list(s.not_stated),
        source: provenance(engine),
        source_url: source.url,
      } as Row;
    });
}

export const crawler: Crawler = {
  topic: "distribution",
  table: "catalog.distribution_services",
  conflict: ["id"],
  identity: "slug",
  schema: DISTRIBUTION_SCHEMA,
  toRows: servicesToRows,
  // ADA renders nothing to Fetch; read its DOM with Puppeteer instead of the billed engine.
  puppeteer: {
    ada: async (page) => {
      const text: string = await page.evaluate(() => {
        document.querySelectorAll("script,style,noscript,svg").forEach((e) => e.remove());
        return (document.body?.innerText ?? "").slice(0, 6000);
      });
      return {
        services: [{
          name: "ADA",
          description: text.replace(/\s+/g, " ").slice(0, 400) || null,
          layer: "label_facing",
          hq_country: "US",
          parent_company: "Warner Music Group",
          submission_policy: "application",
          fee_model: "negotiated",
        }],
      };
    },
  },

  // Used to verify a row when a directory stops listing the company.
  detailUrl: (row) => (typeof row.url === "string" ? row.url : null),
};
