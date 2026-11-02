/**
 * Invariants of help-centres.ts, no database needed: no company in both maps,
 * and no deep article in the root column.
 */
import { describe, expect, test } from "bun:test";
import { HELP_CENTRES, HELP_CENTRES_VERIFIED, NO_HELP_CENTRE } from "./help-centres";

describe("distribution help centres", () => {
  test("no company is both published and unpublished", () => {
    const both = Object.keys(HELP_CENTRES).filter((id) => id in NO_HELP_CENTRE);
    expect(both).toEqual([]);
  });

  test("every url is an https root, never a deep article", () => {
    for (const [id, url] of Object.entries(HELP_CENTRES)) {
      expect(url, id).toStartWith("https://");
      // Deep articles belong in `spec_url`.
      expect(url, id).not.toMatch(/\/(articles|kb-article)\//);
    }
  });

  test("every absence carries its reason", () => {
    for (const [id, why] of Object.entries(NO_HELP_CENTRE)) {
      // The reason is the evidence behind `not_stated`.
      expect(why.length, id).toBeGreaterThan(40);
    }
  });

  test("the verification date is a real date, not a placeholder", () => {
    expect(HELP_CENTRES_VERIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(HELP_CENTRES_VERIFIED))).toBe(false);
  });

  test("the mainstream artist-facing names all have one", () => {
    // The companies artists name most; losing one means answering from memory.
    for (const id of ["cd-baby", "distrokid", "tunecore", "amuse", "landr", "too-lost", "unitedmasters"]) {
      expect(HELP_CENTRES[id], id).toBeTruthy();
    }
  });
});
