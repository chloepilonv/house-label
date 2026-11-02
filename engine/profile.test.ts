/**
 * citizenshipDefault and friends: `[]` means both "not answered" and the
 * "prefer not to say" option, so a new profile must not default to it.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { citizenshipDefault, renderReview, seedDraft, visibleQuestionIds, writeIn } from "./profile";
import { strings } from "./strings";

describe("citizenshipDefault", () => {
  test("a brand-new profile gets no default, so Enter picks the first option", () => {
    expect(citizenshipDefault(null, [])).toBeUndefined();
  });

  test("an existing empty answer stays 'neither', not silently upgraded", () => {
    expect(citizenshipDefault({ id: 1 }, [])).toEqual([]);
  });

  test("an existing answer comes back selected", () => {
    expect(citizenshipDefault({ id: 1 }, ["CA"])).toEqual(["CA"]);
  });

  // @inquirer matches a default by identity, so the returned array has to be
  // the option's own array, not an equal one.
  test("dual citizenship matches in either order", () => {
    const both = citizenshipDefault({ id: 1 }, ["US", "CA"]);
    expect(both).toEqual(["CA", "US"]);
    expect(citizenshipDefault({ id: 1 }, ["CA", "US"])).toBe(both!);
  });

  test("a value no option covers falls through to no default", () => {
    expect(citizenshipDefault({ id: 1 }, ["FR"])).toBeUndefined();
  });
});

describe("writeIn", () => {
  // The case that motivated deriving it: init ran in English, artist works in French.
  test("prefers the language they are reading, when they work in it", () => {
    expect(writeIn(["en", "fr"], "en")).toBe("en");
    expect(writeIn(["en", "fr"], "fr")).toBe("fr");
  });

  test("falls back to what they work in, never a language they didn't choose", () => {
    expect(writeIn(["fr"], "en")).toBe("fr");
    expect(writeIn(["en"], "fr")).toBe("en");
  });

  test("no languages at all keeps the current locale", () => {
    expect(writeIn([], "fr")).toBe("fr");
  });
});

describe("seedDraft", () => {
  test("a brand-new profile starts empty, with the CLI language pre-picked", () => {
    const d = seedDraft(null, [], "fr");
    expect(d.answers.artist_name).toBe("");
    expect(d.answers.members).toEqual([]);
    expect(d.answers.languages).toEqual(["fr"]);
    expect(d.answers.preferred_locale).toBe("fr");
    expect(d.links).toEqual({ keep: [], drop: [] });
  });

  test("an existing row comes back whole, jsonb members included", () => {
    const d = seedDraft(
      {
        artist_name: "Léonie",
        artist_type: "band",
        members: '[{"name":"Ali","role":"drums"}]',
        languages: ["fr", "en"],
        preferred_locale: "fr",
        target_markets: ["QC", "US"],
        genres: ["pop"],
      },
      [{ platform: "spotify", url: "https://open.spotify.com/artist/x" }],
      "en",
    );
    expect(d.answers.artist_name).toBe("Léonie");
    expect(d.answers.members).toEqual([{ name: "Ali", role: "drums" }]);
    expect(d.answers.preferred_locale).toBe("fr");
    expect(d.answers.target_markets).toEqual(["QC", "US"]);
    expect(d.links.keep).toHaveLength(1);
  });
});

describe("renderReview", () => {
  const ctx = (draft: ReturnType<typeof seedDraft>) => ({
    draft, existing: null, locale: "en" as const, t: strings("en"),
  });

  test("numbers the questions and shows values in the artist's words, not enum values", () => {
    const d = seedDraft(
      { artist_name: "Léonie", artist_type: "band", career_stage: "mid-career", country: "CA", region: "QC" },
      [], "en",
    );
    const out = renderReview(ctx(d));
    expect(out).toContain("Léonie");
  // The review shows labels, not stored values like 'mid-career' or 'QC'.
    expect(out).toContain("Touring and getting some press locally");
    expect(out).toContain("Quebec");
    expect(out).not.toContain("mid-career");
  });

  test("a solo artist is not asked about members, so the list has one fewer line", () => {
    const band = renderReview(ctx(seedDraft({ artist_type: "band" }, [], "en")));
    const solo = renderReview(ctx(seedDraft({ artist_type: "solo" }, [], "en")));
    expect(band).toContain("Members");
    expect(solo).not.toContain("Members");
    expect(solo.split("\n")).toHaveLength(band.split("\n").length - 1);
  });

  test("an unanswered question says so instead of showing a blank", () => {
    expect(renderReview(ctx(seedDraft(null, [], "en")))).toContain("(not answered)");
  });
});

describe("the first pass asks each question once", () => {
  // `country` invalidates `region`; repairs must not run on the first pass,
  // or region is asked twice.
  test("no id repeats, for a band or a solo artist", () => {
    for (const artist_type of ["band", "solo"]) {
      const ids = visibleQuestionIds(seedDraft({ artist_type }, [], "en"));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test("region comes after country, so its list of choices exists", () => {
    const ids = visibleQuestionIds(seedDraft(null, [], "en"));
    expect(ids.indexOf("region")).toBeGreaterThan(ids.indexOf("country"));
  });

  test("every question a review number can land on is one the form asks", () => {
    const ids = visibleQuestionIds(seedDraft({ artist_type: "band" }, [], "en"));
    expect(ids).toEqual([
      "name", "type", "members", "project", "languages",
      "country", "region", "city", "citizenship", "markets",
      "genres", "disciplines", "stage", "links",
    ]);
  });
});
