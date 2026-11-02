/**
 * Make a campaign plan's task costs sum to the artist's stated budget.
 *
 *   bun run agents/digital-marketing/skills/digital-marketing-plan/scripts/reconcile-budget.ts plan.json 500
 *
 * Pass the budget bare or single-quoted: in double quotes the shell expands "$500"
 * (bash to "00", zsh to ""). Code because models do not do arithmetic reliably.
 * Run it on every path that persists a plan: generation, client edits, refinement.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt.
 */

export type Task = { id?: string; title?: string; estimated_cost?: number | null };
export type Plan = { tasks: Task[]; total_estimated_cost?: number | null };

/**
 * Read a budget out of whatever the artist typed. Returns null when there is no
 * number to find, which is NOT the same as 0 — 0 means "explicitly no money",
 * null means we never captured one and must not invent it.
 */
export function parseBudget(input: string | number | null | undefined): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.max(0, input) : null;
  if (!input) return null;
  const s = String(input).trim().toLowerCase();

  // Bilingual "no budget" — an explicit zero, not a missing value.
  if (/\b(no|none|zero|nothing|free|aucun|aucune|rien|z[ée]ro|pas de budget)\b/.test(s)) return 0;

  // "1.5k" / "2k"
  const k = s.match(/(\d+(?:[.,]\d+)?)\s*k\b/);
  if (k) return Math.round(parseFloat(k[1].replace(",", ".")) * 1000);

  // "$500", "500$", "500 CAD", "2 000 $" (French thousands separator is a space)
  const n = s.replace(/[^\d.,\s]/g, " ").match(/\d[\d\s.,]*/);
  if (!n) return null;
  const cleaned = n[0].replace(/\s/g, "").replace(/,(\d{3})\b/g, "$1").replace(",", ".");
  const v = parseFloat(cleaned);
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : null;
}

export type Reconciliation = {
  plan: Plan;
  changed: boolean;
  before: number;
  after: number;
  note: string;
};

/**
 * Scale an over-budget plan down proportionally so the spend shape survives.
 * Rounding drift lands on the largest line item, so the sum is exact.
 */
export function reconcile(plan: Plan, statedBudget: number | null): Reconciliation {
  const tasks = plan.tasks ?? [];
  const cost = (t: Task) => (typeof t.estimated_cost === "number" && t.estimated_cost > 0 ? t.estimated_cost : 0);
  const before = tasks.reduce((s, t) => s + cost(t), 0);

  // No budget captured: we cannot invent one, so the total becomes the real sum.
  if (statedBudget === null) {
    return {
      plan: { ...plan, tasks, total_estimated_cost: before },
      changed: plan.total_estimated_cost !== before,
      before,
      after: before,
      note: "no budget stated — total set to the actual sum, costs untouched",
    };
  }

  // Explicit zero: every task is organic.
  if (statedBudget === 0) {
    const zeroed = tasks.map((t) => ({ ...t, estimated_cost: 0 }));
    return {
      plan: { ...plan, tasks: zeroed, total_estimated_cost: 0 },
      changed: before > 0,
      before,
      after: 0,
      note: before > 0 ? `budget is $0 — zeroed ${tasks.filter((t) => cost(t) > 0).length} paid task(s)` : "budget is $0 — plan was already organic",
    };
  }

  if (before <= statedBudget) {
    return {
      plan: { ...plan, tasks, total_estimated_cost: before },
      changed: plan.total_estimated_cost !== before,
      before,
      after: before,
      note: `within budget ($${before} of $${statedBudget}) — total corrected to the sum`,
    };
  }

  const factor = statedBudget / before;
  const scaled = tasks.map((t) => ({ ...t, estimated_cost: cost(t) ? Math.floor(cost(t) * factor) : t.estimated_cost }));
  const sum = scaled.reduce((s, t) => s + cost(t), 0);

  // Settle the floor()-drift on the largest line item so the sum is exact.
  const drift = statedBudget - sum;
  if (drift !== 0) {
    let big = -1;
    scaled.forEach((t, i) => {
      if (cost(t) > (big === -1 ? -1 : cost(scaled[big]))) big = i;
    });
    if (big !== -1) scaled[big] = { ...scaled[big], estimated_cost: cost(scaled[big]) + drift };
  }

  return {
    plan: { ...plan, tasks: scaled, total_estimated_cost: statedBudget },
    changed: true,
    before,
    after: statedBudget,
    note: `over budget by $${before - statedBudget} — scaled proportionally (×${factor.toFixed(3)}), $${drift} of rounding drift settled on the largest task`,
  };
}

if (import.meta.main) {
  const [file, budgetArg] = process.argv.slice(2);
  if (!file) {
    console.error("usage: reconcile-budget.ts <plan.json> [budget]");
    process.exit(2);
  }
  // "$500" under bash arrives here as "00". Silently treating that as an
  // explicit $0 budget wipes the plan, so refuse it.
  if (budgetArg !== undefined && /^0\d+$/.test(budgetArg)) {
    console.error(
      `refusing budget "${budgetArg}" — this is what bash makes of "$${budgetArg.slice(1)}" in double quotes.\n` +
        `Pass it bare (${budgetArg.slice(1)}) or single-quoted ('$${budgetArg.slice(1)}').`,
    );
    process.exit(2);
  }
  const plan = (await Bun.file(file).json()) as Plan;
  const result = reconcile(plan, parseBudget(budgetArg));
  console.error(`${result.changed ? "adjusted" : "unchanged"}: ${result.note}`);
  console.log(JSON.stringify(result.plan, null, 2));
}
