/**
 * What the priced plan must never do.
 *
 *   bun test agents/label-manager
 *
 * Every price cites a source, or the step says why it has none.
 */
import { describe, expect, test } from "bun:test";
import {
  COSTS, COST_SOURCES, PRICES, budgetFor, budgetWarnings, money, settle, trackCountFor, type Money,
} from "./costs";
import { MILESTONES, OWNER_LABEL, SOURCES, anchorsFor, resolve, type Scope } from "./milestones";

const EP: Scope = {
  projectType: "ep",
  branches: ["creation", "rights", "distribution", "presskit", "press", "campaign", "post_release"],
  physical: "none",
  recordingStatus: "tracking",
  markets: ["quebec", "canada"],
  trackCount: 5,
};
const STREET = "2026-11-13";
const TODAY = "2026-09-06";
const label = (o: string | null, lang: "en" | "fr") => OWNER_LABEL[o ?? "you"][lang];
const sum = (xs: Money[], c: "CAD" | "USD") => settle(xs, c)[c] ?? 0;

describe("the price catalog", () => {
  test("every price cites a source with a URL or a repo path, and a verified date", () => {
    for (const [k, p] of Object.entries(PRICES)) {
      const src = COST_SOURCES[p.source];
      expect(src, k).toBeDefined();
      expect(src.url || src.where, k).toBeTruthy();
      expect(src.verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.amount).toBeGreaterThanOrEqual(0);
      expect(p.unit.length).toBeGreaterThan(5);
    }
  });

  test("cost sources are in the one registry the page renders", () => {
    for (const id of Object.keys(COST_SOURCES)) expect(SOURCES[id]).toBeDefined();
  });

  test("every cost line belongs to a real milestone and cites a resolvable source", () => {
    const keys = new Set(MILESTONES.map((m) => m.key));
    const a = anchorsFor(EP);
    for (const [key, fn] of Object.entries(COSTS)) {
      expect(keys.has(key), key).toBe(true);
      const line = fn({ ...EP, markets: ["quebec", "canada", "usa"] }, a);
      expect(line.sources.length, key).toBeGreaterThan(0);
      for (const id of line.sources) expect(SOURCES[id], `${key} → ${id}`).toBeDefined();
      expect(line.basis.en.length).toBeGreaterThan(20);
      expect(line.basis.fr.length).toBeGreaterThan(20);
    }
  });

  test("a line with no number says why — never a silent blank", () => {
    const a = anchorsFor(EP);
    for (const [key, fn] of Object.entries(COSTS)) {
      const line = fn({ ...EP, physical: "vinyl", covers: true }, a);
      if (!line.floor.length) expect(line.noPriceReason, key).toBeDefined();
    }
  });

  test("the tiers never run backwards: bare ≤ decent ≤ full, per currency", () => {
    const a = anchorsFor(EP);
    for (const scope of [EP, { ...EP, markets: ["usa"] }, { ...EP, markets: ["canada"] }]) {
      for (const [key, fn] of Object.entries(COSTS)) {
        const line = fn(scope, a);
        for (const c of ["CAD", "USD"] as const) {
          expect(sum(line.aim, c), `${key} ${c}`).toBeGreaterThanOrEqual(sum(line.floor, c));
          expect(sum(line.full, c), `${key} ${c}`).toBeGreaterThanOrEqual(sum(line.aim, c));
        }
      }
    }
  });
});

describe("what the plan prices", () => {
  test("is deterministic — same scope, same money", () => {
    const a = JSON.stringify(resolve(EP, STREET, TODAY).budget);
    const b = JSON.stringify(resolve(EP, STREET, TODAY).budget);
    expect(a).toBe(b);
  });

  test("prices only the steps the scope kept", () => {
    const single = resolve({ ...EP, projectType: "single", branches: ["creation", "distribution"] }, STREET, TODAY);
    const keys = single.budget.lines.map((l) => l.key);
    expect(keys).not.toContain("radio_serviced");
    expect(keys).not.toContain("campaign_live");
    expect(keys).toContain("distributor_chosen");
  });

  test("radio in Quebec is !earshot at the floor and 45tours for a decent run", () => {
    const line = resolve(EP, STREET, TODAY).budget.lines.find((l) => l.key === "radio_serviced")!;
    expect(sum(line.floor, "CAD")).toBe(35); // 5 songs × $7
    expect(sum(line.aim, "CAD")).toBe(335); // 45tours EP $300 + !earshot for English Canada
    expect(line.sources).toContain("45tours");
  });

  test("a band from Oregon is never offered !earshot or 45tours", () => {
    const line = resolve({ ...EP, markets: ["usa"] }, STREET, TODAY).budget.lines.find((l) => l.key === "radio_serviced")!;
    expect(line.sources).not.toContain("45tours");
    expect(line.sources).not.toContain("earshot-cost");
    expect(line.floor.every((x) => x.currency === "USD")).toBe(true);
  });

  test("the song count comes from the catalog, and the fallback prints ≈", () => {
    expect(trackCountFor({ ...EP, trackCount: 7 })).toEqual({ n: 7, known: true });
    expect(trackCountFor({ ...EP, trackCount: null })).toEqual({ n: 5, known: false });
    expect(trackCountFor({ ...EP, projectType: "single", trackCount: null })).toEqual({ n: 1, known: true });
    const unknown = resolve({ ...EP, trackCount: null }, STREET, TODAY).budget.lines.find((l) => l.key === "radio_serviced")!;
    expect(unknown.sourced).toBe(false);
  });

  test("the marketing window is priced off the campaign anchor, not a fixed number", () => {
    const a = anchorsFor(EP);
    const line = COSTS.campaign_live(EP, a);
    expect(sum(line.aim, "CAD")).toBe((14 - a.campaign) * PRICES.meta_day_low.amount);
  });

  test("a USD line is never added into a CAD total", () => {
    const v = resolve(EP, STREET, TODAY).budget;
    expect(v.currency).toBe("CAD");
    expect(v.tiers.full.USD).toBeGreaterThan(0);
    expect(v.tiers.full.CAD).toBe(1005); // 300 + 35 + 420 + 250 — no Yangaroo, no SubmitHub in it
  });

  test("`local` reads as the budget's currency, and as USD for a US artist with none", () => {
    expect(resolve({ ...EP, budget: { amount: 100, currency: "USD" } }, STREET, TODAY).budget.currency).toBe("USD");
    expect(resolve({ ...EP, markets: ["usa"] }, STREET, TODAY).budget.currency).toBe("USD");
    expect(resolve(EP, STREET, TODAY).budget.currency).toBe("CAD");
  });
});

