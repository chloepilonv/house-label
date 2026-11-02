/**
 * Every dated step a release contains, and where each date comes from.
 *
 * Each step carries `when` (signed day offset from the street date; days, not
 * weeks, because sources such as Spotify's 7-day floor are in days), `basis`
 * (where that day came from) and `sourced` (false when the day is arithmetic
 * off a cited one; it prints with ≈).
 *
 * "Never invent a lead time" means the step ships with a cited or derived date,
 * not that it is left out. A step with no honest date keeps `when: null` and
 * says why. A milestone is a deliverable with a day and an owner, not a task.
 * Pure: same scope in, same plan out.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Branch } from "../../manager-scope-project/scripts/questions";
import { COST_SOURCES, budgetFor, budgetWarnings, type BudgetCurrency, type BudgetView, type ResolvedCost } from "./costs";

export type Dept =
  | "press" | "presskit" | "rights"
  | "distribution" | "digital-marketing" | "platforms" | "promotion";

/** null owner is a real state: nobody on staff owns it. Never reassigned. */
export type Owner = Dept | null;

export type Lang = "en" | "fr";
export type Text = Record<Lang, string>;

/**
 * How a department is named to the artist. French avoids gendered role nouns.
 */
export const OWNER_LABEL: Record<string, Text> = {
  press: { en: "Press Agent", fr: "Relations de presse" },
  promotion: { en: "Promotion", fr: "Promotion" },
  presskit: { en: "Presskit", fr: "Presskit" },
  rights: { en: "Rights", fr: "Droits" },
  distribution: { en: "Distribution", fr: "Distribution" },
  "digital-marketing": { en: "Marketing", fr: "Marketing" },
  platforms: { en: "Numbers", fr: "Données" },
  you: { en: "You", fr: "Toi" },
};


/**
 * Where every date came from, as data. The page renders these as links, and
 * milestones.test.ts fails on an unknown source or a missing URL. `where` is a
 * repo path for our own knowledge, cited by file so it goes stale visibly.
 */
export interface Source {
  title: string;
  url?: string;
  where?: string;
  verified: string;
}

export const SOURCES: Record<string, Source> = {
  // Prices cite their own pages, kept in costs.ts beside the numbers; merged
  // here so one registry backs the page and one test checks it.
  ...COST_SOURCES,
  microforum: {
    title: "Microforum — how to get an album pressed on vinyl",
    url: "https://www.microforum.ca/blog/how-to-get-an-album-pressed-on-vinyl",
    verified: "2026-08-23",
  },
  "spotify-pitch": {
    title: "Spotify — pitching music to playlist editors",
    url: "https://support.spotify.com/us/artists/article/pitching-music-and-videos-to-playlist-editors/",
    verified: "2026-08-23",
  },
  "spotify-release-guide": {
    title: "Spotify for Artists — preparing for release day and beyond",
    url: "https://artists.spotify.com/en/blog/release-guide-preparing-for-release-day",
    verified: "2026-08-27",
  },
  "spotify-countdown": {
    title: "Spotify — getting started with Countdown Pages",
    url: "https://support.spotify.com/us/artists/article/getting-started-with-countdown-pages-on-spotify/",
    verified: "2026-08-27",
  },
  "spotify-lyrics": {
    title: "Spotify — managing your lyrics",
    url: "https://support.spotify.com/us/artists/article/managing-your-lyrics-on-spotify/",
    verified: "2026-08-27",
  },
  "spotify-access": {
    title: "Spotify — getting access to Spotify for Artists",
    url: "https://support.spotify.com/us/artists/article/getting-access-to-spotify-for-artists/",
    verified: "2026-09-04",
  },
  resound: {
    title: "Re:Sound — FAQ: how performers and makers register",
    url: "https://www.resound.ca/faq/",
    verified: "2026-09-04",
  },
  metamusique: {
    title: "MétaMusique — Quebec's music metadata registry",
    url: "https://metamusique.ca/",
    verified: "2026-09-04",
  },
  "cmrra-payp": {
    title: "CMRRA — Pay-As-You-Press licence",
    url: "https://www.cmrra.ca/pay-as-you-press/",
    verified: "2026-08-27",
  },
  "cmrra-covers": {
    title: "CMRRA via MusicOntario — obtaining a mechanical licence for a cover",
    url: "https://music-ontario.ca/news/recent-news/read,758/3512/under-the-covers-obtaining-a-mechanical-license-for-a-song-you-didn-t-write-an-industry-insider-blog-by-the-cmrra",
    verified: "2026-08-27",
  },
  cipo: {
    title: "CIPO — what you should know about copyright",
    url: "https://ised-isde.canada.ca/site/canadian-intellectual-property-office/en/what-you-should-know-about-copyright",
    verified: "2026-08-27",
  },
  soundexchange: {
    title: "SoundExchange — register as a creator or copyright holder",
    url: "https://www.soundexchange.com/artist-copyright-owner/register/",
    verified: "2026-08-27",
  },
  "cdbaby-distribution": {
    title: "CD Baby — music distribution guide (what the distributor asks for)",
    url: "https://diymusician.cdbaby.com/releasing-music/music-distribution-guide/",
    verified: "2026-08-27",
  },
  "cdbaby-checklist": {
    title: "CD Baby — the most boring (and important) album-release checklist",
    url: "https://diymusician.cdbaby.com/releasing-music/boring-important-album-release-checklist-ever/",
    verified: "2026-08-27",
  },
  exclaim: {
    title: "Exclaim! — get coverage (advance window and link requirements)",
    url: "https://exclaim.ca/contact/getcoverage",
    verified: "2026-08-14",
  },
  ckrl: {
    title: "CKRL — contact (bans expiring links by name)",
    url: "https://ckrl.qc.ca/contactez-nous",
    verified: "2026-08-14",
  },
  crtc: {
    title: "CRTC — Canadian content requirements",
    url: "https://crtc.gc.ca/eng/cancon/r_cdn.htm",
    verified: "2026-08-14",
  },
  earshot: {
    title: "!earshot — weekly charts",
    url: "https://www.earshot-online.com/charts.cfm",
    verified: "2026-08-14",
  },
  "press-timeline": {
    title: "Our publicist on the release window",
    where: "agents/press/knowledge/press-fundamentals.md",
    verified: "2026-08-14",
  },
  "promotion-radio": {
    title: "Our promotion manager on radio",
    where: "agents/promotion/knowledge/radio-pitch.md",
    verified: "2026-09-04",
  },
  "promotion-playlist": {
    title: "Our promotion manager on playlists",
    where: "agents/promotion/knowledge/playlist-pitch.md",
    verified: "2026-09-04",
  },
  "digital-marketing-plan": {
    title: "Our marketing horizon",
    where: "agents/digital-marketing/skills/digital-marketing-plan/SKILL.md",
    verified: "2026-08-23",
  },
  "release-path": {
    title: "The release path — every step and who owns it",
    where: "agents/label-manager/knowledge/release-path.md",
    verified: "2026-09-08",
  },
  "release-fundamentals": {
    title: "Release fundamentals — the dates a release imposes, and its gates",
    where: "agents/label-manager/knowledge/release-fundamentals.md",
    verified: "2026-09-09",
  },
  "rights-fundamentals": {
    title: "Our rights manager on identifiers and the two sides",
    where: "agents/rights/knowledge/rights-fundamentals.md",
    verified: "2026-09-08",
  },
};

/**
 * Departments the label is missing, named by the steps with no owner, and
 * routed to `/recruit-agent`. When one is hired, delete its row here and set
 * the milestone's `owner` instead.
 */
export const PROPOSED: Record<string, Text> = {
  merch: {
    en: "Merch and direct-to-fan — production, fulfilment, the store",
    fr: "Merch et vente directe — production, expédition, la boutique",
  },
  manufacturing: {
    en: "Manufacturing — sourcing the plant, quoting runs, approving test pressings",
    fr: "Fabrication — trouver l'usine, chiffrer les tirages, approuver les tests",
  },
  artwork: {
    en: "Visual identity — cover art, layout, the assets everything else reuses",
    fr: "Identité visuelle — pochette, mise en page, les visuels que tout le reste réutilise",
  },
};

