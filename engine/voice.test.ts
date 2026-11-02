/**
 * The voice file parser, the only judgment in `houselabel voice`. A heading
 * typo must not silently swallow the samples.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { parseVoiceFile } from "./voice";

const FILE = `# Voice
- Opens with the first name.
- Signs "à bientôt".

## Samples

### fr · to a booker
Salut Marc,
je t'écris pour le 14.

### en - to a curator
Hi Sam, quick one.

### unlabelled

`;

describe("parseVoiceFile", () => {
  test("the guide is everything above ## Samples, without the title", () => {
    const { guide } = parseVoiceFile(FILE);
    expect(guide).toBe('- Opens with the first name.\n- Signs "à bientôt".');
  });

  test("each ### heading is one sample: language, context, verbatim text", () => {
    const { samples } = parseVoiceFile(FILE);
    expect(samples).toHaveLength(2);
    expect(samples[0]).toEqual({ lang: "fr", context: "to a booker", text: "Salut Marc,\nje t'écris pour le 14." });
    expect(samples[1]).toEqual({ lang: "en", context: "to a curator", text: "Hi Sam, quick one." });
  });

  test("a heading with no text is dropped, never saved as an empty quote", () => {
    expect(parseVoiceFile(FILE).samples.some((s) => s.lang === "unlabelled")).toBe(false);
  });

  test("no ## Samples section means a guide and no samples, not a crash", () => {
    expect(parseVoiceFile("# Voice\n- short.")).toEqual({ guide: "- short.", samples: [] });
  });

  test("an empty file has no guide, which the command refuses to save", () => {
    expect(parseVoiceFile("").guide).toBe("");
  });
});
