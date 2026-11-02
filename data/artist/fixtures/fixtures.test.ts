/**
 * The fixture has to stay loadable as the schema moves.
 *
 * Checks the shape against the profile form, so a renamed column fails here
 * instead of silently leaving a key nothing reads.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { FIXTURES, odileRay } from "./odile-ray";
import { readMembers } from "../members";
import { seedDraft, visibleQuestionIds } from "../../../engine/profile";

describe("odile-ray", () => {
  test("answers every question the form asks", () => {
    const draft = seedDraft(odileRay.profile, [], "en");
    const asked = visibleQuestionIds(draft);
    // `links` is the one question she legitimately leaves empty.
    for (const id of asked.filter((q) => q !== "links")) {
      const a = draft.answers as Record<string, unknown>;
      const value = {
        name: a.artist_name, type: a.artist_type, project: a.project_description,
        languages: a.languages, country: a.country, region: a.region, city: a.city,
        citizenship: a.citizenship, markets: a.target_markets, genres: a.genres,
        disciplines: a.disciplines, stage: a.career_stage,
      }[id];
      expect(Array.isArray(value) ? value.length : value, `${id} is unanswered`).toBeTruthy();
    }
  });

  test("she is solo, so the members question does not apply to her", () => {
    expect(odileRay.profile.artist_type).toBe("solo");
    expect(readMembers(odileRay.profile.members)).toEqual([]);
    expect(visibleQuestionIds(seedDraft(odileRay.profile, [], "en"))).not.toContain("members");
  });

  // Lives in one region, sells in three markets (target_markets).
  test("she works three markets from one province", () => {
    expect(odileRay.profile.region).toBe("QC");
    expect(odileRay.profile.target_markets).toEqual(["QC", "CA", "US"]);
  });

  test("every fixture names the database it belongs in", () => {
    for (const [key, f] of Object.entries(FIXTURES)) {
      expect(f.slug, `${key} has no slug`).toMatch(/^[a-z0-9_]+$/);
      expect(f.profile.id).toBe(1);
    }
  });
});
