/**
 * The closed sets `init` offers. A known-few answer is a list here; a story
 * (bio, project) belongs to the intake skills. Labels are plain language over
 * the stored enum values.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

import type { Locale } from "./strings";

export interface Choice<T = string> {
  en: string;
  fr: string;
  value: T;
}

/** Render a bilingual list for @inquirer/prompts. */
export const choices = <T>(list: Choice<T>[], locale: Locale) =>
  list.map((c) => ({ name: locale === "fr" ? c.fr : c.en, value: c.value }));

/** artist.profile.artist_type */
export const ARTIST_TYPES: Choice[] = [
  { en: "Just me", fr: "Juste moi", value: "solo" },
  { en: "The two of us", fr: "Nous deux", value: "duo" },
  { en: "A band", fr: "Un groupe", value: "band" },
  { en: "A collective", fr: "Un collectif", value: "collective" },
];

/** artist.profile.career_stage — the enum, said the way a person would say it. */
export const CAREER_STAGES: Choice[] = [
  { en: "Starting out — first few releases", fr: "Je commence — mes premières sorties", value: "emerging" },
  { en: "Touring and getting some press locally", fr: "Je tourne, un peu de presse locale", value: "mid-career" },
  { en: "Known nationally or beyond", fr: "Connu·e à l'échelle nationale ou plus", value: "established" },
];

/** artist.profile.disciplines — what grant panels and PROs both ask. */
export const DISCIPLINES: Choice[] = [
  { en: "I write the songs", fr: "J'écris les chansons", value: "songwriter" },
  { en: "I perform them", fr: "Je les interprète", value: "performer" },
  { en: "I produce", fr: "Je réalise / produis", value: "producer" },
  { en: "I compose (score, instrumental)", fr: "Je compose (musique à l'image, instrumental)", value: "composer" },
  { en: "I lead a band", fr: "Je dirige un groupe", value: "bandleader" },
];

/** artist.profile.languages: what the artist works in, not the UI language.
 *  It splits FACTOR from Musicaction. */
export const LANGUAGES: Choice[] = [
  { en: "English", fr: "Anglais", value: "en" },
  { en: "French", fr: "Français", value: "fr" },
];

/**
 * artist.profile.target_markets: where the artist sells. 'QC' is separate from
 * 'CA' because Québec has its own funders, press and radio quota.
 */
export const MARKETS: Choice[] = [
  { en: "Québec", fr: "Le Québec", value: "QC" },
  { en: "Canada", fr: "Le Canada", value: "CA" },
  { en: "United States", fr: "Les États-Unis", value: "US" },
];

export const COUNTRIES: Choice[] = [
  { en: "Canada", fr: "Canada", value: "CA" },
  { en: "United States", fr: "États-Unis", value: "US" },
];

/** Citizenship is its own question: funders gate on it, not on residency. */
export const CITIZENSHIPS: Choice<string[]>[] = [
  { en: "Canadian", fr: "Canadienne", value: ["CA"] },
  { en: "American", fr: "Américaine", value: ["US"] },
  { en: "Both", fr: "Les deux", value: ["CA", "US"] },
  { en: "Neither / prefer not to say", fr: "Ni l'une ni l'autre / je préfère ne pas dire", value: [] },
];

export const REGIONS: Record<string, Choice[]> = {
  CA: [
    ["QC", "Quebec", "Québec"], ["ON", "Ontario"], ["BC", "British Columbia", "Colombie-Britannique"], ["AB", "Alberta"],
    ["MB", "Manitoba"], ["SK", "Saskatchewan"], ["NS", "Nova Scotia", "Nouvelle-Écosse"], ["NB", "New Brunswick", "Nouveau-Brunswick"],
    ["NL", "Newfoundland and Labrador", "Terre-Neuve-et-Labrador"], ["PE", "Prince Edward Island", "Île-du-Prince-Édouard"], ["YT", "Yukon"],
    ["NT", "Northwest Territories", "Territoires du Nord-Ouest"], ["NU", "Nunavut"],
  ].map(([value, name, fr]) => ({ en: name!, fr: (fr ?? name)!, value: value! })),
  US: [
    ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
    ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],
    ["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],
    ["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],
    ["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],
    ["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],
    ["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],
    ["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],
    ["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],
    ["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],
    ["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
  ].map(([value, name]) => ({ en: name!, fr: name!, value: value! })),
};

/** IANA zone per region, so the artist is never asked for one. Digital-marketing
 *  schedules against it. */
export const TIMEZONES: Record<string, string> = {
  QC: "America/Toronto", ON: "America/Toronto", NS: "America/Halifax", NB: "America/Moncton",
  PE: "America/Halifax", NL: "America/St_Johns", MB: "America/Winnipeg", SK: "America/Regina",
  AB: "America/Edmonton", BC: "America/Vancouver", YT: "America/Whitehorse",
  NT: "America/Yellowknife", NU: "America/Iqaluit",
  NY: "America/New_York", CA_US: "America/Los_Angeles",
};

/** Coarse fallback by longitude band, used when the table above has no row. */
export function timezoneFor(country: string, region: string): string | undefined {
  if (TIMEZONES[region]) return TIMEZONES[region];
  if (country !== "US") return undefined;
  const pacific = ["WA", "OR", "CA", "NV"];
  const mountain = ["ID", "MT", "WY", "UT", "CO", "AZ", "NM"];
  const central = ["ND", "SD", "NE", "KS", "OK", "TX", "MN", "IA", "MO", "AR", "LA", "WI", "IL", "MS", "AL", "TN"];
  if (pacific.includes(region)) return "America/Los_Angeles";
  if (mountain.includes(region)) return "America/Denver";
  if (central.includes(region)) return "America/Chicago";
  if (region === "AK") return "America/Anchorage";
  if (region === "HI") return "Pacific/Honolulu";
  return "America/New_York";
}

/**
 * artist.platforms.platform: the set that table's check constraint allows.
 * Asked last and skippable.
 */
export const PLATFORMS: Choice[] = [
  { en: "Spotify", fr: "Spotify", value: "spotify" },
  { en: "Apple Music", fr: "Apple Music", value: "apple_music" },
  { en: "Instagram", fr: "Instagram", value: "instagram" },
  { en: "YouTube", fr: "YouTube", value: "youtube" },
  { en: "TikTok", fr: "TikTok", value: "tiktok" },
  { en: "Bandcamp", fr: "Bandcamp", value: "bandcamp" },
  { en: "SoundCloud", fr: "SoundCloud", value: "soundcloud" },
  { en: "Facebook", fr: "Facebook", value: "facebook" },
  { en: "X (Twitter)", fr: "X (Twitter)", value: "x" },
  { en: "Deezer", fr: "Deezer", value: "deezer" },
  { en: "Your website", fr: "Ton site web", value: "website" },
  { en: "Linktree", fr: "Linktree", value: "linktree" },
];