export type PhaseKey = "record" | "rights" | "product" | "story" | "release";

/** The order a release is made in. Numbering follows this, never the calendar. */
export const PHASE_ORDER: PhaseKey[] = ["record", "rights", "product", "story", "release"];

export const PHASES: Record<PhaseKey, Text> = {
  record: { en: "Finish the record", fr: "Finir le disque" },
  rights: { en: "Rights, codes and money", fr: "Droits, codes et argent" },
  product: { en: "Make the physical", fr: "Fabriquer le physique" },
  story: { en: "Build the story and pitch it", fr: "Bâtir l'histoire et la pitcher" },
  release: { en: "Deliver, release, read the numbers", fr: "Livrer, sortir, lire les chiffres" },
};

/** What the artist answered, reduced to what a date depends on. */
export interface Scope {
  projectType: "single" | "ep" | "album" | "tour";
  branches: Branch[];
  physical: "none" | "vinyl" | "cd" | "both";
  recordingStatus: "not_started" | "tracking" | "mixing" | "mastered" | "delivered";
  /** Days from the street date, negative, when the artist gave one. */
  mastersReadyOffset?: number | null;
  leadSingle?: string | null;
  /** Days from the release's street date; negative = the single lands first. */
  leadSingleOffset?: number | null;
  /** A cover on a PHYSICAL release needs a mechanical licence. Digital needs none. */
  covers?: boolean;
  markets: string[];
  /**
   * The artist's budget, when they gave a number. "Not much" is null: the plan
   * prices its three tiers and asks which one.
   */
  budget?: { amount: number; currency: BudgetCurrency } | null;
  /** Songs on the release, for per-song prices. Null until the catalog is in. */
  trackCount?: number | null;
}

/**
 * Every day in the plan hangs off one of these, so changing a lead time moves
 * every step that depends on it.
 */
export interface Anchors {
  /** Vinyl 8–12 wks, long end. Microforum. */
  plant: number;
  /** Masters must exist by the earliest thing that needs them. Derived. */
  mastersDue: number;
  whyMastersDue: Text;
  /** Press stage 1 — prepare assets, 8+ weeks out. */
  prepare: number;
  radio: number;
  pressPitch: number;
  playlists: number;
  campaign: number;
  /** Upload day. Spotify's floor is 7 days; the editorial pitch pulls it earlier. */
  delivery: number;
  whyDelivery: Text;
  followUp: number;
  premiere: number;
}

const DAY = 86400000;
const wk = (n: number) => n * 7;

export function anchorsFor(scope: Scope): Anchors {
  const has = (b: Branch) => scope.branches.includes(b);
  const physical = scope.physical !== "none";

  // The editorial pitch has to happen while the release is already delivered
  // and still unreleased. Press puts that at 3–4 weeks out; Spotify's own floor
  // is 7 days. Deliver at the earlier of the two that apply.
  const pitching = has("press") || has("campaign");
  const delivery = pitching ? -wk(4) : -7;
  const whyDelivery: Text = pitching
    ? {
        en: "the editorial pitch goes in four weeks out and needs the release already delivered — Spotify's own floor is only 7 days",
        fr: "le pitch éditorial part quatre semaines avant et exige une sortie déjà livrée — le plancher de Spotify n'est que de 7 jours",
      }
    : {
        en: "Spotify's floor: deliver at least 7 days before release. That is a floor, not a target — no distributor publishes its own turnaround",
        fr: "le plancher de Spotify : livrer au moins 7 jours avant la sortie. C'est un plancher, pas une cible — aucun distributeur ne publie son propre délai",
      };

  // The masters are due at the first thing that needs them; with vinyl, the plant.
  const gates: { at: number; why: Text }[] = [
    { at: delivery, why: { en: "the upload to your distributor", fr: "la livraison au distributeur" } },
  ];
  if (has("press") || has("presskit")) {
    // One week before the link, so a master that lands late does not delay it.
    gates.push({
      at: -wk(9),
      why: { en: "the advance link press and radio listen to, one week after the masters", fr: "le lien d'écoute que la presse et la radio reçoivent, une semaine après les masters" },
    });
  }
  if (physical) {
    gates.push({ at: -wk(12), why: { en: "the pressing plant", fr: "l'usine de pressage" } });
  }
  const first = gates.reduce((a, b) => (b.at < a.at ? b : a));

  return {
    plant: -wk(12),
    mastersDue: first.at,
    whyMastersDue: first.why,
    prepare: -wk(8),
    radio: -wk(7),
    pressPitch: -wk(5),
    playlists: -wk(4),
    campaign: -wk(4),
    delivery,
    whyDelivery,
    followUp: -wk(2),
    premiere: -2,
  };
}

export interface Milestone {
  key: string;
  phase: PhaseKey;
  title: Text;
  detail: Text;
  owner: Owner;
  /** Said out loud when `owner` is null, so the gap is the output. */
  gapReason?: Text;
  /**
   * A department the label does not have yet but plausibly should; the plan
   * routes it to the Recruiting Agent. `gapReason` alone may be permanent.
   */
  proposedOwner?: keyof typeof PROPOSED;
  /** The day to aim for. Signed days from the street date, or null. */
  when: (a: Anchors, s: Scope) => number | null;
  /**
   * The last honest day, when the source gives a range rather than a day.
   * Omitted when the step really is a single day.
   */
  latest?: (a: Anchors, s: Scope) => number | null;
  /** Printed when `when` returns null. */
  noDateReason?: Text;
  basis: Text;
  /** true = `basis` is a cited lead time. false = arithmetic off one. */
  sourced: boolean;
  /** Keys into SOURCES. At least one, always — the test enforces it. */
  sources: string[];
  needs: (s: Scope) => boolean;
}

const has = (s: Scope, b: Branch) => s.branches.includes(b);
const physical = (s: Scope) => s.physical !== "none";
const stillRecording = (s: Scope) =>
  ["not_started", "tracking", "mixing"].includes(s.recordingStatus);

/**
 * Array order is not plan order: `resolve()` sorts by date. Grouped by phase
 * here so the file reads like a release.
 */
