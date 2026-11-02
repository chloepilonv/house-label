/**
 * The campaign intake, one question at a time, saved only when asked.
 *
 *   bun run agents/digital-marketing/skills/digital-marketing-plan/scripts/plan.ts next
 *   bun run .../plan.ts answer target_date 2026-11-14
 *   bun run .../plan.ts why budget
 *   bun run .../plan.ts save
 *   bun run .../plan.ts reset
 *
 * `engine/interview/cli.ts` holds the interview rules; this file supplies the
 * questions, the draft location, pre-fill and save. It is the adapter for Claude
 * Code (Bash, no engine); `houselabel` drives `FLOW` directly. Both walk the same
 * questions. Offers pre-fill what `artist.projects` holds so nothing is asked twice.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import postgres from "postgres";
import { join } from "node:path";
import { runInterview, saveInterview, type InterviewCli } from "../../../../../engine/interview/cli";
import type { Answer, State } from "../../../../../engine/interview/core";
import { FLOW } from "./questions";
import { OFFERS } from "./offers";
import { known, render } from "./format-groups";

const HERE = "bun run agents/digital-marketing/skills/digital-marketing-plan/scripts/plan.ts";

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL is not set.");
    process.exit(1);
  }
  return postgres(url, { max: 1, onnotice: () => {} });
}

/** "CAD 1500" / "1,5k" / "aucun" → a number, or null when none was captured. */
function money(v: Answer | undefined): number | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim().toLowerCase();
  if (/\b(no|none|zero|nothing|free|aucun|aucune|rien|z[ée]ro|pas de budget)\b/.test(s)) return 0;
  const k = s.match(/(\d+(?:[.,]\d+)?)\s*k\b/);
  if (k) return Math.round(parseFloat(k[1]!.replace(",", ".")) * 1000);
  const n = s.replace(/[^\d.,\s]/g, " ").match(/\d[\d\s.,]*/);
  if (!n) return null;
  const cleaned = n[0].replace(/\s/g, "").replace(/,(\d{3})\b/g, "$1").replace(",", ".");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

const text = (v: Answer | undefined): string | null =>
  typeof v === "string" && v.trim() && v !== "unknown" ? v.trim() : null;

/**
 * Write the brief, not the plan; the tasks come next, from these answers.
 * Identity is the title, matching manager-scope-project, so a re-run updates the same row.
 */
async function save(state: State): Promise<{ id?: string; title: string; next?: string }> {
  const sql = connect();
  const a = state.answers;
  const fr = state.lang === "fr";
  try {
    const platforms = known(Array.isArray(a.platforms) ? a.platforms : []);
    const title = String(a.title);

    // Asked but not lifted into a column. A column is added only when a later step reads it.
    const brief: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(a)) {
      if (["title", "project_type", "target_date", "platforms", "budget", "primary_goal"].includes(k)) continue;
      brief[k] = v;
    }
    brief.locale = state.lang;

    const [project] = await sql`
      select id from artist.projects
       where title = ${title} and status <> 'abandoned'
       order by created_at desc limit 1`;

    const row = {
      title,
      project_type: String(a.project_type),
      target_date: text(a.target_date),
      platforms,
      // Ordered: the first is what the spend split follows.
      primary_goal: (Array.isArray(a.primary_goal) ? a.primary_goal : [a.primary_goal])
        .filter((g): g is string => typeof g === "string" && g.length > 0),
      success_target: text(a.success_looks_like),
      budget: money(a.budget),
      project_id: project?.id ?? null,
      brief,
    };

    const [existing] = await sql`
      select id from artist.marketing_campaigns
       where title = ${title} order by created_at desc limit 1`;
    const target = state.savedId ?? existing?.id ?? null;
    const [saved] = target
      ? await sql`update artist.marketing_campaigns set ${sql(row)} where id = ${target} returning id, title`
      : await sql`insert into artist.marketing_campaigns ${sql(row)} returning id, title`;

    const groups = render(platforms, state.lang);
    const linked = project?.id
      ? fr
        ? `Rattaché au projet « ${title} » de la direction.`
        : `Linked to the label manager's "${title}" project.`
      : fr
        ? "Aucun projet correspondant — la campagne vit seule."
        : "No matching project — this campaign stands on its own.";

    return {
      id: saved!.id as string,
      title: saved!.title as string,
      next:
        `${linked}\n\n` +
        (fr ? "Ce qui publie ensemble :" : "What publishes together:") +
        `\n${groups}\n\n` +
        (fr
          ? "Prochaine étape : le plan daté, tâche par tâche."
          : "Next: the dated plan, task by task.") +
        // Not a flag on this script: the plan follows knowledge/paid-promotion.md and is
        // checked by reconcile-budget.ts and checkTask() before a task row is written.
        `\n# next: SKILL.md \u00a7 Process step 4 — write the phases, then run` +
        `\n#       reconcile-budget.ts before any task row is saved`,
    };
  } finally {
    await sql.end();
  }
}

const cfg: InterviewCli = {
  flow: FLOW,
  draft: join(".plans", "campaign.draft.json"),
  here: HERE,
  offers: OFFERS,
  save,
};

if (import.meta.main) {
  const cmd = process.argv[2] ?? "next";
  // `save` is its own entry point in the engine — nothing writes on `next`.
  await (cmd === "save" ? saveInterview(cfg) : runInterview(cfg));
}
