/**
 * What every step of a release costs, and where each number came from.
 *
 * Every figure in `PRICES` is a vendor's published number with its page and
 * date; a quantity we chose says so in its `basis`. Each step is priced at
 * three ends (floor, aim, full), summed into bare/decent/full tiers. Vendors
 * are named as sources, never as recommendations.
 * Pure: no clock, database, network or currency conversion.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Anchors, Owner, Scope, Source, Text, Warning } from "./milestones";

/** `local` = billed in the artist's own account currency (Meta, Spotify Ads). */
export type Currency = "CAD" | "USD" | "local";
export type Money = { amount: number; currency: Currency };
export type BudgetCurrency = "CAD" | "USD";

/**
 * Where every price came from. Merged into `SOURCES` by milestones.ts, so the
 * page renders them beside the date sources and the same test fails when a
 * cost cites a source that does not exist.
 */
export const COST_SOURCES: Record<string, Source> = {
  "earshot-cost": {
    title: "!earshot Distro — what it costs",
    url: "https://earshot-distro.ca/cost/",
    verified: "2026-08-14",
  },
  "45tours": {
    title: "45tours.ca — comment ça marche (tarifs 2026)",
    url: "https://www.45tours.ca/commentCaMarche",
    verified: "2026-09-04",
  },
  "yangaroo-pricing": {
    title: "Yangaroo Music — self-serve pricing",
    url: "https://yangaroomusic.com/pricing/",
    verified: "2026-09-04",
  },
  "submithub-pricing": {
    title: "SubmitHub — how much do credits cost",
    url: "https://www.submithub.com/help/QPHgFWDSCm82W7vLJ",
    verified: "2026-09-04",
  },
  "playlistpush-pricing": {
    title: "PlaylistPush — pricing",
    url: "https://www.playlistpush.com/pricing",
    verified: "2026-09-04",
  },
  "spotify-ads-ca": {
    title: "Spotify Ads Manager — Canadian help centre (minimum budget)",
    url: "https://ads.spotify.com/en-CA/help-center/ad-studio-overview",
    verified: "2026-08-14",
  },
  "meta-ads-minimum": {
    title: "Meta Business Help — minimum budgets",
    url: "https://www.facebook.com/business/help/203183363050448",
    verified: "2026-08-14",
  },
  "distrokid-pricing": {
    title: "DistroKid — pricing",
    url: "https://distrokid.com/pricing/",
    verified: "2026-09-04",
  },
  "marketing-paid": {
    title: "Our marketing strategist on paid promotion",
    where: "agents/digital-marketing/knowledge/paid-promotion.md",
    verified: "2026-08-14",
  },
  "marketing-playbook": {
    title: "Our marketing strategist on the campaign arc (floors and tiers)",
    where: "agents/digital-marketing/knowledge/marketing-fundamentals.md",
    verified: "2026-08-14",
  },
  "distribution-how": {
    title: "Our distribution desk on fee models",
    where: "agents/distribution/knowledge/distribution-fundamentals.md",
    verified: "2026-08-23",
  },
};

export interface Price {
  vendor: string;
  amount: number;
  currency: Currency;
  /** The vendor's own unit, verbatim enough to check. */
  unit: string;
  source: keyof typeof COST_SOURCES;
}

/**
 * The vendor's number, the vendor's unit, the page it is on. Nothing here is
 * a quantity we chose — those live in the cost functions below, and say so.
 */
