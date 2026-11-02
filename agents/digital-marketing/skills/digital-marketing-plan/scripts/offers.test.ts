/**
 * The platform baseline, and the documents that have to agree with it.
 * Reads the real files, so a platform added to BASELINE and nowhere else fails here.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEPT = join(HERE, "..", "..", "..");

const read = (p: string) => readFileSync(join(DEPT, p), "utf8");

/** Parsed out of offers.ts itself — never a second copy of the list. */
const BASELINE: string[] = (() => {
  const src = read("skills/digital-marketing-plan/scripts/offers.ts");
  const m = src.match(/const BASELINE = \[([^\]]*)\] as const;/);
  if (!m) throw new Error("could not find BASELINE in offers.ts");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
})();

describe("the platform baseline", () => {
  test("is exactly the four the label pushes", () => {
    expect(BASELINE.sort()).toEqual(["facebook", "instagram", "tiktok", "youtube"]);
  });

  test("every baseline platform is a legal stored value", () => {
    // The six values artist.platforms and the intake both accept, plus Shorts.
    const questions = read("skills/digital-marketing-plan/scripts/questions.ts");
    const opts = questions.match(
      /options: \["instagram", "tiktok", "facebook", "x", "youtube", "youtube_shorts"\]/,
    );
    expect(opts).not.toBeNull();
    for (const p of BASELINE) expect(opts![0]).toContain(`"${p}"`);
  });

  test("x is deliberately NOT in the baseline", () => {
    // A real option, but the label does not push artists onto it.
    expect(BASELINE).not.toContain("x");
  });

  test("youtube_shorts is derived, not listed", () => {
    // Shorts is implied by a YouTube channel; listing it twice lets them drift.
    expect(BASELINE).not.toContain("youtube_shorts");
    expect(read("skills/digital-marketing-plan/scripts/offers.ts")).toContain(
      'have.add("youtube_shorts")',
    );
  });

  /**
   * Four documents state the baseline in prose; they must match BASELINE.
   */
  test("every document that states the baseline names all four", () => {
    const surfaces = [
      "AGENT.md",
      "knowledge/marketing-fundamentals.md",
      "skills/digital-marketing-plan/SKILL.md",
      "skills/digital-marketing-plan/scripts/questions.ts",
    ];
    const missing: string[] = [];

    for (const f of surfaces) {
      const text = read(f).toLowerCase();
      for (const p of BASELINE) {
        if (!text.includes(p)) missing.push(`${f} never names ${p}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test("offers.ts never writes to artist.platforms", () => {
    // The baseline is what we plan for. What the artist has is written only by
    // `houselabel profile`, and agents/platforms reads it as real accounts.
    const src = read("skills/digital-marketing-plan/scripts/offers.ts");
    expect(src).not.toMatch(/insert\s+into\s+artist\.platforms/i);
    expect(src).not.toMatch(/update\s+artist\.platforms/i);
  });

  test("the platforms question asks to remove, not to fill in", () => {
    // With a baseline there is never an empty list to fill, so wording it as
    // "which platforms are we posting on?" would ask for something already known.
    const q = read("skills/digital-marketing-plan/scripts/questions.ts");
    expect(q).not.toContain("I don't have any social accounts on file for you yet");
    expect(q).toContain("Anything there you won't post to?");
  });

  test("the department records a refused platform", () => {
    // Assuming four platforms is only defensible if "no" sticks.
    expect(read("AGENT.md")).toMatch(/refus/i);
  });
});
