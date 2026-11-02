/**
 * Hunter: quote first, spend only on a quote, save to the artist's side.
 * No network or database: Hunter, the catalog and artist tables are recorders.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listDepartments, ROOT } from "../agent";
import { parseDoc, parseServices } from "../frontmatter";
import type { HunterCall, HunterEndpoint } from "./client";
import { creditsLeft } from "./index";
import { buildHunterTools, domainOf, isNamedWorkAddress, NOT_CONNECTED, peopleFrom, planLookups, type OutletRow } from "./tools";

/** Catalog rows shaped like catalog.press_outlets (media, no people) and the artist's own typed-in names. */
const CATALOG: Record<string, Record<string, string | null>> = {
  "cult-mtl": { slug: "cult-mtl", outlet: "Cult MTL", desk_email: null, website: "https://cultmtl.com", outlet_type: "newspaper", city: "Montréal", market: "quebec" },
  "pan-m-360": { slug: "pan-m-360", outlet: "PAN M 360", desk_email: null, website: "https://panm360.com", outlet_type: "webzine", city: "Montréal", market: "quebec" },
  "canal-auditif": { slug: "canal-auditif", outlet: "Le Canal Auditif", desk_email: "info@lecanalauditif.ca", website: null, outlet_type: "blog", city: "Montréal", market: "quebec" },
  "no-site": { slug: "no-site", outlet: "Nowhere", desk_email: null, website: null, outlet_type: "blog", city: null, market: "quebec" },
};
/** A station row, shaped like catalog.promotion_radio_stations. */
const STATIONS: Record<string, Record<string, string | null>> = {
  "cism": { slug: "cism", call_sign: "CISM", name: "CISM 89.3", submission_email: "programmation@cism893.ca", website: "www.cism893.ca", region: "QC", city: "Montréal" },
};

/** A Hunter account reply, trimmed: 50 searches, 8 used. */
const ACCOUNT = { email: "artist@example.com", requests: { searches: { used: 8, available: 50 } } };

function fakes(opts: { saved?: Record<string, unknown>[] } = {}) {
  const hunter: { endpoint: HunterEndpoint; params: Record<string, string> }[] = [];
  const written: Record<string, unknown>[] = [];
  const call: HunterCall = async (endpoint, params) => {
    hunter.push({ endpoint, params });
    if (endpoint === "account") return ACCOUNT;
    if (endpoint === "email-finder") return { email: "alain@panm360.com", first_name: "Alain", last_name: "Brunet", score: 94, verification: { status: "valid" } };
    return {
      emails: [
        { value: "md@cism893.ca", first_name: null, last_name: null, confidence: 80 },
        { value: "lea.fortin@cism893.ca", first_name: "Lea", last_name: "Fortin", position: "Directrice musicale", confidence: 91, verification: { status: "valid" } },
      ],
    };
  };
  const session = {
    catalog: async () => ({
      info: {} as never,
      query: async (table: string, filter: { slug?: string }) => {
        const rows = table === "press_outlets" ? CATALOG : table === "promotion_radio_stations" ? STATIONS : {};
        return filter.slug && rows[filter.slug] ? [rows[filter.slug]] : [];
      },
      close: async () => {},
    }),
    artist: async () => ({
      query: async () => opts.saved ?? [],
      upsert: async (_t: string, row: Record<string, unknown>) => (written.push(row), row),
    }),
    close: async () => {},
  } as never;
  return { hunter, written, session, resolve: async () => call };
}

const dept = (services: string[], artist: string[] = ["contacts"]) =>
  ({ slug: "press", services, tables: { catalog: [], artist } }) as never;

const run = (t: unknown, input: unknown) =>
  (t as { execute: (i: unknown, o: unknown) => Promise<string> }).execute(input, { toolCallId: "t", messages: [] });