describe("the budget verdict", () => {
  const a = anchorsFor(EP);
  const ms = resolve(EP, STREET, TODAY).milestones;

  test("no budget is not refused — it is the three tiers and a question", () => {
    const v = budgetFor({ ...EP, budget: null }, a, ms);
    expect(v.verdict).toBe("no_budget");
    expect(v.envelopes).toEqual([]);
    const w = budgetWarnings(v, label);
    expect(w[0].kind).toBe("no_budget");
    expect(w[0].text.en).toContain("Bare is $35 CAD");
    expect(w[0].text.en).toContain("decent $545 CAD");
  });

  test("$50 buys the bare tier and says what decent would take", () => {
    const v = budgetFor({ ...EP, budget: { amount: 50, currency: "CAD" } }, a, ms);
    expect(v.verdict).toBe("between");
    const w = budgetWarnings(v, label).find((x) => x.kind === "under_aim")!;
    expect(w.text.en).toContain("$50 CAD covers the bare run ($35 CAD)");
    expect(w.text.en).toContain("$495 CAD gap");
  });

  test("under the floor names the largest line", () => {
    const v = budgetFor({ ...EP, budget: { amount: 10, currency: "CAD" } }, a, ms);
    expect(v.verdict).toBe("under_floor");
    const w = budgetWarnings(v, label).find((x) => x.kind === "under_floor")!;
    expect(w.text.en).toContain("Promotion");
    expect(w.text.en).toContain("raise the budget");
  });

  test("a covered budget says where the next dollar goes", () => {
    const v = budgetFor({ ...EP, budget: { amount: 5000, currency: "CAD" } }, a, ms);
    expect(v.verdict).toBe("covered");
    const w = budgetWarnings(v, label).find((x) => x.kind === "budget_room")!;
    expect(w.text.en).toContain("Marketing");
  });

  test("envelopes sum to the budget between the tiers, and never exceed a decent run", () => {
    const v = budgetFor({ ...EP, budget: { amount: 500, currency: "CAD" } }, a, ms);
    expect(v.envelopes.reduce((s, e) => s + e.amount, 0)).toBe(500);
    for (const e of v.envelopes) {
      expect(e.amount).toBeGreaterThanOrEqual(e.floor);
      expect(e.amount).toBeLessThanOrEqual(e.aim);
      expect(Number.isInteger(e.amount)).toBe(true);
    }
    const rich = budgetFor({ ...EP, budget: { amount: 5000, currency: "CAD" } }, a, ms);
    for (const e of rich.envelopes) expect(e.amount).toBe(e.aim);
  });

  test("foreign-currency lines are reported apart, never converted", () => {
    const v = budgetFor({ ...EP, budget: { amount: 500, currency: "CAD" } }, a, ms);
    const w = budgetWarnings(v, label).find((x) => x.kind === "foreign_currency")!;
    expect(w.text.en).toMatch(/USD of the full run/);
  });

  test("every budget warning is one or two sentences", () => {
    for (const amount of [null, 10, 50, 500, 5000]) {
      const v = budgetFor({ ...EP, budget: amount == null ? null : { amount, currency: "CAD" } }, a, ms);
      for (const w of budgetWarnings(v, label)) {
        for (const lang of ["en", "fr"] as const) {
          expect(w.text[lang].split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý«"])/).length).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  test("money prints for a human, in both languages", () => {
    expect(money(1005, "CAD", "en")).toBe("$1,005 CAD");
    expect(money(24.99, "USD", "en")).toBe("$24.99 USD");
    expect(money(1005, "CAD", "fr")).toMatch(/^1.005 \$ CAD$/);
  });
});
