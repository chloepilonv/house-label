/**
 * `Budget/Budget`, the one money sheet for all releases (the `Release` column
 * may be blank). EXPECTED is output: a plan save rewrites only its release's
 * block. SPENT is input: append-only. Pure; I/O lives in workspace.ts.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Column, TabSpec } from "./credits-sheet";

const tab = (title: string, purpose: string, columns: Column[]): TabSpec => ({
  title,
  purpose,
  columns,
  headers: columns.map((c) => c.label),
});

export const BUDGET_SHEET = "Budget";

export const EXPECTED_TAB = "EXPECTED";
export const SPENT_TAB = "SPENT";

export const BUDGET_TABS: TabSpec[] = [
  tab(
    EXPECTED_TAB,
    "What each release plan expects to cost — bare is the cheapest published route, decent a real run, full the same with the upgrade. Each release's rows are rewritten when its plan is saved; put real expenses in SPENT, not here.",
    [
      { key: "release", label: "Release" },
      { key: "step", label: "Step" },
      { key: "department", label: "Department" },
      { key: "floor", label: "Bare" },
      { key: "aim", label: "Decent" },
      { key: "full", label: "Full" },
      { key: "basis", label: "Where the numbers come from" },
      { key: "sources", label: "Sources" },
      { key: "milestone_key", label: "System ID", system: true },
    ],
  ),
  tab(
    SPENT_TAB,
    "Every real expense, one per row, with the receipt beside it. This tab is your expense report for FACTOR, Musicaction or your accountant. Rows are only ever added — nothing here is rewritten.",
    [
      { key: "date", label: "Date" },
      { key: "release", label: "Release" },
      { key: "provider", label: "Provider" },
      { key: "object", label: "Object" },
      { key: "amount", label: "Amount" },
      { key: "currency", label: "Currency" },
      { key: "tax", label: "Tax on receipt" },
      { key: "plan_step", label: "Plan step" },
      { key: "receipt", label: "Receipt" },
      { key: "description", label: "Description" },
    ],
  ),
];

/** What `expectedRows` needs of a plan — a slice, so this file never imports the manager. */
export interface PlanForSheet {
  lines: {
    key: string;
    owner: string | null;
    title: string;
    floor: string;
    aim: string;
    full: string;
    basis: string;
    sources: string[];
    noPriceReason?: string;
  }[];
  tiers: { floor: string; aim: string; full: string };
  budget: string | null;
}

/**
 * One release's EXPECTED block in header order: lines, three totals, budget.
 * Text throughout, since totals can mix currencies. System ID is
 * `<release>:<key>` so identical steps in two releases stay distinct.
 */
export function expectedRows(
  release: string,
  p: PlanForSheet,
  ownerName: (o: string | null) => string,
): string[][] {
  const id = (k: string) => `${release}:${k}`;
  const rows: string[][] = p.lines.map((l) => [
    release,
    l.title,
    ownerName(l.owner),
    l.floor || (l.noPriceReason ?? ""),
    l.floor ? l.aim : "",
    l.floor ? l.full : "",
    l.basis,
    l.sources.join(" · "),
    id(l.key),
  ]);
  rows.push([release, "Total", "", p.tiers.floor, p.tiers.aim, p.tiers.full, "", "", id("total")]);
  rows.push([release, "Your budget", "", p.budget ?? "not set", "", "", "", "", id("budget")]);
  return rows;
}

/**
 * The EXPECTED tab after one release's save: other releases' rows kept in
 * order, this one's replaced, blanks dropped. Matched on the Release cell, so
 * a renamed release leaves its old block behind.
 */
export function mergeExpected(existing: string[][], release: string, fresh: string[][]): string[][] {
  const kept = existing.filter((r) => r.some((c) => c?.trim()) && (r[0] ?? "").trim() !== release);
  return [...kept, ...fresh];
}
