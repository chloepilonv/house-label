/**
 * Which platforms one asset has to publish on, given the ones the artist picked.
 *
 *   bun run agents/digital-marketing/skills/digital-marketing-plan/scripts/format-groups.ts instagram tiktok youtube
 *
 * One asset is one post task, on every platform of its format group, on one date;
 * never a subset. Code, not prompt, so a plan that splits an asset fails. This is
 * the only copy of the matrix; ../../../knowledge/platform-conventions.md holds
 * limits, posting windows and hashtag conventions.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

/** The six the strategist supports. Same set as the schema's platforms[]. */
export type Platform =
  | "instagram"
  | "tiktok"
  | "facebook"
  | "x"
  | "youtube"
  | "youtube_shorts";

/** Same two the interview core speaks. */
export type Lang = "en" | "fr";

/** A family of asset. Everything in one family publishes together. */
export type Format =
  | "short_video"
  | "long_video"
  | "image"
  | "story"
  | "carousel"
  | "text";

/** Which families each platform can carry. The matrix, and the only copy. */
export const CARRIES: Record<Platform, Format[]> = {
  instagram: ["short_video", "image", "story", "carousel"],
  tiktok: ["short_video"],
  facebook: ["long_video", "image", "story", "text"],
  x: ["short_video", "image", "text"],
  youtube: ["long_video"],
  youtube_shorts: ["short_video"],
};

export const ALL_PLATFORMS = Object.keys(CARRIES) as Platform[];

/**
 * In the order a plan reads them: what most campaigns lead with, first.
 * Bilingual because `render()` prints into the artist-facing summary, one language per reply.
 */
export const FORMATS: {
  key: Format;
  label: Record<Lang, string>;
  example: Record<Lang, string>;
}[] = [
  {
    key: "short_video",
    label: { en: "Short-form video (Reel / TikTok / Short)", fr: "Vidéo courte (Reel / TikTok / Short)" },
    example: { en: "a teaser", fr: "un teaser" },
  },
  {
    key: "long_video",
    label: { en: "Long-form video", fr: "Vidéo longue" },
    example: { en: "the music video", fr: "le vidéoclip" },
  },
  {
    key: "image",
    label: { en: "Static image post", fr: "Publication photo" },
    example: { en: "an artwork reveal", fr: "le dévoilement du visuel" },
  },
  {
    key: "story",
    label: { en: "Story (24h)", fr: "Story (24 h)" },
    example: { en: "a countdown", fr: "un compte à rebours" },
  },
  {
    key: "carousel",
    label: { en: "Carousel", fr: "Carrousel" },
    example: { en: "a behind-the-scenes set", fr: "une série des coulisses" },
  },
  {
    key: "text",
    label: { en: "Text-only post", fr: "Publication texte" },
    example: { en: "a thank-you note", fr: "un mot de remerciement" },
  },
];

export const isPlatform = (v: unknown): v is Platform =>
  typeof v === "string" && v in CARRIES;

/**
 * Drop platforms the matrix doesn't know. A campaign row is `text[]` and can
 * hold a typo or a retired platform.
 */
export const known = (platforms: readonly unknown[]): Platform[] =>
  platforms.filter(isPlatform);

/** The platforms, out of the selected set, that carry this format. */
export const groupFor = (selected: readonly Platform[], format: Format): Platform[] =>
  selected.filter((p) => CARRIES[p].includes(format));

/**
 * Every group that is non-empty for this selection. A format with no selected
 * platform is absent, so the plan never briefs an asset it cannot publish.
 */
export function groups(
  selected: readonly Platform[],
): { key: Format; label: Record<Lang, string>; example: Record<Lang, string>; platforms: Platform[] }[] {
  return FORMATS.map((f) => ({ ...f, platforms: groupFor(selected, f.key) })).filter(
    (g) => g.platforms.length > 0,
  );
}

/**
 * The check: is a post task's platform set the whole group? Null when it is,
 * else the correction. Run on the generated plan before anything is written.
 */
export function checkTask(
  selected: readonly Platform[],
  format: Format,
  platforms: readonly Platform[],
): string | null {
  const expected = groupFor(selected, format);
  const missing = expected.filter((p) => !platforms.includes(p));
  const extra = platforms.filter((p) => !expected.includes(p));
  if (!missing.length && !extra.length) return null;

  const parts: string[] = [];
  if (missing.length) parts.push(`missing ${missing.join(", ")}`);
  if (extra.length) parts.push(`${extra.join(", ")} cannot carry a ${format}`);
  return `a ${format} publishes on [${expected.join(", ")}] — ${parts.join("; ")}`;
}

/** The lines a plan is built against. Artist-facing: no schema vocabulary. */
export function render(selected: readonly Platform[], lang: Lang = "en"): string {
  const found = groups(selected);
  if (!found.length) {
    return lang === "fr"
      ? "Aucune plateforme choisie — il n'y a rien où publier."
      : "No platforms selected — nothing can be published.";
  }
  return found
    .map((g) =>
      lang === "fr"
        ? `- ${g.label.fr} : ensemble sur ${g.platforms.join(", ")} (ex. ${g.example.fr})`
        : `- ${g.label.en}: publishes on ${g.platforms.join(", ")} together (e.g. ${g.example.en})`,
    )
    .join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const lang: Lang = args.includes("--fr") ? "fr" : "en";
  const picked = known(args.filter((a) => !a.startsWith("--")));
  if (!picked.length) {
    console.error(`usage: format-groups.ts <platform…>   (${ALL_PLATFORMS.join(" | ")})`);
    process.exit(1);
  }
  console.log(render(picked, lang));
}