describe("buildHunterTools", () => {
  test("a department that declared nothing gets nothing", () => {
    expect(buildHunterTools(dept([]), {} as never)).toEqual({});
  });

  test("hunter without artist.contacts gets nothing — there is nowhere to save", () => {
    expect(buildHunterTools(dept(["hunter"], []), {} as never)).toEqual({});
  });

  test("hunter + artist.contacts gets exactly the quote and the lookup", () => {
    expect(Object.keys(buildHunterTools(dept(["hunter"]), {} as never)).sort()).toEqual([
      "hunter_find_contacts",
      "hunter_quote",
    ]);
  });

  test("a quote spends nothing — it only asks Hunter for the account", async () => {
    const f = fakes();
    const tools = buildHunterTools(dept(["hunter"]), f.session, f.resolve);
    const out = await run(tools.hunter_quote, { slugs: ["cult-mtl", "pan-m-360", "cism", "no-site", "nope"] });
    expect(f.hunter.map((c) => c.endpoint)).toEqual(["account"]);
    expect(out).toContain("3 lookups, at most 3 credits");
    expect(out).toContain("42 left this month");
    expect(out).toContain("not in the catalog: nope");
    expect(f.written).toEqual([]);
  });

  test("the lookup refuses anything but a quote id", async () => {
    const f = fakes();
    const tools = buildHunterTools(dept(["hunter"]), f.session, f.resolve);
    expect(await run(tools.hunter_find_contacts, { quote_id: "q1" })).toContain("Call hunter_quote first");
    expect(f.hunter).toEqual([]);
  });

  test("a quote runs once, exactly as quoted — a retry cannot spend twice", async () => {
    const f = fakes();
    const tools = buildHunterTools(dept(["hunter"]), f.session, f.resolve);
    await run(tools.hunter_quote, { slugs: ["pan-m-360", "cism", "cult-mtl"] });
    const out = await run(tools.hunter_find_contacts, { quote_id: "q1" });

    const spent = f.hunter.filter((c) => c.endpoint !== "account");
    // The catalog names no people, so every lookup is a domain search — the
    // email-finder path exists for a name the artist typed, never for a row.
    expect(spent).toEqual([
      { endpoint: "domain-search", params: { domain: "panm360.com", type: "personal", limit: "5" } },
      { endpoint: "domain-search", params: { domain: "cism893.ca", type: "personal", limit: "5" } },
      { endpoint: "domain-search", params: { domain: "cultmtl.com", type: "personal", limit: "5" } },
    ]);
    expect(out).toContain("1 contact saved");

    expect(await run(tools.hunter_find_contacts, { quote_id: "q1" })).toContain("no quote q1");
    expect(f.hunter.filter((c) => c.endpoint !== "account")).toHaveLength(3);
  });

  test("people are saved to the artist's side, desk addresses dropped", async () => {
    const f = fakes();
    const tools = buildHunterTools(dept(["hunter"]), f.session, f.resolve);
    await run(tools.hunter_quote, { slugs: ["cism"] });
    await run(tools.hunter_find_contacts, { quote_id: "q1" });
    expect(f.written).toEqual([
      {
        kind: "radio", catalog_slug: "cism", outlet: "CISM 89.3", domain: "cism893.ca", region: "Montréal",
        name: "Lea Fortin", position: "Directrice musicale", email: "lea.fortin@cism893.ca",
        confidence: 91, verification: "valid", source_url: null, source: "hunter",
      },
    ]);
  });

  test("an outlet already looked up is skipped — the artist never pays twice", async () => {
    const f = fakes({ saved: [{ catalog_slug: "cism" }] });
    const tools = buildHunterTools(dept(["hunter"]), f.session, f.resolve);
    const out = await run(tools.hunter_quote, { slugs: ["cism"] });
    expect(out).toContain("already found");
    expect(out).toContain("do not call hunter_find_contacts");
  });

  test("no key is a sentence the artist can act on, not a crash", async () => {
    const tools = buildHunterTools(dept(["hunter"]), {} as never, async () => null);
    expect(await run(tools.hunter_quote, { slugs: ["cism"] })).toBe(NOT_CONNECTED);
  });
});

