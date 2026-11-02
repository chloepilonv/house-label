/**
 * Two invented artists for the presskit e2e, with real fetchable URLs.
 * Real URLs because the failures come from the network, not the logic. The
 * artists have no Bandcamp or press, so the run checks "nothing" is handled.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

export interface Fixture {
  slug: string;
  profile: {
    artist_name: string;
    city: string;
    province: string;
    country: string;
    /**
     * Plain string here; `e2e.ts` splits it into the `text[]` column
     * `artist.profile.genres`. Assertions read the array back from the
     * database, never this string.
     */
    genres: string;
    career_stage: string;
    preferred_locale: "en" | "fr";
  };
  /** Free text, exactly as an artist would type it at step 1. */
  moodboard: string;
  /** null = derive everything from the moodboard. */
  brand: { primary_color?: string; font_display?: string; font_body?: string } | null;
  /** A real Bandcamp artist page, or null when the artist has none. */
  bandcamp: string | null;
  /** A real, fetchable poster scan. Vision must read shows off it. */
  poster: string | null;
  /** Genre + city + a release, for the press search. Without it: a stranger. */
  disambiguation: string;
  /** Real, fetchable photo URLs, with the slot each one belongs in. */
  photos: { url: string; slot: "hero" | "secondary" | "gallery" }[];
  /** What the run must produce to count as passing. */
  expect: {
    /** Fewest Bandcamp releases that still means the scrape worked. */
    minReleases: number;
    minPressCandidates: number;
    minShowsFromPoster: number;
    /** The palette the genre must resolve to, so a silent change is caught. */
    themePrimary: string;
  };
}

/** Wikimedia needs the bare file URL — its imageinfo API appends utm params. */
const COMMONS = "https://upload.wikimedia.org/wikipedia/commons";

export const FIXTURES: Fixture[] = [
  {
    slug: "odile-ray",
    profile: {
      artist_name: "Odile Ray",
      city: "Montreal",
      province: "QC",
      country: "CA",
      genres: "folk acoustic",
      career_stage: "mid-career",
      preferred_locale: "fr",
    },
    moodboard:
      "warm and handmade, like a photo left in the sun. Muted oranges and cream, nothing glossy. Think Sharon Van Etten record sleeves.",
    brand: null,
    // No Bandcamp page: covers the FLOW's `releases_typed` branch.
    bandcamp: null,
    poster: `${COMMONS}/1/1a/David_Allan_Coe_concert_poster.jpg`,
    disambiguation: "francophone folk singer-songwriter, Montreal, Quebec",
    photos: [
      { url: "https://picsum.photos/seed/mg-hero/900/1200", slot: "hero" },
      { url: "https://picsum.photos/seed/mg-2/900/1200", slot: "secondary" },
      { url: "https://picsum.photos/seed/mg-3/900/1200", slot: "gallery" },
      { url: "https://picsum.photos/seed/mg-4/900/1200", slot: "gallery" },
    ],
    expect: {
      minReleases: 0,
      minPressCandidates: 0, // invented artist: the web has no press on her
      minShowsFromPoster: 1,
      themePrimary: "B26B36", // folk → warm, organic, earthy
    },
  },
  {
    slug: "lamprey-season",
    profile: {
      artist_name: "Lamprey Season",
      city: "Portland",
      province: "OR",
      country: "US",
      genres: "punk",
      career_stage: "mid-career",
      preferred_locale: "en",
    },
    moodboard: "photocopied flyers, black and red, staples and tape.",
    // Has a brand, so this covers the override path in `resolveTheme`.
    brand: { primary_color: "#3E6B8F", font_display: "Georgia" },
    bandcamp: null,
    poster: null,
    disambiguation: "punk trio, Portland Oregon",
    photos: [
      { url: "https://picsum.photos/seed/am-hero/900/1200", slot: "hero" },
      { url: "https://picsum.photos/seed/am-2/900/1200", slot: "secondary" },
      { url: "https://picsum.photos/seed/am-3/900/1200", slot: "gallery" },
    ],
    expect: {
      minReleases: 0,
      minPressCandidates: 0, // invented band: the web has no press on them
      minShowsFromPoster: 0,
      themePrimary: "3E6B8F", // brand override beats the punk palette
    },
  },
];