export const MILESTONES: Milestone[] = [
  // ── Money ────────────────────────────────────────────────────────────────


  // ── Finish the record ────────────────────────────────────────────────────
  {
    key: "recording_done",
    phase: "record",
    title: { en: "Recording finished", fr: "Enregistrement terminé" },
    detail: {
      en: "Everything tracked. Nothing after this point in the plan works without it.",
      fr: "Tout est enregistré. Rien dans la suite du plan ne tient sans ça.",
    },
    owner: null,
    gapReason: { en: "no agent here makes music", fr: "aucun agent ici ne fait de musique" },
    when: (a, s) => Math.min(a.mastersDue, s.mastersReadyOffset ?? a.mastersDue) - wk(2),
    basis: {
      en: "derived — two weeks before the masters, because tracking and mastering on the same day is not a schedule. No studio publishes a mix or mastering turnaround (release-fundamentals.md); your engineer knows the real gap",
      fr: "dérivée — deux semaines avant les masters, parce qu'enregistrer et masteriser le même jour n'est pas un calendrier. Aucun studio ne publie de délai de mix ou de mastering (release-fundamentals.md) ; ton ingé connaît le vrai écart",
    },
    sourced: false,
    sources: ["release-fundamentals"],
    needs: (s) => has(s, "creation") && stillRecording(s),
  },
  {
    key: "masters_done",
    phase: "record",
    title: { en: "Mixed and mastered", fr: "Mixé et masterisé" },
    detail: {
      en: "Final files in your hands. This is the hard one: everything downstream is waiting on it.",
      fr: "Fichiers finaux en main. C'est la vraie contrainte : tout le reste attend après.",
    },
    owner: null,
    gapReason: { en: "no agent here makes music", fr: "aucun agent ici ne fait de musique" },
    when: (a, s) => (s.mastersReadyOffset != null ? Math.min(s.mastersReadyOffset, a.mastersDue) : a.mastersDue),
    basis: {
      en: "derived — the deadline is whatever needs the masters first; how long mixing takes is not sourced anywhere in this repo",
      fr: "dérivée — l'échéance est la première chose qui exige les masters ; la durée d'un mix n'est sourcée nulle part ici",
    },
    sourced: false,
    sources: ["release-fundamentals", "press-timeline"],
    needs: (s) => has(s, "creation"),
  },
  {
    key: "artwork_done",
    phase: "record",
    title: { en: "Cover art, credits and lyrics done", fr: "Pochette, crédits et paroles prêts" },
    detail: {
      en: "The distributor asks for artwork at upload, and a jacket cannot be printed without it.",
      fr: "Le distributeur demande la pochette au téléversement, et une jaquette ne s'imprime pas sans elle.",
    },
    owner: null,
    gapReason: {
      en: "no department here does visual art — the Presskit Agent uses the cover, it does not make it",
      fr: "aucun département ne fait d'art visuel — le Presskit utilise la pochette, il ne la crée pas",
    },
    proposedOwner: "artwork",
    when: (a, s) => (physical(s) ? a.plant : a.delivery),
    basis: {
      en: "derived from the upload date, or from the plant when there is a jacket to print",
      fr: "dérivée de la date de livraison, ou de l'usine quand il y a une jaquette à imprimer",
    },
    sourced: false,
    sources: ["cdbaby-distribution"],
    needs: (s) => s.projectType !== "tour",
  },

  // ── Rights, codes and money ──────────────────────────────────────────────
  {
    key: "splits_agreed",
    phase: "rights",
    title: { en: "Splits agreed in writing", fr: "Partages entendus par écrit" },
    detail: {
      en: "Who wrote what, who owns the master — in writing, before the mix exists. Once there is a finished record to argue over it is a negotiation, not a form.",
      fr: "Qui a écrit quoi, qui possède le master — par écrit, avant que le mix existe. Une fois le disque fini, c'est une négociation, plus un formulaire.",
    },
    owner: "rights",
    when: (a, s) => Math.min(physical(s) ? a.plant : a.delivery, a.mastersDue - wk(2)),
    basis: {
      en: "derived — two weeks before the masters are due, and never later than the codes: registration cannot be filed on splits nobody has agreed, and a jacket credits them",
      fr: "dérivée — deux semaines avant l'échéance des masters, et jamais après les codes : on n'inscrit pas une œuvre dont les partages ne sont pas entendus, et une jaquette les crédite",
    },
    sourced: false,
    sources: ["rights-fundamentals"],
    needs: (s) => has(s, "rights"),
  },
  {
    key: "mechanical_licence",
    phase: "rights",
    title: { en: "Mechanical licence for the covers", fr: "Licence mécanique pour les reprises" },
    detail: {
      en: "Physical only — streaming services pay CMRRA directly and need nothing from you. The application asks for your pressing invoice, so it goes in with the pressing order rather than after it.",
      fr: "Physique seulement — les plateformes paient la CMRRA directement et n'ont besoin de rien de toi. La demande exige ta facture de pressage, donc elle part avec la commande, pas après.",
    },
    owner: "rights",
    when: (a) => a.plant,
    basis: {
      en: "CMRRA Pay-As-You-Press — the application requires \"Confirmation of Units Pressed (pressing order, invoice, or letter from the presser)\", minimum 500 copies per contrivance",
      fr: "CMRRA Pay-As-You-Press — la demande exige une « Confirmation of Units Pressed (pressing order, invoice, or letter from the presser) », minimum 500 copies par support",
    },
    sourced: true,
    sources: ["cmrra-payp", "cmrra-covers"],
    needs: (s) => !!s.covers && physical(s),
  },
  {
    key: "copyright_registered",
    phase: "rights",
    title: { en: "Copyright registered", fr: "Droit d'auteur enregistré" },
    detail: {
      en: "Voluntary in Canada. You own the copyright the moment the work is fixed; the certificate is what you hold up if you ever have to prove it.",
      fr: "Volontaire au Canada. Tu détiens le droit d'auteur dès que l'œuvre est fixée ; le certificat, c'est ce que tu brandis s'il faut le prouver.",
    },
    owner: "rights",
    when: () => null,
    noDateReason: {
      en: "voluntary, and no deadline attaches to it — worth doing, never worth blocking a release on",
      fr: "volontaire, et aucune échéance ne s'y rattache — ça vaut la peine, jamais au point de bloquer une sortie",
    },
    basis: {
      en: "CIPO — a registration certificate \"can become valuable evidence to support that copyright exists and that the registrant is the owner of the work\"",
      fr: "OPIC — un certificat d'enregistrement « can become valuable evidence to support that copyright exists and that the registrant is the owner of the work »",
    },
    sourced: true,
    sources: ["cipo"],
    needs: (s) => has(s, "rights"),
  },
  {
    key: "identifiers_assigned",
    phase: "rights",
    title: { en: "ISRC and UPC codes assigned", fr: "Codes ISRC et UPC attribués" },
    detail: {
      en: "One ISRC per recording, one UPC per release. Most distributors issue both at upload; a barcode on a jacket has to exist earlier.",
      fr: "Un ISRC par enregistrement, un UPC par sortie. La plupart des distributeurs les émettent au téléversement ; un code-barres sur une jaquette doit exister avant.",
    },
    owner: "rights",
    when: (a, s) => (physical(s) ? a.plant : a.delivery),
    basis: {
      en: "rights/knowledge/rights-fundamentals.md — most distributors issue ISRCs and UPCs as part of a release",
      fr: "rights/knowledge/rights-fundamentals.md — la plupart des distributeurs émettent les ISRC et UPC avec la sortie",
    },
    sourced: true,
    sources: ["rights-fundamentals", "cdbaby-distribution"],
    needs: (s) => has(s, "rights"),
  },
  {
    key: "registrations_filed",
    phase: "rights",
    title: { en: "Songs registered with your societies", fr: "Œuvres inscrites à tes sociétés" },
    detail: {
      en: "Two sides, two registrations: the works with SOCAN (or ASCAP/BMI), and the recordings for neighbouring rights — in Canada through Re:Sound via Artisti (performer) and Panorama (maker), in the US with SoundExchange. File once the ISRCs exist so the first week's plays match to you.",
      fr: "Deux côtés, deux inscriptions : les œuvres à la SOCAN (ou ASCAP/BMI), et les enregistrements pour les droits voisins — au Canada via Ré:Sonne par Artisti (interprète) et Panorama (producteur), aux États-Unis à SoundExchange. Dès que les ISRC existent, pour que les écoutes de la première semaine se rattachent à toi.",
    },
    owner: "rights",
    when: (a) => a.delivery,
    latest: () => 0,
    basis: {
      en: "derived — filed with the codes, because a society matches plays on the ISRC; release day is the last honest deadline",
      fr: "dérivée — inscrites avec les codes, parce qu'une société rattache les écoutes à l'ISRC ; le jour de la sortie est la dernière échéance honnête",
    },
    sourced: false,
    sources: ["soundexchange", "resound", "cdbaby-checklist"],
    needs: (s) => has(s, "rights"),
  },
  {
    key: "metadata_declared",
    phase: "rights",
    title: { en: "Works declared to MétaMusique", fr: "Œuvres déclarées à MétaMusique" },
    detail: {
      en: "Quebec's metadata registry: titles, ISRC, ISWC, contributors and their identifiers, once, so every Quebec partner reads the same record.",
      fr: "Le registre de métadonnées du Québec : titres, ISRC, ISWC, contributeurs et leurs identifiants, une fois, pour que chaque partenaire lise la même fiche.",
    },
    owner: "rights",
    when: (a) => a.delivery,
    latest: () => -7,
    basis: {
      en: "derived — needs the codes, so it shares the delivery date; MétaMusique publishes no deadline of its own",
      fr: "dérivée — exige les codes, donc partage la date de livraison ; MétaMusique ne publie pas d'échéance",
    },
    sourced: false,
    sources: ["metamusique"],
    needs: (s) => has(s, "rights") && s.markets.includes("quebec"),
  },

  // ── Make the physical ────────────────────────────────────────────────────
  {
    key: "plant_booked",
    phase: "product",
    title: { en: "Plant booked, master sent", fr: "Usine réservée, master envoyé" },
    detail: {
      en: "8 to 12 weeks, longer around Record Store Day. This is where the whole plan starts.",
      fr: "8 à 12 semaines, plus long autour du Record Store Day. C'est ici que le plan commence.",
    },
    owner: null,
    gapReason: {
      en: "nobody here owns manufacturing — Distribution delivers to stores, it does not press records",
      fr: "personne ici ne gère la fabrication — Distribution livre aux plateformes, elle ne presse pas de disques",
    },
    proposedOwner: "manufacturing",
    when: (a) => a.plant,
    latest: (a) => a.plant + wk(4),
    basis: {
      en: "Microforum — 8–12 weeks, can stretch in peak season. The plan uses the 12-week end",
      fr: "Microforum — 8 à 12 semaines, peut s'étirer en haute saison. Le plan retient le bout de 12 semaines",
    },
    sourced: true,
    sources: ["microforum"],
    needs: physical,
  },
  {
    key: "test_pressing_ok",
    phase: "product",
    title: { en: "Test pressing approved", fr: "Test pressing approuvé" },
    detail: {
      en: "A few copies to check audio, sequencing and groove before the full run. Say no here and the run moves.",
      fr: "Quelques copies pour vérifier le son, l'ordre et les sillons avant le tirage complet. Un refus ici décale le tirage.",
    },
    owner: null,
    gapReason: { en: "the plant's schedule, not a department's", fr: "l'horaire de l'usine, pas celui d'un département" },
    proposedOwner: "manufacturing",
    when: () => null,
    noDateReason: {
      en: "inside the pressing window — the plant names the day, and it is the one date in this plan you do not control",
      fr: "dans la fenêtre de pressage — l'usine fixe la date, et c'est la seule du plan que tu ne contrôles pas",
    },
    basis: {
      en: "Microforum — the test pressing comes before the full run, inside the 8–12 weeks",
      fr: "Microforum — le test pressing précède le tirage, à l'intérieur des 8 à 12 semaines",
    },
    sourced: true,
    sources: ["microforum"],
    needs: physical,
  },
  {
    key: "merch_ordered",
    phase: "product",
    title: { en: "Merch ordered", fr: "Merch commandé" },
    detail: {
      en: "Window reserved so it does not collide with release week. Nobody on this staff runs merch.",
      fr: "Fenêtre réservée pour ne pas frapper la semaine de sortie. Personne dans cette équipe ne gère le merch.",
    },
    owner: null,
    gapReason: {
      en: "merch is out of scope for the label — there is no department to hand this to",
      fr: "le merch est hors périmètre du label — il n'y a personne à qui le confier",
    },
    proposedOwner: "merch",
    when: () => null,
    noDateReason: {
      en: "no plant publishes a merch or CD lead time (release-fundamentals.md)",
      fr: "aucun fabricant ne publie de délai de merch ou de CD (release-fundamentals.md)",
    },
    basis: {
      en: "release-fundamentals.md — no merch lead time is published; the window is reserved, not dated",
      fr: "release-fundamentals.md — aucun délai de merch n'est publié ; la fenêtre est réservée, pas datée",
    },
    sourced: true,
    sources: ["release-fundamentals"],
    needs: (s) => has(s, "merch"),
  },

  // ── Build the story and pitch it ─────────────────────────────────────────
  {
    key: "presskit_ready",
    phase: "story",
    title: { en: "Presskit and press release finished", fr: "Presskit et communiqué finis" },
    detail: {
      en: "Bio, photos, one-sheet. French first for Quebec, plus English if you are going past it.",
      fr: "Bio, photos, one-sheet. Français d'abord pour le Québec, plus l'anglais si tu sors ailleurs.",
    },
    owner: "presskit",
    when: (a) => a.prepare,
    latest: (a) => a.prepare + wk(1),
    basis: {
      en: "press/knowledge/press-fundamentals.md — prepare assets, 8+ weeks out",
      fr: "press/knowledge/press-fundamentals.md — préparer les actifs, 8 semaines et plus avant",
    },
    sourced: true,
    sources: ["press-timeline"],
    needs: (s) => has(s, "presskit"),
  },
  {
    key: "advance_link_ready",
    phase: "story",
    title: { en: "Advance listening link up", fr: "Lien d'écoute en avance en ligne" },
    detail: {
      en: "One private link that will not expire. Exclaim! refuses download-only folders and CKRL bans WeTransfer by name.",
      fr: "Un lien privé qui n'expire pas. Exclaim! refuse les dossiers en téléchargement seul et CKRL bannit WeTransfer nommément.",
    },
    owner: "press",
    when: (a) => a.prepare,
    latest: (a) => a.prepare + wk(1),
    basis: {
      en: "press/knowledge/press-fundamentals.md — Exclaim! and CKRL on what an advance link must be",
      fr: "press/knowledge/press-fundamentals.md — Exclaim! et CKRL sur ce que doit être un lien d'écoute",
    },
    sourced: true,
    sources: ["press-timeline", "exclaim", "ckrl"],
    needs: (s) => has(s, "press"),
  },
  {
    key: "content_shot",
    phase: "story",
    title: { en: "Content shot and edited", fr: "Contenu tourné et monté" },
    detail: {
      en: "Video, lyric video, live session, teaser cuts — and a Canvas for every track, which is a 3 to 8 second loop. Whatever you plan to post has to exist before the campaign starts.",
      fr: "Vidéoclip, lyric video, session live, extraits teaser — et un Canvas par pièce, une boucle de 3 à 8 secondes. Ce que tu prévois publier doit exister avant le début de la campagne.",
    },
    owner: "digital-marketing",
    when: (a) => a.pressPitch,
    latest: (a) => a.pressPitch + wk(1),
    basis: {
      en: "derived — set one week before the campaign starts. No production lead time is sourced",
      fr: "dérivée — placée une semaine avant le début de la campagne. Aucun délai de production n'est sourcé",
    },
    sourced: false,
    sources: ["spotify-release-guide", "digital-marketing-plan"],
    needs: (s) => has(s, "campaign"),
  },
  {
    key: "radio_serviced",
    phase: "story",
    title: { en: "Radio serviced", fr: "Radios servies" },
    detail: {
      en: "Community and college first — CanCon obliges them to fill 35% Canadian, and 65% French on French-language stations. They need this record.",
      fr: "Communautaire et collégial d'abord — le CanCon les oblige à 35% canadien, et 65% francophone sur les stations françaises. Ils ont besoin de ce disque.",
    },
    owner: "promotion",
    when: (a) => a.radio,
    latest: (a) => a.radio + wk(1),
    basis: {
      en: "promotion/knowledge/radio-pitch.md — service radio 6–8 weeks out; CRTC on the quotas",
      fr: "promotion/knowledge/radio-pitch.md — radio 6 à 8 semaines avant ; CRTC pour les quotas",
    },
    sourced: true,
    sources: ["promotion-radio", "crtc"],
    needs: (s) => has(s, "press"),
  },
  {
    key: "press_pitched",
    phase: "story",
    title: { en: "Press and media pitched", fr: "Presse et médias pitchés" },
    detail: {
      en: "With a story angle, not \"review my record\". Exclaim! assigns album reviews up to a month ahead — four weeks is the last honest moment.",
      fr: "Avec un angle, pas « critique mon disque ». Exclaim! assigne ses critiques jusqu'à un mois d'avance — quatre semaines, c'est la limite honnête.",
    },
    owner: "press",
    when: (a) => a.pressPitch,
    latest: (a) => a.pressPitch + wk(1),
    basis: {
      en: "press/knowledge/press-fundamentals.md — pitch press 4–6 weeks out; Exclaim! is the one sourced advance window",
      fr: "press/knowledge/press-fundamentals.md — presse 4 à 6 semaines avant ; Exclaim! est la seule fenêtre sourcée",
    },
    sourced: true,
    sources: ["press-timeline", "exclaim"],
    needs: (s) => has(s, "press"),
  },
  {
    key: "editorial_pitched",
    phase: "story",
    title: { en: "Editorial pitch sent to Spotify", fr: "Pitch éditorial envoyé à Spotify" },
    detail: {
      en: "One song at a time, and none once it is live. Pitching early is also what puts it on your followers' Release Radar.",
      fr: "Une pièce à la fois, et aucune une fois en ligne. Pitcher tôt, c'est aussi ce qui la place dans le Release Radar de tes abonnés.",
    },
    owner: "promotion",
    when: (a) => a.playlists,
    latest: () => -7,
    basis: {
      en: "Spotify — at least 7 days before release; promotion puts the pitch at 3–4 weeks. No source measures whether earlier is better",
      fr: "Spotify — au moins 7 jours avant ; la presse place le pitch à 3–4 semaines. Aucune source ne mesure si plus tôt est mieux",
    },
    sourced: true,
    sources: ["spotify-pitch", "spotify-release-guide", "promotion-playlist"],
    needs: (s) => has(s, "press") || has(s, "campaign"),
  },
  {
    key: "campaign_live",
    phase: "story",
    title: { en: "Marketing campaign starts", fr: "Début de la campagne marketing" },
    detail: {
      en: "Posts, ads, the budget split. The Digital Marketing Agent turns this into dated tasks — that is where they live, not here.",
      fr: "Publications, pubs, répartition du budget. Le Marketing transforme ça en tâches datées — c'est là qu'elles vivent, pas ici.",
    },
    owner: "digital-marketing",
    when: (a) => a.campaign,
    latest: (a) => a.campaign + wk(1),
    basis: {
      en: "digital-marketing/skills/digital-marketing-plan/SKILL.md — 3–4 weeks before to 1–2 after. The plan uses the 4-week end",
      fr: "digital-marketing/skills/digital-marketing-plan/SKILL.md — 3 à 4 semaines avant, 1 à 2 après. Le plan retient le bout de 4 semaines",
    },
    sourced: true,
    sources: ["digital-marketing-plan"],
    needs: (s) => has(s, "campaign"),
  },
  {
    key: "premiere_offered",
    phase: "story",
    title: { en: "Exclusive premiere runs", fr: "Première exclusive en ligne" },
    detail: {
      en: "One outlet, 24 to 48 hours ahead. Exactly one — nothing in the system stops you offering it twice, and doing so costs you both.",
      fr: "Un seul média, 24 à 48 heures avant. Un seul — rien dans le système ne t'empêche de l'offrir deux fois, et ça te coûte les deux.",
    },
    owner: "press",
    when: (a) => a.premiere,
    latest: () => -1,
    basis: {
      en: "press/knowledge/press-fundamentals.md — one exclusive premiere, 24–48 h pre-release",
      fr: "press/knowledge/press-fundamentals.md — une première exclusive, 24 à 48 h avant la sortie",
    },
    sourced: true,
    sources: ["press-timeline"],
    needs: (s) => has(s, "press"),
  },

  // ── Deliver, release, read ───────────────────────────────────────────────
  {
    key: "single_editorial_pitched",
    phase: "story",
    title: { en: "Editorial pitch sent for the lead single", fr: "Pitch éditorial envoyé pour le single" },
    detail: {
      en: "The single has its own release day, so it gets its own pitch — and once it is live it can never be pitched again. The record's pitch is a different track, later.",
      fr: "Le single a sa propre date, donc son propre pitch — et une fois en ligne, il ne peut plus jamais l'être. Le pitch du disque est une autre chanson, plus tard.",
    },
    owner: "promotion",
    when: (a, s) => (s.leadSingleOffset != null ? s.leadSingleOffset - wk(2) : null),
    latest: (a, s) => (s.leadSingleOffset != null ? s.leadSingleOffset - 7 : null),
    noDateReason: { en: "the single has no date yet", fr: "le single n'a pas encore de date" },
    basis: {
      en: "Spotify — at least 7 days before the single's own release; promotion aims two weeks",
      fr: "Spotify — au moins 7 jours avant la sortie du single ; la promotion vise deux semaines",
    },
    sourced: true,
    sources: ["spotify-pitch", "promotion-playlist"],
    needs: (s) => (has(s, "press") || has(s, "campaign")) && s.leadSingle != null,
  },
  {
    key: "radio_followed_up",
    phase: "story",
    title: { en: "Radio follow-up — every music director who got the record", fr: "Relance radio — chaque directeur musical qui a reçu le disque" },
    detail: {
      en: "One email or call each, five sentences, link only. Three weeks after servicing, when the add meetings are deciding. Ask what they need, not whether they liked it.",
      fr: "Un courriel ou un appel chacun, cinq phrases, lien seulement. Trois semaines après l'envoi, quand les réunions de programmation décident. Demande ce qu'il leur manque, pas s'ils ont aimé.",
    },
    owner: "promotion",
    when: (a) => a.radio + wk(3),
    latest: (a) => a.followUp,
    basis: {
      en: "promotion/knowledge/radio-pitch.md — first follow-up two to three weeks after delivery; the two-follow-up cap the publicist also keeps",
      fr: "promotion/knowledge/radio-pitch.md — première relance deux à trois semaines après l'envoi ; le plafond de deux relances que la publiciste garde aussi",
    },
    sourced: true,
    sources: ["promotion-radio"],
    needs: (s) => has(s, "press"),
  },
  {
    key: "curators_pitched",
    phase: "story",
    title: { en: "Independent playlist curators pitched", fr: "Curateurs de playlists indépendants pitchés" },
    detail: {
      en: "These are not Spotify editorial. They need a live link, so they come at release week and not before.",
      fr: "Ce ne sont pas les éditoriaux de Spotify. Ils ont besoin d'un lien en ligne, donc c'est la semaine de sortie, pas avant.",
    },
    owner: "promotion",
    when: () => 0,
    latest: () => 7,
    basis: {
      en: "promotion/knowledge/playlist-pitch.md — independent curators wait for release week, because they need a live link",
      fr: "promotion/knowledge/playlist-pitch.md — les curateurs indépendants attendent la semaine de sortie, parce qu'ils ont besoin d'un lien en ligne",
    },
    sourced: true,
    sources: ["promotion-playlist"],
    needs: (s) => has(s, "press"),
  },
  {
    key: "distributor_chosen",
    phase: "release",
    title: { en: "Distributor chosen", fr: "Distributeur choisi" },
    detail: {
      en: "What they charge and what they keep differ more than the headline rate. Settle it before you upload.",
      fr: "Ce qu'ils chargent et ce qu'ils gardent diffèrent plus que le taux affiché. Réglé avant de téléverser.",
    },
    owner: "distribution",
    when: (a) => a.pressPitch,
    latest: (a) => a.delivery,
    basis: {
      en: "derived — delivery itself is hours to days, so this is a decision deadline, not a lead time",
      fr: "dérivée — la livraison prend des heures à des jours, donc c'est une échéance de décision, pas un délai",
    },
    sourced: false,
    sources: ["cdbaby-distribution"],
    needs: (s) => has(s, "distribution"),
  },
  {
    key: "delivered",
    phase: "release",
    title: { en: "Record uploaded to the distributor", fr: "Disque téléversé au distributeur" },
    detail: {
      en: "Audio, artwork, codes, songwriter and publisher credits, track attributes, the discovery data (blurb, genre, moods, sounds-like) and a payment method on the account. Nothing after this is editable without a redelivery.",
      fr: "Audio, pochette, codes, crédits d'auteurs et d'éditeurs, attributs des pièces, les données de découverte (résumé, genre, ambiances, ressemble-à) et un mode de paiement au dossier. Rien après ça ne se modifie sans relivraison.",
    },
    owner: "distribution",
    when: (a) => a.delivery,
    latest: () => -7,
    basis: {
      en: "Spotify — deliver at least 7 days before release. No distributor publishes its own turnaround",
      fr: "Spotify — livrer au moins 7 jours avant. Aucun distributeur ne publie son propre délai",
    },
    sourced: true,
    sources: ["spotify-pitch", "cdbaby-distribution"],
    needs: (s) => has(s, "distribution"),
  },
  {
    key: "presave_live",
    phase: "release",
    title: { en: "Pre-save and pre-order page live", fr: "Page de pré-sauvegarde et précommande en ligne" },
    detail: {
      en: "The link only exists once the release is delivered — that is why this sits after the upload, not before it.",
      fr: "Le lien n'existe qu'une fois la sortie livrée — c'est pour ça qu'il vient après le téléversement, pas avant.",
    },
    owner: "digital-marketing",
    when: (a) => a.delivery + 1,
    latest: () => -7,
    basis: {
      en: "derived — the pre-save link is generated from the delivered release",
      fr: "dérivée — le lien de pré-sauvegarde est généré à partir de la sortie livrée",
    },
    sourced: false,
    sources: ["spotify-countdown"],
    needs: (s) => has(s, "campaign") && has(s, "distribution"),
  },
  {
    key: "lyrics_submitted",
    phase: "release",
    title: { en: "Lyrics submitted", fr: "Paroles soumises" },
    detail: {
      en: "Displayed lyrics on Spotify and Apple come through Musixmatch. Submitted before release, they are live on day one; after, they trickle in.",
      fr: "Les paroles affichées sur Spotify et Apple passent par Musixmatch. Soumises avant la sortie, elles sont en ligne dès le jour un ; après, elles arrivent au compte-gouttes.",
    },
    owner: "distribution",
    when: (a) => a.delivery,
    latest: () => -1,
    basis: {
      en: "Spotify — lyrics are supplied through Musixmatch; submitting before release is what gets them showing on day one",
      fr: "Spotify — les paroles passent par Musixmatch ; les soumettre avant la sortie est ce qui les affiche dès le jour un",
    },
    sourced: true,
    sources: ["spotify-lyrics"],
    needs: (s) => has(s, "distribution") && s.projectType !== "tour",
  },
  {
    key: "countdown_page",
    phase: "release",
    title: { en: "Countdown Page published", fr: "Page de compte à rebours publiée" },
    detail: {
      en: "Pre-saves, the tracklist, Clips and merch in one place. Albums and EPs only — singles are not eligible — and you need 3,000 monthly active listeners.",
      fr: "Pré-sauvegardes, liste des pièces, Clips et merch au même endroit. Albums et EP seulement — les singles ne sont pas admissibles — et il faut 3 000 auditeurs actifs par mois.",
    },
    owner: "digital-marketing",
    when: (a) => a.delivery + 3,
    latest: () => -7,
    basis: {
      en: "Spotify — the option appears \"within 72 hours\" of the delivery; \"Only new and original albums and EPs are eligible. Singles aren't eligible.\"; 3,000 monthly active listeners",
      fr: "Spotify — l'option apparaît « within 72 hours » après la livraison ; « Only new and original albums and EPs are eligible. Singles aren't eligible. » ; 3 000 auditeurs actifs par mois",
    },
    sourced: true,
    sources: ["spotify-countdown"],
    needs: (s) => has(s, "campaign") && (s.projectType === "album" || s.projectType === "ep"),
  },
  {
    key: "pandora_submitted",
    phase: "release",
    title: { en: "Submitted to Pandora", fr: "Soumis à Pandora" },
    detail: {
      en: "US only, and only once the record is out — Pandora needs it available before it will take the submission.",
      fr: "États-Unis seulement, et une fois le disque sorti — Pandora exige qu'il soit disponible avant d'accepter la soumission.",
    },
    owner: "distribution",
    when: () => 0,
    latest: () => 14,
    basis: {
      en: "CD Baby — submit \"as soon as your album comes out\", because the music has to be available for purchase first",
      fr: "CD Baby — soumettre « as soon as your album comes out », parce que la musique doit d'abord être disponible",
    },
    sourced: true,
    sources: ["cdbaby-checklist"],
    needs: (s) => has(s, "distribution") && s.markets.includes("usa"),
  },
  {
    key: "single_delivered",
    phase: "release",
    title: { en: "Lead single uploaded", fr: "Single téléversé" },
    detail: {
      en: "The single has its own street date, so it has its own 7-day floor and its own editorial pitch.",
      fr: "Le single a sa propre date de sortie, donc son propre plancher de 7 jours et son propre pitch éditorial.",
    },
    owner: "distribution",
    when: (a, s) => (s.leadSingleOffset != null ? s.leadSingleOffset + a.delivery : null),
    latest: (a, s) => (s.leadSingleOffset != null ? s.leadSingleOffset - 7 : null),
    noDateReason: {
      en: "the single has no date yet — pick one and this whole chain lands",
      fr: "le single n'a pas encore de date — choisis-en une et toute cette chaîne se place",
    },
    basis: {
      en: "derived — the same delivery rule applied to the single's own street date",
      fr: "dérivée — la même règle de livraison appliquée à la date du single",
    },
    sourced: false,
    sources: ["spotify-pitch"],
    needs: (s) => !!s.leadSingle && s.projectType !== "single",
  },
  {
    key: "single_out",
    phase: "release",
    title: { en: "Lead single out", fr: "Single en ligne" },
    detail: {
      en: "Once it is live it can never be pitched again. The next pitch is a different track, for the record itself.",
      fr: "Une fois en ligne, elle ne peut plus jamais être pitchée. Le prochain pitch vise une autre pièce, pour le disque.",
    },
    owner: null,
    gapReason: { en: "release day — nothing to hand off", fr: "jour de sortie — rien à confier" },
    when: (a, s) => s.leadSingleOffset ?? null,
    noDateReason: {
      en: "the single has no date yet",
      fr: "le single n'a pas encore de date",
    },
    basis: {
      en: "Spotify — one pitch at a time, and none once a song has gone live",
      fr: "Spotify — un pitch à la fois, et aucun une fois la pièce en ligne",
    },
    sourced: true,
    sources: ["spotify-pitch"],
    needs: (s) => !!s.leadSingle && s.projectType !== "single",
  },
  {
    key: "release_day",
    phase: "release",
    title: { en: "Release day", fr: "Jour de sortie" },
    detail: {
      en: "Press release goes wide to everyone who did not get an advance. Independent curators can be pitched now — they need a live link.",
      fr: "Le communiqué part à tous ceux qui n'ont pas eu d'avance. Les curateurs indépendants se pitchent maintenant — ils ont besoin d'un lien en ligne.",
    },
    owner: null,
    gapReason: { en: "the day itself — nothing to hand off", fr: "le jour même — rien à confier" },
    when: () => 0,
    basis: {
      en: "press/knowledge/press-fundamentals.md — release week: the press release goes wide; independent curators wait for a live link",
      fr: "press/knowledge/press-fundamentals.md — semaine de sortie : le communiqué part large ; les curateurs indépendants attendent un lien en ligne",
    },
    sourced: true,
    sources: ["press-timeline"],
    needs: () => true,
  },

  {
    key: "followed_up",
    phase: "release",
    title: { en: "One follow-up to everyone who got an advance", fr: "Une relance à tous ceux qui ont eu une avance" },
    detail: {
      en: "One. Journalists ask for one. The schema will let you send a second and that is the cap, not a suggestion.",
      fr: "Une. Les journalistes en demandent une. Le système en permet une deuxième et c'est le plafond, pas une suggestion.",
    },
    owner: "press",
    when: (a) => a.followUp,
    latest: (a) => a.followUp + wk(1),
    basis: {
      en: "press/knowledge/press-fundamentals.md — 2 weeks before: one follow-up, and schedule interviews",
      fr: "press/knowledge/press-fundamentals.md — 2 semaines avant : une relance, et planifier les entrevues",
    },
    sourced: true,
    sources: ["press-timeline"],
    needs: (s) => has(s, "press"),
  },
  {
    key: "radio_followed_up_release",
    phase: "release",
    title: { en: "Radio follow-up — release week, the last one", fr: "Relance radio — semaine de sortie, la dernière" },
    detail: {
      en: "The record is out and the link is public: one more note to every station that has not answered, and then stop. Two is the cap.",
      fr: "Le disque est sorti et le lien est public : une dernière note à chaque station qui n'a pas répondu, puis on arrête. Deux, c'est le plafond.",
    },
    owner: "promotion",
    when: () => 0,
    latest: () => 7,
    basis: {
      en: "promotion/knowledge/radio-pitch.md — second and last follow-up in release week",
      fr: "promotion/knowledge/radio-pitch.md — deuxième et dernière relance la semaine de sortie",
    },
    sourced: true,
    sources: ["promotion-radio"],
    needs: (s) => has(s, "press"),
  },
  {
    key: "curators_followed_up",
    phase: "release",
    title: { en: "Follow up with the playlist curators", fr: "Relancer les curateurs de playlists" },
    detail: {
      en: "Two weeks after the pitch, with the first-week numbers in one line. A curator who said nothing is a curator who has not listened yet.",
      fr: "Deux semaines après le pitch, avec les chiffres de la première semaine en une ligne. Un curateur qui n'a rien dit n'a pas encore écouté.",
    },
    owner: "promotion",
    when: () => 14,
    latest: () => 21,
    basis: {
      en: "promotion/knowledge/playlist-pitch.md — independent curators answer on their own clock; one follow-up, with numbers",
      fr: "promotion/knowledge/playlist-pitch.md — les curateurs indépendants répondent à leur rythme ; une relance, avec des chiffres",
    },
    sourced: false,
    sources: ["promotion-playlist"],
    needs: (s) => has(s, "press"),
  },
  {
    key: "dsp_profiles_claimed",
    phase: "release",
    title: { en: "Spotify for Artists and Apple Music for Artists claimed", fr: "Spotify for Artists et Apple Music for Artists réclamés" },
    detail: {
      en: "Right after the upload: your distributor grants Spotify access instantly, a manual request takes days. Without it there is no editorial pitch, no Canvas, no Countdown Page and no numbers to read.",
      fr: "Tout de suite après le téléversement : ton distributeur donne l'accès Spotify instantanément, une demande manuelle prend des jours. Sans ça, pas de pitch éditorial, pas de Canvas, pas de Countdown Page et aucun chiffre à lire.",
    },
    owner: "promotion",
    when: (a) => a.delivery + 3,
    latest: () => -10,
    basis: {
      en: "Spotify — access is automatic through a preferred distributor once a release is submitted, otherwise a manual review of a few days; it has to exist before the pitch floor",
      fr: "Spotify — l'accès est automatique par un distributeur partenaire dès qu'une sortie est soumise, sinon une révision manuelle de quelques jours ; il doit exister avant le plancher du pitch",
    },
    sourced: true,
    sources: ["spotify-access", "promotion-playlist"],
    needs: (s) => has(s, "distribution"),
  },
  {
    key: "charts_checked",
    phase: "release",
    title: { en: "Check the !earshot chart weekly", fr: "Vérifier le palmarès !earshot chaque semaine" },
    detail: {
      en: "Weeks 1 to 8. !earshot publishes weekly, so a position is readable every week — and radio follow-ups stay inside the cap.",
      fr: "Semaines 1 à 8. !earshot publie chaque semaine, donc une position se lit chaque semaine — et les relances radio restent sous le plafond.",
    },
    owner: "promotion",
    when: () => 7,
    latest: () => 56,
    basis: {
      en: "promotion/knowledge/radio-pitch.md — !earshot publishes charts weekly, weeks 1–8",
      fr: "promotion/knowledge/radio-pitch.md — !earshot publie des palmarès hebdomadaires, semaines 1 à 8",
    },
    sourced: true,
    sources: ["earshot", "promotion-radio"],
    needs: (s) => has(s, "press") && s.markets.some((m) => m === "quebec" || m === "canada"),
  },
  {
    key: "numbers_read",
    phase: "release",
    title: { en: "Read the numbers", fr: "Lire les chiffres" },
    detail: {
      en: "One week in, which is when Spotify says to look. Do not stop the campaign here: 75% of a release's first-year streams happen after the first month.",
      fr: "Une semaine après, c'est le moment que Spotify indique. N'arrête pas la campagne ici : 75 % des écoutes de la première année arrivent après le premier mois.",
    },
    owner: "platforms",
    when: () => 7,
    latest: () => 30,
    basis: {
      en: "Spotify release guide — check the Audience page \"a week after your release date\"; \"75% of a release's first-year streams happen after the first month\"",
      fr: "Guide de sortie Spotify — consulter la page Audience « a week after your release date » ; « 75% of a release's first-year streams happen after the first month »",
    },
    sourced: true,
    sources: ["spotify-release-guide"],
    needs: (s) => has(s, "post_release"),
  },
];