export const PRICES = {
  earshot_song: { vendor: "!earshot Distro", amount: 7, currency: "CAD", unit: "per song, 1–7 songs, plus tax", source: "earshot-cost" },
  earshot_album: { vendor: "!earshot Distro", amount: 50, currency: "CAD", unit: "per album, 8–20 songs, plus tax", source: "earshot-cost" },
  tours45_title: { vendor: "45tours.ca", amount: 200, currency: "CAD", unit: "per title, 2026 rate", source: "45tours" },
  tours45_ep: { vendor: "45tours.ca", amount: 300, currency: "CAD", unit: "EP of up to 5 titles notified the same day", source: "45tours" },
  tours45_album: { vendor: "45tours.ca", amount: 500, currency: "CAD", unit: "album notified the same day", source: "45tours" },
  yangaroo_format: { vendor: "Yangaroo Music (BASIC)", amount: 295, currency: "USD", unit: "one format package — the page's example is a US AC single to 100 stations", source: "yangaroo-pricing" },
  submithub_credit: { vendor: "SubmitHub", amount: 1, currency: "USD", unit: "per credit, down to $0.78 in volume; 1–4 credits per submission", source: "submithub-pricing" },
  playlistpush_floor: { vendor: "PlaylistPush", amount: 280, currency: "USD", unit: "campaign minimum; $630 reaches 79 playlists", source: "playlistpush-pricing" },
  spotify_ads_floor: { vendor: "Spotify Ads Manager", amount: 250, currency: "local", unit: "campaign minimum, in local currency (Canadian help centre)", source: "spotify-ads-ca" },
  meta_day_low: { vendor: "Meta (Instagram/Facebook)", amount: 5, currency: "local", unit: "per day — Meta publishes no floor; $5–10/day is the working budget our strategist cites", source: "marketing-paid" },
  meta_day_high: { vendor: "Meta (Instagram/Facebook)", amount: 10, currency: "local", unit: "per day — the top of the same working range", source: "marketing-paid" },
  distrokid_musician: { vendor: "DistroKid Musician", amount: 24.99, currency: "USD", unit: "per year, unlimited uploads, 0% cut", source: "distrokid-pricing" },
  ditto_year: { vendor: "Ditto", amount: 19, currency: "USD", unit: "per year, 0% cut — as recorded by our distribution desk", source: "distribution-how" },
} as const satisfies Record<string, Price>;

export type PriceKey = keyof typeof PRICES;

/**
 * One priced step at three ends. An end is a list because one step can bill
 * in two currencies, which are never added. An empty list means no honest number.
 */