describe("planLookups", () => {
  const row = (r: Partial<OutletRow>): OutletRow =>
    ({ slug: "x", table: "press_outlets", name: null, outlet: "X", email: null, website: null, region: null, kind: "press", ...r });

  test("the rule, one case each", () => {
    const plan = planLookups(
      [
        row({ slug: "saved", website: "a.ca" }),
        row({ slug: "personal", email: "jane.doe@a.ca" }),
        row({ slug: "nothing" }),
        row({ slug: "named", name: "Alain Brunet", website: "panm360.com" }),
        row({ slug: "desk", name: "Rédaction", email: "info@ledevoir.com" }),
      ],
      new Set(["saved"]),
    );
    expect(plan.map((l) => l.method)).toEqual(["skip", "skip", "skip", "email-finder", "domain-search"]);
  });

  test("domains come from the website, else from a non-webmail email", () => {
    expect(domainOf({ website: "https://www.ledevoir.com/culture", email: null })).toBe("ledevoir.com");
    expect(domainOf({ website: null, email: "info@lecanalauditif.ca" })).toBe("lecanalauditif.ca");
    expect(domainOf({ website: null, email: "someblog@gmail.com" })).toBeNull();
  });

  test("only a named person's work address counts", () => {
    expect(isNamedWorkAddress("info@cism893.ca")).toBe(false);
    expect(isNamedWorkAddress("programmation@cism893.ca")).toBe(false);
    expect(isNamedWorkAddress("lea.fortin@gmail.com")).toBe(false);
    expect(isNamedWorkAddress("alex.martin@cultmtl.com")).toBe(true);
  });

  test("a personal address Hunter returns is never kept — the law, in code", () => {
    const people = peopleFrom(
      "domain-search",
      {
        emails: [
          { value: "lea.fortin@gmail.com", first_name: "Lea" },
          { value: "julie@other-station.ca", first_name: "Lea" },
          { value: "lea.fortin@cism893.ca", first_name: "Lea", sources: [{ domain: "cism893.ca", uri: "https://cism893.ca/equipe" }] },
        ],
      },
      "cism893.ca",
    );
    expect(people.map((p) => [p.email, p.sourceUrl])).toEqual([["lea.fortin@cism893.ca", "https://cism893.ca/equipe"]]);
  });
});

describe("creditsLeft", () => {
  test("searches available minus used; null when Hunter changes the shape", () => {
    expect(creditsLeft(ACCOUNT)).toBe(42);
    expect(creditsLeft({})).toBeNull();
  });
});

describe("hunter across the roster", () => {
  test("press and promotion declare it, and every department that does can save what it finds", async () => {
    const declared: string[] = [];
    for (const name of await listDepartments()) {
      const { front } = parseDoc(readFileSync(join(ROOT, "agents", name, "AGENT.md"), "utf8"));
      if (!parseServices(front.services).includes("hunter")) continue;
      declared.push(name);
      expect(`${name}: ${readFileSync(join(ROOT, "agents", name, "AGENT.md"), "utf8").includes("artist.contacts")}`).toBe(`${name}: true`);
    }
    expect(declared.sort()).toEqual(["press", "promotion"]);
  });
});

describe("outreach law across the roster", () => {
  // A department that can open an email draft writes outreach, and outreach
  // carries the footer and the "stop" list. A new department with `gmail`
  // fails here until it obeys agents/press/knowledge/outreach-legal.md.
  test("every department with gmail links outreach-legal.md and can record a \"stop\"", async () => {
    const writers: string[] = [];
    for (const name of await listDepartments()) {
      const doc = readFileSync(join(ROOT, "agents", name, "AGENT.md"), "utf8");
      if (!/^google:.*\bgmail\b/m.test(doc)) continue;
      writers.push(name);
      expect(`${name}: ${doc.includes("outreach-legal.md")}`).toBe(`${name}: true`);
      expect(`${name}: ${doc.includes("artist.contacts")}`).toBe(`${name}: true`);
    }
    expect(writers.sort()).toEqual(["press", "promotion"]);
  });
});