// ── resolution ──────────────────────────────────────────────

export interface ResolvedMilestone {
  key: string;
  phase: PhaseKey;
  title: Text;
  detail: Text;
  owner: Owner;
  gapReason?: Text;
  proposedOwner?: string;
  offsetDays: number | null;
  /** ISO day, computed from the street date. null when offsetDays is null. */
  date: string | null;
  /** The last honest day for this step, when the source gives a window. */
  latestOffsetDays: number | null;
  latestDate: string | null;
  noDateReason?: Text;
  basis: Text;
  sourced: boolean;
  sources: string[];
  /** What the step costs, when the label holds a price or knows why it has none. */
  cost?: ResolvedCost;
}

export interface ResolvedPhase {
  key: PhaseKey;
  order: number;
  title: Text;
  startsDay: number | null;
  endsDay: number | null;
  owners: Owner[];
  milestones: ResolvedMilestone[];
}

export type WarningKind =
  | "past_start" | "masters_late" | "no_lead_single" | "single_no_date"
  | "single_inside_recording" | "unsourced_dates" | "no_owner" | "funding_first"
  | "not_started" | "missing_department"
  | "no_budget" | "under_floor" | "under_aim" | "budget_room" | "foreign_currency";

export interface Warning {
  kind: WarningKind;
  /** One sentence, two at most. */
  text: Text;
}