export interface CostLine {
  floor: Money[];
  aim: Money[];
  full: Money[];
  /** Why these numbers — vendor unit and, when a quantity is ours, that it is. */
  basis: Text;
  /** true when every figure is a vendor's published number applied to a published unit. */
  sourced: boolean;
  sources: string[];
  /** Printed when there is no honest number at all. */
  noPriceReason?: Text;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const m = (amount: number, currency: Currency): Money => ({ amount: round2(amount), currency });
const of = (k: PriceKey, qty = 1): Money => m(PRICES[k].amount * qty, PRICES[k].currency);
const free: Money[] = [m(0, "local")];

/**
 * Song count for per-song prices: from `artist.songs`, else 45tours's EP
 * definition (up to 5) or 1 for a single, and the line prints ≈.
 */
export function trackCountFor(s: Scope): { n: number; known: boolean } {
  if (s.trackCount != null && s.trackCount > 0) return { n: s.trackCount, known: true };
  if (s.projectType === "single") return { n: 1, known: true };
  if (s.projectType === "ep") return { n: 5, known: false };
  return { n: 10, known: false };
}

const inCanada = (s: Scope) => s.markets.includes("quebec") || s.markets.includes("canada");
const inQuebec = (s: Scope) => s.markets.includes("quebec");

/** !earshot: per song up to 7, flat per album from 8. The vendor's own split. */
function earshot(n: number): Money {
  return n <= 7 ? of("earshot_song", n) : of("earshot_album");
}

/** 45tours: single, EP of up to 5, album — the vendor's own three prices. */
function tours45(s: Scope, n: number): Money {
  if (s.projectType === "single" || n === 1) return of("tours45_title");
  if (s.projectType === "ep" && n <= 5) return of("tours45_ep");
  if (s.projectType === "ep") return of("tours45_title", n);
  return of("tours45_album");
}

/**
 * The cost of each step, keyed by milestone. An absent key has no line. A
 * present key with every end null costs money but has no published price,
 * and prints its reason instead.
 */
export const COSTS: Record<string, (s: Scope, a: Anchors) => CostLine> = {
  radio_serviced: (s) => {
    const { n, known } = trackCountFor(s);
    const approx = known ? "" : " (≈ song count not in the catalog yet)";
    if (!inCanada(s)) {
      // No cheaper US delivery route is published in our knowledge; do not invent one.
      const y = [of("yangaroo_format")];
      return {
        floor: y, aim: y, full: y,
        basis: {
          en: "one Yangaroo format package at the vendor's published example price — the only US radio delivery price our promotion desk could verify; a US campus route is unpriced",
          fr: "un forfait de format Yangaroo au prix d'exemple publié — le seul prix de livraison radio américain que notre promotion a pu vérifier ; la voie campus américaine n'a pas de prix",
        },
        sourced: true,
        sources: ["yangaroo-pricing"],
      };
    }
    // Quebec: 45tours is the francophone route, and !earshot comes back in
    // when English Canada is also a market. Elsewhere in Canada the decent
    // run is !earshot plus one commercial format. Yangaroo bills in USD and
    // is listed beside the CAD lines, never added to them.
    const floor = [earshot(n)];
    const aim = inQuebec(s)
      ? [tours45(s, n), ...(s.markets.includes("canada") ? [earshot(n)] : [])]
      : [earshot(n), of("yangaroo_format")];
    const full = inQuebec(s) ? [...aim, of("yangaroo_format")] : aim;
    return {
      floor,
      aim,
      full,
      basis: {
        en: `${n} song${n === 1 ? "" : "s"}${approx}: !earshot at $7 a song to campus and community radio is the floor; ${inQuebec(s) ? "45tours.ca is how francophone radio receives a release and is the decent run" : "a decent run adds one commercial format through Yangaroo"}; a commercial format through Yangaroo ($295 USD, reported apart) is the full one. Delivery buys no airplay`,
        fr: `${n} chanson${n === 1 ? "" : "s"}${approx} : !earshot à 7 $ la chanson vers les radios campus et communautaires est le plancher ; ${inQuebec(s) ? "45tours.ca est la voie des radios francophones et fait le run correct" : "un run correct ajoute un format commercial via Yangaroo"} ; un format commercial via Yangaroo (295 $ US, compté à part) fait le complet. Livrer n'achète aucune diffusion`,
      },
      sourced: known,
      sources: inQuebec(s) ? ["earshot-cost", "45tours", "yangaroo-pricing"] : ["earshot-cost", "yangaroo-pricing"],
    };
  },

  curators_pitched: () => ({
    floor: [of("submithub_credit", 35)],
    aim: [of("submithub_credit", 150)],
    full: [of("playlistpush_floor")],
    basis: {
      en: "SubmitHub credits at the vendor's $1 each, 1–4 credits a submission: 35 credits is our floor (about 10–35 pitches), 150 our decent run — the quantities are our defaults, the price is theirs. The full run is PlaylistPush's published campaign minimum. A paid submission buys a listen, never a placement",
      fr: "Crédits SubmitHub à 1 $ US chacun, 1 à 4 crédits par soumission : 35 crédits est notre plancher (environ 10 à 35 pitchs), 150 notre run correct — les quantités sont nos défauts, le prix est le leur. Le complet est le minimum de campagne publié par PlaylistPush. Une soumission payée achète une écoute, jamais un placement",
    },
    sourced: true,
    sources: ["submithub-pricing", "playlistpush-pricing"],
  }),

  editorial_pitched: () => ({
    floor: free, aim: free, full: free,
    basis: {
      en: "the editorial pitch is filed from Spotify for Artists at no charge; nothing sold anywhere replaces it",
      fr: "le pitch éditorial se fait depuis Spotify for Artists sans frais ; rien de ce qui se vend ne le remplace",
    },
    sourced: true,
    sources: ["spotify-pitch"],
  }),

  campaign_live: (_s, a) => {
    // The marketing window: campaign start to two weeks after release, the
    // strategist's own horizon. Meta has no published floor, so organic is a
    // real $0; the decent run is the low end of the working daily budget
    // across that window, the full one the high end plus Spotify's minimum.
    const days = 14 - a.campaign;
    return {
      floor: free,
      aim: [of("meta_day_low", days)],
      full: [of("meta_day_high", days), of("spotify_ads_floor")],
      basis: {
        en: `${days} days from campaign start to two weeks after release: organic only is the floor (Meta publishes no minimum); Meta at $5 a day across the window is the decent run; $10 a day plus Spotify Ads Manager's $250 minimum is the full one. Marketing sizes the real split`,
        fr: `${days} jours du début de campagne à deux semaines après la sortie : l'organique seul est le plancher (Meta ne publie aucun minimum) ; Meta à 5 $ par jour sur la fenêtre est le run correct ; 10 $ par jour plus le minimum de 250 $ de Spotify Ads Manager est le complet. Le marketing fait la vraie répartition`,
      },
      sourced: true,
      sources: ["meta-ads-minimum", "marketing-paid", "spotify-ads-ca", "marketing-playbook"],
    };
  },

  presskit_ready: () => ({
    floor: free, aim: free, full: free,
    basis: {
      en: "the label's own presskit desk builds it — Google Slides and a PDF, no vendor",
      fr: "le desk presskit du label le fabrique — Google Slides et un PDF, aucun fournisseur",
    },
    sourced: true,
    sources: ["release-path"],
  }),

  press_pitched: () => ({
    floor: free, aim: free, full: free,
    basis: {
      en: "drafted and tracked by the label's publicist desk; an outside publicist is four figures and no independent benchmark exists, so no number is printed for one",
      fr: "rédigé et suivi par le desk de relations de presse du label ; un relationniste externe coûte quatre chiffres et aucun repère indépendant n'existe, donc aucun montant n'est imprimé",
    },
    sourced: true,
    sources: ["marketing-playbook", "release-path"],
  }),

  distributor_chosen: () => ({
    floor: [of("ditto_year")],
    aim: [of("distrokid_musician")],
    full: [of("distrokid_musician")],
    basis: {
      en: "the two cheapest flat subscriptions our distribution desk holds, per year, 0% cut. Per-release and percentage models cost differently over your own revenue — Distribution ranks them; this is only the range",
      fr: "les deux abonnements fixes les moins chers que notre desk distribution connaît, par année, 0 % de commission. Les modèles par sortie et par pourcentage coûtent autrement selon tes revenus — Distribution les classe ; ceci n'est que la fourchette",
    },
    sourced: true,
    sources: ["distribution-how", "distrokid-pricing"],
  }),

  mechanical_licence: () => ({
    floor: [], aim: [], full: [],
    basis: {
      en: "CMRRA sets the rate per unit pressed on the pay-as-you-press application, which requires the press invoice",
      fr: "La CMRRA fixe le tarif par unité pressée sur la demande pay-as-you-press, qui exige la facture de l'usine",
    },
    sourced: false,
    sources: ["cmrra-payp"],
    noPriceReason: {
      en: "per unit, set by CMRRA once the run size is known — Rights files it with the press invoice",
      fr: "par unité, fixé par la CMRRA une fois le tirage connu — Droits la dépose avec la facture de l'usine",
    },
  }),

  plant_booked: () => ({
    floor: [], aim: [], full: [],
    basis: {
      en: "no plant publishes a list price; the run is quoted",
      fr: "aucune usine ne publie de prix de liste ; le tirage est chiffré sur demande",
    },
    sourced: false,
    sources: ["microforum"],
    noPriceReason: {
      en: "quoted by the plant for your run size — nobody on staff owns manufacturing",
      fr: "chiffré par l'usine selon ton tirage — personne dans l'équipe ne s'occupe de la fabrication",
    },
  }),

  merch_ordered: () => ({
    floor: [], aim: [], full: [],
    basis: {
      en: "no department owns merch and no supplier is in the catalog",
      fr: "aucun département ne s'occupe du merch et aucun fournisseur n'est au catalogue",
    },
    sourced: false,
    sources: ["release-fundamentals"],
    noPriceReason: {
      en: "supplier quote — nobody on staff owns merch",
      fr: "devis du fournisseur — personne dans l'équipe ne s'occupe du merch",
    },
  }),


};

// ── the budget view ─────────────────────────────────────────────────────────

export type Totals = Partial<Record<BudgetCurrency, number>>;
export interface OwnerTotals { owner: Owner; floor: Totals; aim: Totals; full: Totals }

export interface ResolvedCost extends CostLine {
  key: string;
  owner: Owner;
  title: Text;
}

export type Verdict = "no_budget" | "under_floor" | "between" | "covered";

export interface BudgetView {
  /** The currency every `local` line and every total is read in. */
  currency: BudgetCurrency;
  budget: { amount: number; currency: BudgetCurrency } | null;
  lines: ResolvedCost[];
  byOwner: OwnerTotals[];
  tiers: { floor: Totals; aim: Totals; full: Totals };
  /**
   * What each department gets to work with, in the budget's currency: the
   * floor of its lines plus its share of what the budget adds above the plan's
   * floor, pro rata to what a decent run of that department costs on top of
   * its floor — capped at the decent run. Empty when there is no budget.
   */
  envelopes: { owner: Owner; amount: number; floor: number; aim: number }[];
  verdict: Verdict;
}

/** `local` reads as the budget's currency; everything else stays what it is. */
export function settle(xs: Money[], currency: BudgetCurrency): Totals {
  const t: Totals = {};
  for (const x of xs) {
    const c: BudgetCurrency = x.currency === "local" ? currency : x.currency;
    t[c] = round2((t[c] ?? 0) + x.amount);
  }
  return t;
}

const addTotals = (t: Totals, xs: Money[], currency: BudgetCurrency): Totals => {
  const out = { ...t };
  for (const [c, amount] of Object.entries(settle(xs, currency)) as [BudgetCurrency, number][]) {
    out[c] = round2((out[c] ?? 0) + amount);
  }
  return out;
};

export function budgetCurrencyFor(s: Scope): BudgetCurrency {
  return s.budget?.currency ?? (inCanada(s) ? "CAD" : "USD");
}

/**
 * Prices the plan. `milestones` is the resolved list (so a step the scope
 * dropped is never priced), `anchors` gives the campaign window.
 */
export function budgetFor(
  s: Scope,
  a: Anchors,
  milestones: { key: string; owner: Owner; title: Text }[],
): BudgetView {
  const currency = budgetCurrencyFor(s);
  const lines: ResolvedCost[] = milestones
    .filter((ms) => COSTS[ms.key])
    .map((ms) => ({ key: ms.key, owner: ms.owner, title: ms.title, ...COSTS[ms.key](s, a) }));

  const owners = [...new Set(lines.map((l) => l.owner))];
  const byOwner: OwnerTotals[] = owners.map((owner) => {
    const mine = lines.filter((l) => l.owner === owner);
    return {
      owner,
      floor: mine.reduce((t, l) => addTotals(t, l.floor, currency), {} as Totals),
      aim: mine.reduce((t, l) => addTotals(t, l.aim, currency), {} as Totals),
      full: mine.reduce((t, l) => addTotals(t, l.full, currency), {} as Totals),
    };
  });
  const tiers = {
    floor: lines.reduce((t, l) => addTotals(t, l.floor, currency), {} as Totals),
    aim: lines.reduce((t, l) => addTotals(t, l.aim, currency), {} as Totals),
    full: lines.reduce((t, l) => addTotals(t, l.full, currency), {} as Totals),
  };

  const budget = s.budget ?? null;
  const floorTotal = tiers.floor[currency] ?? 0;
  const aimTotal = tiers.aim[currency] ?? 0;

  let verdict: Verdict = "no_budget";
  if (budget) verdict = budget.amount < floorTotal ? "under_floor" : budget.amount < aimTotal ? "between" : "covered";

  const envelopes: BudgetView["envelopes"] = [];
  if (budget) {
    const above = Math.max(0, budget.amount - floorTotal);
    const room = Math.max(0, aimTotal - floorTotal);
    for (const o of byOwner) {
      const floor = o.floor[currency] ?? 0;
      const aim = o.aim[currency] ?? 0;
      const share = room > 0 ? (aim - floor) / room : 0;
      // Whole dollars, so an envelope reads as a number, not a calculation.
      const amount = Math.round(Math.min(aim, floor + above * share));
      if (aim > 0 || floor > 0) envelopes.push({ owner: o.owner, amount, floor, aim });
    }
    // Rounding can leave the envelopes a dollar short of the budget when the
    // budget sits between floor and aim; the largest one absorbs it.
    const target = Math.round(Math.min(budget.amount, aimTotal));
    const sum = envelopes.reduce((s, e) => s + e.amount, 0);
    const biggest = [...envelopes].sort((x, y) => y.amount - x.amount)[0];
    if (biggest && sum !== target && Math.abs(sum - target) <= envelopes.length) biggest.amount += target - sum;
  }

  return { currency, budget, lines, byOwner, tiers, envelopes, verdict };
}

/**
 * One department's envelope, from saved rows rather than a resolved plan —
 * what the brief prints. Same arithmetic as `budgetFor`, on the cost columns
 * `plan.ts --save` wrote, so the brief and the page never disagree.
 */
export function envelopeFor(
  rows: { owner: Owner; floor: Money[]; aim: Money[] }[],
  budget: { amount: number; currency: BudgetCurrency } | null,
  currency: BudgetCurrency,
  dept: string,
): { owner: Owner; amount: number | null; floor: number; aim: number; budget: typeof budget } | null {
  const owner = dept as Owner;
  const mine = rows.filter((r) => r.owner === owner);
  const floor = round2(mine.reduce((s, r) => s + (settle(r.floor, currency)[currency] ?? 0), 0));
  const aim = round2(mine.reduce((s, r) => s + (settle(r.aim, currency)[currency] ?? 0), 0));
  if (floor === 0 && aim === 0) return null;
  if (!budget) return { owner, amount: null, floor, aim, budget };
  const floorTotal = rows.reduce((s, r) => s + (settle(r.floor, currency)[currency] ?? 0), 0);
  const aimTotal = rows.reduce((s, r) => s + (settle(r.aim, currency)[currency] ?? 0), 0);
  const above = Math.max(0, budget.amount - floorTotal);
  const room = Math.max(0, aimTotal - floorTotal);
  const share = room > 0 ? (aim - floor) / room : 0;
  return { owner, amount: Math.round(Math.min(aim, floor + above * share)), floor, aim, budget };
}

/** `Your share of the budget: $135 of $500 CAD (bare $35 · decent $335).` */
export function envelopeLine(e: NonNullable<ReturnType<typeof envelopeFor>>, lang: Lang): string {
  const c = e.budget?.currency ?? "CAD";
  if (e.amount == null || !e.budget) {
    return lang === "fr"
      ? `Budget non fixé — cette partie coûte ${money(e.floor, c, "fr")} au minimum, ${money(e.aim, c, "fr")} pour un run correct.`
      : `No budget set — this part costs ${money(e.floor, c, "en")} bare, ${money(e.aim, c, "en")} for a decent run.`;
  }
  return lang === "fr"
    ? `Ta part du budget : ${money(e.amount, c, "fr")} sur ${money(e.budget.amount, c, "fr")} (minimum ${money(e.floor, c, "fr")} · correct ${money(e.aim, c, "fr")}).`
    : `Your share of the budget: ${money(e.amount, c, "en")} of ${money(e.budget.amount, c, "en")} (bare ${money(e.floor, c, "en")} · decent ${money(e.aim, c, "en")}).`;
}

// ── words ───────────────────────────────────────────────────────────────────

export type Lang = "en" | "fr";

export const TIER_LABEL: Record<"floor" | "aim" | "full", Text> = {
  floor: { en: "Bare", fr: "Minimum" },
  aim: { en: "Decent", fr: "Correct" },
  full: { en: "Full", fr: "Complet" },
};

/** `$1,005 CAD` / `1 005 $ CAD`. Cents only when there are any. */
export function money(amount: number, currency: string, lang: Lang): string {
  const n = amount.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  });
  return lang === "fr" ? `${n} $ ${currency}`.trimEnd() : `$${n} ${currency}`.trimEnd();
}

