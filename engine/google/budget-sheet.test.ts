/**
 * The budget sheet's shape — one sheet for the whole workspace, EXPECTED
 * rewritten one release at a time, SPENT only ever appended to.
 */
import { describe, expect, test } from "bun:test";
import {
  BUDGET_TABS,
  expectedRows,
  mergeExpected,
  type PlanForSheet,
} from "./budget-sheet";

const plan: PlanForSheet = {
  lines: [
    { key: "radio_serviced", owner: "promotion", title: "Radio serviced", floor: "$35 CAD", aim: "$335 CAD", full: "$335 CAD + $295 USD", basis: "5 songs …", sources: ["earshot-cost", "45tours"] },
    { key: "plant_booked", owner: null, title: "Plant booked", floor: "", aim: "", full: "", basis: "no list price", sources: ["microforum"], noPriceReason: "quoted by the plant" },
  ],
  tiers: { floor: "$35 CAD", aim: "$545 CAD", full: "$1,005 CAD + $599.99 USD" },
  budget: "$500 CAD",
};
const name = (o: string | null) => (o == null ? "You" : o);

describe("the budget sheet", () => {
  test("two tabs, two directions: EXPECTED is the plan's, SPENT is only appended to", () => {
    expect(BUDGET_TABS.map((t) => t.title)).toEqual(["EXPECTED", "SPENT"]);
    expect(BUDGET_TABS[0].purpose).toMatch(/rewritten/);
    expect(BUDGET_TABS[1].purpose).toMatch(/only ever added/);
  });

  test("both tabs say which release a row belongs to", () => {
    for (const t of BUDGET_TABS) expect(t.columns.map((c) => c.key)).toContain("release");
  });

  test("SPENT holds what an expense report asks for, and no system column", () => {
    const keys = BUDGET_TABS[1].columns.map((c) => c.key);
    for (const k of ["date", "provider", "object", "amount", "currency", "receipt", "description"]) expect(keys).toContain(k);
    expect(BUDGET_TABS[1].columns.some((c) => c.system)).toBe(false);
  });

  test("a system id is last and marked system, never first", () => {
    const cols = BUDGET_TABS[0].columns;
    expect(cols[0].system ?? false).toBe(false);
    expect(cols[cols.length - 1]).toMatchObject({ key: "milestone_key", system: true });
  });
});

describe("expectedRows", () => {
  const rows = expectedRows("Nightdrive", plan, name);
  const width = BUDGET_TABS[0].headers.length;

  test("rows follow the header, release first, and the id carries the release", () => {
    expect(rows[0]).toHaveLength(width);
    expect(rows[0].slice(0, 2)).toEqual(["Nightdrive", "Radio serviced"]);
    expect(rows[0][width - 1]).toBe("Nightdrive:radio_serviced");
  });

  test("an unpriced step prints its reason where the number would be", () => {
    expect(rows[1][3]).toBe("quoted by the plant");
    expect(rows[1][4]).toBe("");
  });

  test("ends with the totals and the budget, and never adds currencies", () => {
    const total = rows.find((r) => r[1] === "Total")!;
    expect(total[5]).toBe("$1,005 CAD + $599.99 USD");
    expect(rows.at(-1)![3]).toBe("$500 CAD");
    expect(expectedRows("X", { ...plan, budget: null }, name).at(-1)![3]).toBe("not set");
  });
});

describe("mergeExpected", () => {
  const other = [["Winter single", "Mastering", "You", "$80 CAD", "", "", "", "", "Winter single:mastered"]];

  test("saving one release's plan leaves every other release's rows alone", () => {
    const old = [...other, ["Nightdrive", "Old step", "", "", "", "", "", "", "Nightdrive:old"]];
    const merged = mergeExpected(old, "Nightdrive", expectedRows("Nightdrive", plan, name));
    expect(merged[0]).toEqual(other[0]);
    expect(merged.some((r) => r[1] === "Old step")).toBe(false);
    expect(merged.filter((r) => r[0] === "Nightdrive")).toHaveLength(4);
  });

  test("blank rows are dropped rather than kept as gaps", () => {
    expect(mergeExpected([[], ["", ""], ...other], "Nightdrive", [])).toEqual(other);
  });
});