export interface Plan {
  streetDate: string;
  daysOut: number;
  phases: ResolvedPhase[];
  milestones: ResolvedMilestone[];
  longPole: { key: string; date: string | null; title: Text; basis: Text } | null;
  /** Departments the label does not have, named by the steps that needed them. */
  missingDepartments: string[];
  warnings: Warning[];
  anchors: Anchors;
  /** The plan priced: three tiers, each department's lines, the verdict on the budget. */
  budget: BudgetView;
}

export const addDays = (iso: string, n: number): string =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);

export const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY);

/**
 * The whole plan, from the scope and two dates. Pure — `today` is a parameter
 * so the same inputs always give the same plan, including in tests.
 */
export function resolve(scope: Scope, streetDate: string, today: string): Plan {
  const a = anchorsFor(scope);

  const milestones: ResolvedMilestone[] = MILESTONES.filter((m) => m.needs(scope)).map((m) => {
    const offsetDays = m.when(a, scope);
    // Clamp here so a scope that collapses a range degrades to one day
    // instead of printing a backwards window.
    const raw = offsetDays == null ? null : (m.latest?.(a, scope) ?? null);
    const latestOffsetDays = raw != null && raw > offsetDays! ? raw : null;
    return {
      key: m.key,
      phase: m.phase,
      title: m.title,
      detail: m.detail,
      owner: m.owner,
      gapReason: m.gapReason,
      proposedOwner: m.proposedOwner,
      offsetDays,
      date: offsetDays == null ? null : addDays(streetDate, offsetDays),
      latestOffsetDays,
      latestDate: latestOffsetDays == null ? null : addDays(streetDate, latestOffsetDays),
      noDateReason: m.noDateReason,
      basis: m.basis,
      sourced: m.sourced,
      sources: m.sources,
    };
  });

  // Dated first, in date order; undated after, in catalog order. An undated
  // milestone floating in the middle of a calendar reads as "no deadline".
  milestones.sort((x, y) => {
    if (x.offsetDays == null && y.offsetDays == null) return 0;
    if (x.offsetDays == null) return 1;
    if (y.offsetDays == null) return -1;
    return x.offsetDays - y.offsetDays;
  });

  // Phases run in the order a release is made, not by earliest milestone.
  // Otherwise a pre-release single's upload puts the release phase first.
  const used = PHASE_ORDER.filter((k) => milestones.some((m) => m.phase === k));
  const phases: ResolvedPhase[] = used
    .map((key, i) => {
      const mine = milestones.filter((m) => m.phase === key);
      const dated = mine.filter((m) => m.offsetDays != null).map((m) => m.offsetDays!);
      return {
        key,
        order: i + 1,
        title: PHASES[key],
        startsDay: dated.length ? Math.min(...dated) : null,
        endsDay: dated.length ? Math.max(...dated) : null,
        owners: [...new Set(mine.map((m) => m.owner))],
        milestones: mine,
      };
    });

  const datedOnly = milestones.filter((m) => m.offsetDays != null);
  const first = datedOnly[0] ?? null;
  const longPole = first
    ? { key: first.key, date: first.date, title: first.title, basis: first.basis }
    : null;

  // Priced after the scope has chosen the steps, so a dropped step is never
  // billed. Each line is also hung on its milestone for the page and the rows.
  const budget = budgetFor(scope, a, milestones);
  for (const line of budget.lines) {
    const ms = milestones.find((m) => m.key === line.key);
    if (ms) ms.cost = line;
  }
  const ownerLabel = (o: Owner, lang: Lang) => OWNER_LABEL[o ?? "you"][lang];

  return {
    streetDate,
    daysOut: daysBetween(today, streetDate),
    phases,
    milestones,
    longPole,
    missingDepartments: [...new Set(milestones.map((m) => m.proposedOwner).filter(Boolean))] as string[],
    warnings: [...warningsFor(scope, milestones, streetDate, today), ...budgetWarnings(budget, ownerLabel)],
    anchors: a,
    budget,
  };
}