/** `$720 CAD + $295 USD` — every currency a total holds, never converted. */
export function totals(t: Totals, lang: Lang): string {
  const parts = (Object.keys(t) as BudgetCurrency[]).sort().map((c) => money(t[c]!, c, lang));
  return parts.length ? parts.join(" + ") : money(0, "", lang);
}

/**
 * Warnings the budget adds to the plan's: one sentence each, with the tier
 * numbers in the sentence.
 */
export function budgetWarnings(v: BudgetView, ownerLabel: (o: Owner, lang: Lang) => string): Warning[] {
  const c = v.currency;
  const floor = v.tiers.floor[c] ?? 0;
  const aim = v.tiers.aim[c] ?? 0;
  const full = v.tiers.full[c] ?? 0;
  const out: Warning[] = [];

  const foreign = (Object.keys(v.tiers.full) as BudgetCurrency[]).filter((k) => k !== c);
  const foreignNote = (lang: Lang) =>
    foreign.length
      ? lang === "fr"
        ? ` (plus ${foreign.map((k) => money(v.tiers.full[k]!, k, "fr")).join(" + ")} de lignes en devise étrangère, comptées à part)`
        : ` (plus ${foreign.map((k) => money(v.tiers.full[k]!, k, "en")).join(" + ")} of lines in another currency, counted apart)`
      : "";

  if (v.verdict === "no_budget") {
    out.push({
      kind: "no_budget",
      text: {
        en: `No budget given. Bare is ${money(floor, c, "en")}, decent ${money(aim, c, "en")}, full ${money(full, c, "en")}${foreignNote("en")} — give a number or pick a tier and the plan is priced against it.`,
        fr: `Aucun budget donné. Le minimum est ${money(floor, c, "fr")}, le correct ${money(aim, c, "fr")}, le complet ${money(full, c, "fr")}${foreignNote("fr")} — donne un chiffre ou choisis un palier et le plan sera chiffré dessus.`,
      },
    });
    return out;
  }

  const b = v.budget!;
  const biggest = [...v.byOwner]
    .map((o) => ({ owner: o.owner, gap: (o.aim[c] ?? 0) - (o.floor[c] ?? 0) }))
    .sort((x, y) => y.gap - x.gap)[0];

  if (v.verdict === "under_floor") {
    const top = [...v.byOwner].sort((x, y) => (y.floor[c] ?? 0) - (x.floor[c] ?? 0))[0];
    out.push({
      kind: "under_floor",
      text: {
        en: `Even the bare run is ${money(floor, c, "en")}, ${money(round2(floor - b.amount), c, "en")} over your ${money(b.amount, c, "en")} — the largest line is ${ownerLabel(top.owner, "en")} at ${money(top.floor[c] ?? 0, c, "en")}; drop it, or raise the budget before the date is fixed.`,
        fr: `Même le minimum coûte ${money(floor, c, "fr")}, soit ${money(round2(floor - b.amount), c, "fr")} de plus que tes ${money(b.amount, c, "fr")} — la plus grosse ligne est ${ownerLabel(top.owner, "fr")} à ${money(top.floor[c] ?? 0, c, "fr")} ; coupe-la, ou augmente le budget avant de fixer la date.`,
      },
    });
  } else if (v.verdict === "between") {
    out.push({
      kind: "under_aim",
      text: {
        en: `${money(b.amount, c, "en")} covers the bare run (${money(floor, c, "en")}) but not a decent one (${money(aim, c, "en")}); the ${money(round2(aim - b.amount), c, "en")} gap sits mostly in ${ownerLabel(biggest.owner, "en")}, and a grant would close it.`,
        fr: `${money(b.amount, c, "fr")} couvre le minimum (${money(floor, c, "fr")}) mais pas un run correct (${money(aim, c, "fr")}) ; l'écart de ${money(round2(aim - b.amount), c, "fr")} est surtout chez ${ownerLabel(biggest.owner, "fr")}, et une subvention le fermerait.`,
      },
    });
  } else if (full > aim) {
    const extras = v.byOwner.filter((o) => (o.full[c] ?? 0) > (o.aim[c] ?? 0));
    out.push({
      kind: "budget_room",
      text: {
        en: `${money(b.amount, c, "en")} covers a decent run (${money(aim, c, "en")}); the full one is ${money(full, c, "en")}, and the difference goes to ${extras.map((o) => ownerLabel(o.owner, "en")).join(" and ")}.`,
        fr: `${money(b.amount, c, "fr")} couvre un run correct (${money(aim, c, "fr")}) ; le complet est ${money(full, c, "fr")}, et la différence va à ${extras.map((o) => ownerLabel(o.owner, "fr")).join(" et ")}.`,
      },
    });
  }

  if (foreign.length) {
    out.push({
      kind: "foreign_currency",
      text: {
        en: `${foreign.map((k) => money(v.tiers.full[k]!, k, "en")).join(" + ")} of the full run is priced in another currency and is not counted against your ${c} budget.`,
        fr: `${foreign.map((k) => money(v.tiers.full[k]!, k, "fr")).join(" + ")} du run complet est en devise étrangère et n'est pas compté contre ton budget en ${c}.`,
      },
    });
  }
  return out;
}
