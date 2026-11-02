/**
 * Golden-file tests for the deterministic half of the press crawl: no key it
 * did not learn, no person's address, and a mis-scoped source throws.
 */
import { describe, expect, test } from "bun:test";
import { crawler, __test } from "./crawl";
import type { SourceRow } from "../crawl/types";

const source = (over: Partial<SourceRow> = {}): SourceRow => ({
  id: "test-source",
  topic: "press",
  url: "https://example.ca/medias/",
  kind: "index",
  scope: { outlet_type: "webzine", market: "quebec", language: "fr", city: "Montréal" },
  extraction: {},
  status: "active",
  consecutive_failures: 0,
  cadence_days: 30,
  ...over,
});

const FULL = {
  outlet: "Le Canal Auditif", website: "https://lecanalauditif.ca",
  submission_url: "https://lecanalauditif.ca/contact/", desk_email: "info@lecanalauditif.ca",
  submission_method: "Envoyez un lien d'écoute privé par courriel. Pas de pièces jointes.",
  genre_fit: "indie rock, electronic, hip hop",
};

describe("press mapper", () => {
  test("maps a fully stated outlet onto every column it covers", () => {
    const [row] = crawler.toRows({ outlets: [FULL] }, source(), "fetch");
    expect(row).toMatchObject({
      outlet: "Le Canal Auditif", outlet_type: "webzine", market: "quebec", country: "CA",
      city: "Montréal", language: "fr",
      website: "https://lecanalauditif.ca", submission_url: "https://lecanalauditif.ca/contact/",
      desk_email: "info@lecanalauditif.ca",
      submission_method: "Envoyez un lien d'écoute privé par courriel. Pas de pièces jointes.",
      genre_fit: ["indie_rock", "electronic", "hip_hop"],
      source: "crawl_tinyfish", source_url: "https://example.ca/medias/",
    });
    expect(row).not.toHaveProperty("name");
  });

  test("the market decides the country", () => {
    const us = crawler.toRows({ outlets: [{ outlet: "X" }] },
      source({ scope: { outlet_type: "blog", market: "us" } }), "fetch")[0]!;
    const ca = crawler.toRows({ outlets: [{ outlet: "X" }] },
      source({ scope: { outlet_type: "blog", market: "canada" } }), "fetch")[0]!;
    expect(us.country).toBe("US");
    expect(ca.country).toBe("CA");
  });

  test("a person's address never reaches the row", () => {
    for (const personal of ["jane.doe@ledevoir.com", "jdoe@gmail.com", "marie@videotron.ca"]) {
      const [row] = crawler.toRows({ outlets: [{ outlet: "X", desk_email: personal }] }, source(), "fetch");
      expect(row).not.toHaveProperty("desk_email");
    }
    for (const desk of ["info@ledevoir.com", "Musique@CISM893.ca", "tips.music@pitchfork.com"]) {
      const [row] = crawler.toRows({ outlets: [{ outlet: "X", desk_email: desk }] }, source(), "fetch");
      expect(row.desk_email).toBe(desk.toLowerCase());
    }
  });

  // agents/press routes on this; it must keep the outlet's own instruction.

  test("submission_method keeps the page's own words", () => {
    const [row] = crawler.toRows(
      { outlets: [{ outlet: "X", submission_method: "Private SoundCloud link only — no attachments" }] },
      source(), "fetch");
    expect(row.submission_method).toBe("Private SoundCloud link only — no attachments");
  });

  test("does not write a key it did not learn — a null would erase a thicker source", () => {
    const [row] = crawler.toRows(
      { outlets: [{ outlet: "Le Devoir", website: null, submission_url: null, desk_email: null,
        submission_method: null, genre_fit: null }] },
      source({ scope: { outlet_type: "newspaper", market: "quebec" } }), "fetch");
    for (const absent of ["website", "submission_url", "desk_email", "submission_method", "tier",
      "genre_fit", "language", "city"]) {
      expect(row).not.toHaveProperty(absent);
    }
    expect(row).toMatchObject({ outlet: "Le Devoir", outlet_type: "newspaper", market: "quebec" });
  });

  test("a discovery index writes nothing", () => {
    const rows = crawler.toRows(
      { outlets: [{ outlet: "Exclaim!" }, { outlet: "CBC Music" }] },
      source({ scope: { outlet_type: "magazine", market: "canada", discovery_only: true } }), "fetch");
    expect(rows).toEqual([]);
  });

  test("a column with a database default is left to the database", () => {
    const [a] = crawler.toRows({ outlets: [{ outlet: "X" }] }, source(), "fetch");
    expect(a).not.toHaveProperty("genre_fit");
    const [b] = crawler.toRows({ outlets: [{ outlet: "X", genre_fit: "polka" }] }, source(), "fetch");
    expect(b.genre_fit).toEqual([]);
    const [c] = crawler.toRows({ outlets: [{ outlet: "X" }] },
      source({ scope: { outlet_type: "blog", market: "canada" } }), "fetch");
    expect(c).not.toHaveProperty("language");
    const [d] = crawler.toRows({ outlets: [{ outlet: "X" }] },
      source({ scope: { outlet_type: "blog", market: "canada", language: "FR" } }), "fetch");
    expect(d.language).toBe("fr");
    const [e] = crawler.toRows({ outlets: [{ outlet: "X" }] },
      source({ scope: { outlet_type: "blog", market: "canada", tier: 1 } }), "fetch");
    expect(e.tier).toBe(1);
  });

  test("an outlet that slugifies to nothing is skipped", () => {
    for (const bad of ["—", "!!!", "  ...  ", "•"]) {
      expect(crawler.toRows({ outlets: [{ outlet: bad }] }, source(), "fetch")).toEqual([]);
    }
    expect(__test.slugSurvives("Clin d'œil")).toBe(true);
    expect(__test.slugSurvives("Š")).toBe(false);
  });

  test("a mis-scoped source throws", () => {
    const cases: Record<string, unknown>[] = [
      { market: "quebec" },                                   // no outlet_type
      { outlet_type: "webzine" },                             // no market
      { outlet_type: "radio", market: "quebec" },             // not an outlet type
      { outlet_type: "blog", market: "france" },              // not a market
      { outlet_type: "blog", market: "us", language: "de" },  // not a language
    ];
    for (const scope of cases) {
      expect(() => crawler.toRows({ outlets: [{ outlet: "X" }] }, source({ scope }), "fetch")).toThrow();
    }
  });

  test("outlets that is not an array is a config error, not an empty page", () => {
    expect(() => crawler.toRows({ outlets: "nope" }, source(), "fetch")).toThrow();
    expect(crawler.toRows({ outlets: [] }, source(), "fetch")).toEqual([]);
    expect(crawler.toRows({}, source(), "fetch")).toEqual([]);
  });

  test("the crawler targets press_outlets keyed on the outlet name", () => {
    expect(crawler.table).toBe("catalog.press_outlets");
    expect(crawler.conflict).toEqual(["outlet"]);
    expect(crawler.identity).toBe("slug");
  });
});