/** Warnings are one sentence each, and never more than a handful. */
function warningsFor(
  scope: Scope,
  milestones: ResolvedMilestone[],
  streetDate: string,
  today: string,
): Warning[] {
  const out: Warning[] = [];
  const dated = milestones.filter((m) => m.date != null);
  const start = dated[0];

  if (start?.date && start.date < today) {
    const late = daysBetween(start.date, today);
    out.push({
      kind: "past_start",
      text: {
        en: `The plan should have started ${late} days ago (${start.date}). Either move the street date or drop what does not fit — it will not compress.`,
        fr: `Le plan aurait dû commencer il y a ${late} jours (${start.date}). Recule la date de sortie ou coupe ce qui n'entre pas — ça ne se comprime pas.`,
      },
    });
  }

  const masters = milestones.find((m) => m.key === "masters_done");
  if (masters?.date && scope.mastersReadyOffset != null) {
    const yours = addDays(streetDate, scope.mastersReadyOffset);
    if (yours > masters.date) {
      const late = daysBetween(masters.date, yours);
      out.push({
        kind: "masters_late",
        text: {
          en: `Your masters land ${late} days after the plan needs them (${yours} vs ${masters.date}). Everything downstream moves by the same ${late} days.`,
          fr: `Tes masters arrivent ${late} jours après ce que le plan exige (${yours} vs ${masters.date}). Tout ce qui suit décale des mêmes ${late} jours.`,
        },
      });
    }
  }

  if (scope.recordingStatus === "not_started" && scope.branches.includes("creation")) {
    out.push({
      kind: "not_started",
      text: {
        en: "The record is not recorded yet and no studio turnaround is sourced here. The dates in phase 1 are deadlines, not estimates.",
        fr: "Le disque n'est pas enregistré et aucun délai de studio n'est sourcé ici. Les dates de la phase 1 sont des échéances, pas des estimations.",
      },
    });
  }

  if (!scope.leadSingle && scope.projectType !== "tour") {
    out.push({
      kind: "no_lead_single",
      text: {
        en: "No lead single chosen. You get one editorial pitch per release and none once a track is live — decide before the upload.",
        fr: "Aucun single choisi. Un seul pitch éditorial par sortie, et aucun une fois une pièce en ligne — décide avant le téléversement.",
      },
    });
  } else if (scope.leadSingle && scope.leadSingleOffset == null && scope.projectType !== "single") {
    out.push({
      kind: "single_no_date",
      text: {
        en: `"${scope.leadSingle}" has no release date. Its own date is the binding one, not the record's — everything for it counts back from there.`,
        fr: `« ${scope.leadSingle} » n'a pas de date. C'est sa date à elle qui contraint, pas celle du disque — tout se compte à rebours de là.`,
      },
    });
  }

  // The single's upload is compared to when the masters actually land: the
  // artist's own estimate when given, the deadline otherwise.
  const singleUp = milestones.find((m) => m.key === "single_delivered");
  const mastersEffective =
    scope.mastersReadyOffset != null ? addDays(streetDate, scope.mastersReadyOffset) : masters?.date;
  if (singleUp?.date && mastersEffective && singleUp.date < mastersEffective) {
    const gap = daysBetween(singleUp.date, mastersEffective);
    out.push({
      kind: "single_inside_recording",
      text: {
        en: `"${scope.leadSingle}" has to be uploaded ${singleUp.date} — ${gap} days before your masters land. Finish that one track early, or move the single.`,
        fr: `« ${scope.leadSingle} » doit être livrée le ${singleUp.date}, soit ${gap} jours avant tes masters. Finis cette pièce-là d'avance, ou recule le single.`,
      },
    });
  }

  const proposed = [...new Set(milestones.map((m) => m.proposedOwner).filter(Boolean))] as string[];
  if (proposed.length) {
    out.push({
      kind: "missing_department",
      text: {
        en: `${proposed.length} steps need a department the label doesn't have: ${proposed.join(" · ")}. Ask the Recruiting Agent if you want one.`,
        fr: `${proposed.length} étapes demandent un département que le label n'a pas : ${proposed.join(" · ")}. Demande au Recruteur si tu en veux un.`,
      },
    });
  }

  const ownerless = milestones.filter(
    (m) => m.owner == null && !m.proposedOwner && m.key !== "release_day",
  );
  if (ownerless.length) {
    out.push({
      kind: "no_owner",
      text: {
        // " · ", not ", ": many titles contain a comma of their own.
        en: `${ownerless.length} steps have no department: ${ownerless.map((m) => m.title.en.toLowerCase()).join(" · ")}. Those are yours, by design.`,
        fr: `${ownerless.length} étapes n'ont aucun département : ${ownerless.map((m) => m.title.fr.toLowerCase()).join(" · ")}. Elles sont à toi, volontairement.`,
      },
    });
  }

  const derived = milestones.filter((m) => !m.sourced && m.date);
  if (derived.length) {
    out.push({
      kind: "unsourced_dates",
      text: {
        en: `${derived.length} dates are marked ≈. The step is real; the day is our arithmetic off a sourced one, not a published lead time.`,
        fr: `${derived.length} dates portent ≈. L'étape est réelle ; le jour vient de notre calcul à partir d'une source, pas d'un délai publié.`,
      },
    });
  }
  return out;
}
