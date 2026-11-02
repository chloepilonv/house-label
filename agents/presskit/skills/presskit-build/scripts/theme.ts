/**
 * The deck's palette and type: `artist.brand`, then `presskit.visual_identity`,
 * then GENRE_MOOD/DEFAULT. Every function returns a complete theme, so colours
 * never fail the run. Default fonts are ones Google Slides ships, since Slides
 * silently substitutes any other.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

export interface Theme {
  /** Hex without the leading #. pptxgenjs rejects "#B26B36". */
  primary: string;
  background: string;
  text: string;
  card: string;
  muted: string;
  fontDisplay: string;
  fontBody: string;
  /** Two to four words. Printed nowhere; it explains the palette to the artist. */
  mood: string;
  /** Which of the three sources won, so the artist can be told. */
  source: "brand" | "moodboard" | "genre" | "default";
}

/** Lookup table, not a model call: same genre, same mood. */
const GENRE_MOOD: [RegExp, string, Partial<Theme>][] = [
  [/hip hop|rap|trap|drill/, "bold, urban, high-contrast",
   { primary: "E8452B", background: "0C0C0E", text: "FFFFFF", card: "1A1A1E", muted: "8A8A93" }],
  [/electronic|edm|techno|house|dance|synth/, "modern, futuristic, vivid",
   { primary: "00E0C6", background: "0A0E14", text: "F2F5F7", card: "141A22", muted: "7C8A96" }],
  [/folk|acoustic|country|singer.songwriter/, "warm, organic, earthy",
   { primary: "B26B36", background: "F6F1E8", text: "1E1B16", card: "ECE4D6", muted: "8C8175" }],
  [/jazz|soul|blues|rnb|r&b/, "sophisticated, elegant, moody",
   { primary: "C79A3A", background: "121016", text: "F4F1EA", card: "1E1B24", muted: "8E8798" }],
  [/indie|alternative|rock|punk/, "raw, authentic, textured",
   { primary: "D94F3D", background: "18171A", text: "F5F4F2", card: "232227", muted: "8B8990" }],
  [/classical|orchestral|opera/, "refined, timeless, formal",
   { primary: "5B6E8C", background: "FBFAF7", text: "1A1D24", card: "EDEFF3", muted: "7E858F" }],
  [/pop/, "bright, polished, upbeat",
   { primary: "E0407F", background: "FFFFFF", text: "141218", card: "F6EFF3", muted: "8A8290" }],
  [/metal|hardcore/, "intense, dark, powerful",
   { primary: "9E2B2B", background: "0B0B0C", text: "F2F2F2", card: "191919", muted: "807F80" }],
  [/ambient|experimental|avant/, "atmospheric, abstract, minimal",
   { primary: "7C8FA6", background: "F2F3F4", text: "1C1E21", card: "E4E7EA", muted: "868C93" }],
  [/world|latin|afrobeat|reggae/, "vibrant, cultural, rhythmic",
   { primary: "E58A1E", background: "FFF9F0", text: "1B1710", card: "F5E9D6", muted: "8D8272" }],
];

/** Violet on white. Reached only when nothing else is known. */
const DEFAULT: Theme = {
  primary: "8B5CF6", background: "FFFFFF", text: "0A0A0A", card: "F4F4F5",
  muted: "8A8A93", fontDisplay: "Georgia", fontBody: "Arial",
  mood: "professional, clean, artistic", source: "default",
};

/** "#B26B36" → "B26B36". pptxgenjs rejects the hash. */
const bare = (hex: unknown): string | null =>
  typeof hex === "string" && /^#?[0-9a-fA-F]{6}$/.test(hex.trim())
    ? hex.trim().replace(/^#/, "").toUpperCase()
    : null;

export function themeForGenre(genres: string | string[] | null | undefined): Theme {
  // `artist.profile.genres` is a Postgres text[], so a real row is an array.
  const g = (Array.isArray(genres) ? genres.join(" ") : (genres ?? "")).toLowerCase();
  for (const [re, mood, colors] of GENRE_MOOD) {
    if (re.test(g)) return { ...DEFAULT, ...colors, mood, source: "genre" };
  }
  return DEFAULT;
}

export interface ThemeInputs {
  genres?: string | null;
  /** `presskit.visual_identity` — whatever the moodboard pass extracted. */
  visualIdentity?: Record<string, unknown> | null;
  /** `artist.brand` — what the artist chose. Highest priority. */
  brand?: Record<string, unknown> | null;
}

/**
 * The theme, and which source won. Each layer overrides field by field, so a
 * brand row holding only an accent colour keeps the rest of the derived
 * palette rather than reverting the whole thing to the default.
 */
export function resolveTheme(inputs: ThemeInputs): Theme {
  let t = themeForGenre(inputs.genres);

  const vi = inputs.visualIdentity ?? {};
  const viColors = {
    // `*_color` spelling kept for older rows; presskit.sql writes `primary`/….
    primary: bare(vi.primary ?? vi.primary_color),
    background: bare(vi.background ?? vi.background_color),
    text: bare(vi.text ?? vi.text_color),
    card: bare(vi.card ?? vi.card_color),
  };
  if (Object.values(viColors).some(Boolean)) {
    t = {
      ...t,
      primary: viColors.primary ?? t.primary,
      background: viColors.background ?? t.background,
      text: viColors.text ?? t.text,
      card: viColors.card ?? t.card,
      mood: typeof vi.mood === "string" && vi.mood.trim() ? vi.mood.trim() : t.mood,
      source: "moodboard",
    };
  }

  const b = inputs.brand ?? {};
  const bColors = {
    primary: bare(b.primary_color),
    background: bare(b.background_color),
    text: bare(b.text_color),
    accent: bare(b.accent_color),
  };
  const bFonts = {
    display: typeof b.font_display === "string" && b.font_display.trim() ? b.font_display.trim() : null,
    body: typeof b.font_body === "string" && b.font_body.trim() ? b.font_body.trim() : null,
  };
  if (Object.values(bColors).some(Boolean) || bFonts.display || bFonts.body) {
    t = {
      ...t,
      // `primary_color` wins over `accent_color` when both are set.
      primary: bColors.primary ?? bColors.accent ?? t.primary,
      background: bColors.background ?? t.background,
      text: bColors.text ?? t.text,
      fontDisplay: bFonts.display ?? t.fontDisplay,
      fontBody: bFonts.body ?? t.fontBody,
      source: "brand",
    };
  }

  return t;
}

/** Relative luminance, for the contrast guard below. */
function luminance(hex: string): number {
  const v = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * Body text must clear WCAG AA (4.5:1) against the background. If a brand
 * pair fails, text flips to black or white and the caller is told.
 */
export function enforceContrast(t: Theme): { theme: Theme; warning: string | null } {
  if (contrast(t.text, t.background) >= 4.5) return { theme: t, warning: null };
  const better = contrast("000000", t.background) >= contrast("FFFFFF", t.background) ? "000000" : "FFFFFF";
  return {
    theme: { ...t, text: better },
    warning: `text ${t.text} on ${t.background} was below AA (${contrast(t.text, t.background).toFixed(1)}:1) — using ${better}`,
  };
}
