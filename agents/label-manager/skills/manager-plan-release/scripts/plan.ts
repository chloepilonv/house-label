/**
 * The whole release, as dated milestones — on screen and as a page.
 *
 *   bun run agents/label-manager/skills/manager-plan-release/scripts/plan.ts
 *   bun run .../plan.ts --save        # also write the plan to the database
 *   bun run .../plan.ts --json
 *
 * `--save` is opt-in: rows are written only once the artist says yes.
 * Dates come from milestones.ts (pure, tested); this file reads, resolves,
 * renders and upserts.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import postgres from "postgres";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  OWNER_LABEL, addDays, daysBetween, resolve,
  type Lang, type Plan, type Scope,
} from "./milestones";
import { renderPlan } from "./render";
import { TIER_LABEL, money, settle, totals } from "./costs";
import { ensureReleaseForProject } from "../../../../../data/artist/release-link";
import { branchesFor, type Branch, type QuestionId } from "../../manager-scope-project/scripts/questions";

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const SAVE = argv.includes("--save");
const arg = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

/**
 * `--budget=500 --currency=CAD` prices the plan against a number without
 * touching the project. With `--save` it becomes the project's budget.
 * `--budget=none` clears it.
 */
const BUDGET_ARG = arg("budget");
const CURRENCY_ARG = (arg("currency") ?? "").toUpperCase();
if (CURRENCY_ARG && CURRENCY_ARG !== "CAD" && CURRENCY_ARG !== "USD") {
  console.error(`✗ --currency must be CAD or USD, not "${CURRENCY_ARG}". No conversion is done here, on purpose.`);
  process.exit(1);
}
if (BUDGET_ARG != null && BUDGET_ARG !== "none" && !(Number(BUDGET_ARG) >= 0)) {
  console.error(`✗ --budget wants a bare number ("500") or "none", not "${BUDGET_ARG}". In a shell, "$500" expands to an empty string.`);
  process.exit(1);
}

/**
 * One file per project at `.plans/<slug>.html`, overwritten on regeneration so
 * there is never a stale copy to open. The database keeps the history.
 * `.plans/` is gitignored: generated and private.
 */
export const PLANS_DIR = ".plans";
export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "plan";

const today = arg("today") ?? new Date().toISOString().slice(0, 10);

/** The warnings that print under the budget block rather than in "Read these". */
const BUDGET_KINDS = new Set(["no_budget", "under_floor", "under_aim", "budget_room", "foreign_currency"]);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "✗ DATABASE_URL is not set — that, and only that, means no project is reachable.\n" +
      "  A missing .env file does not: .env.local is gitignored and a hosted\n" +
      "  deployment has none.",
  );
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v as string | null));

try {
  const [project] = await sql`
    select id, title, project_type, street_date, date_is_target, markets, physical,
           recording_status, budget_amount, budget_currency, lead_single_id,
           lead_single_date, masters_ready_on, scope, status, release_id
      from artist.projects
     order by created_at desc
     limit 1
  `;
  if (!project) {
    console.error(
      "✗ Nothing to plan — there is no project yet.\n" +
        "  Scope one first: manager-scope-project.",
    );
    process.exit(1);
  }

  const streetDate = iso(project.street_date);
  if (!streetDate) {
    console.error(
      `✗ "${project.title}" has no release date, so there are no dates to give you.\n` +
        "  Pick a month and the whole plan lands. Until then the only honest\n" +
        "  output is a relative sequence — manager-plan-release explains it.",
    );
    process.exit(1);
  }

  // The scope answers select which branches exist. Stored answers are the
  // source; the lifted columns are what the plan actually branches on.
  const answers: Partial<Record<QuestionId, string | string[]>> = {
    ...(project.scope ?? {}),
    project_type: project.project_type,
    physical: project.physical,
    recording_status: project.recording_status,
    markets: project.markets ?? [],
  };
  const branches = branchesFor(answers) as Branch[];

  const leadSingle: string | null =
    (project.scope?.lead_single as string) ??
    (project.lead_single_id
      ? (await sql`select title from artist.songs where id = ${project.lead_single_id}`)[0]?.title ?? null
      : null);
  const singleDate = iso(project.lead_single_date);
  const mastersOn = iso(project.masters_ready_on);

  // The flag first, else the scoped budget. Null is a real answer: the plan
  // prices the tiers and asks.
  const budgetCurrency = (CURRENCY_ARG || project.budget_currency || (project.markets?.some((m: string) => m === "quebec" || m === "canada") ? "CAD" : "USD")) as "CAD" | "USD";
  const budget =
    BUDGET_ARG === "none" ? null
    : BUDGET_ARG != null ? { amount: Number(BUDGET_ARG), currency: budgetCurrency }
    : project.budget_amount != null ? { amount: Number(project.budget_amount), currency: budgetCurrency }
    : null;

  // Per-song prices want the real count. Before the catalog is in, costs.ts
  // falls back to the project type and prints ≈.
  const [{ n: trackCount }] = project.release_id
    ? await sql`select count(*)::int as n from artist.songs where release_id = ${project.release_id}`
    : [{ n: 0 }];

  const scope: Scope = {
    budget,
    trackCount: trackCount > 0 ? trackCount : null,
    projectType: project.project_type,
    branches,
    physical: project.physical,
    recordingStatus: project.recording_status,
    mastersReadyOffset: mastersOn ? daysBetween(streetDate, mastersOn) : null,
    leadSingle: leadSingle && leadSingle !== "unknown" ? leadSingle : null,
    leadSingleOffset: singleDate ? daysBetween(streetDate, singleDate) : null,
    covers: project.scope?.covers === "yes",
    markets: project.markets ?? [],
  };

  const plan = resolve(scope, streetDate, today);
  const lang: Lang = (project.scope?.locale as Lang) ?? (scope.markets.includes("quebec") ? "fr" : "en");

  // ── the page ────────────────────────────────────────────────────────────
  const file = join(PLANS_DIR, `${slugify(project.title)}.html`);
  mkdirSync(PLANS_DIR, { recursive: true });
  writeFileSync(
    file,
    renderPlan(plan, {
      title: project.title,
      projectType: project.project_type,
      markets: scope.markets,
      physical: project.physical,
      generatedOn: today,
      lang,
    }),
  );

  // ── the rows ────────────────────────────────────────────────────────────
  let saved = 0;
  let budgetSheetUrl: string | null = null;
  if (SAVE) {
    // Projects scoped before release-link.ts have no release row; create it here.
    await ensureReleaseForProject(sql, project as Parameters<typeof ensureReleaseForProject>[1]);
    const phaseIds = new Map<string, string>();
    for (const p of plan.phases) {
      const [row] = await sql`
        insert into artist.project_phases
          (project_id, title, sort_order, starts_week, ends_week, owner, gap_reason, unestimated)
        values (${project.id}, ${p.title[lang]}, ${p.order},
                ${p.startsDay == null ? null : Math.round(p.startsDay / 7)},
                ${p.endsDay == null ? null : Math.round(p.endsDay / 7)},
                ${p.owners.filter(Boolean).length === 1 ? p.owners.find(Boolean) : null},
                ${p.owners.every((o) => o == null) ? "no department owns this phase" : null},
                ${p.milestones.some((m) => !m.sourced)})
        on conflict (project_id, sort_order) do update
           set title = excluded.title, starts_week = excluded.starts_week,
               ends_week = excluded.ends_week, owner = excluded.owner,
               gap_reason = excluded.gap_reason, unestimated = excluded.unestimated
        returning id
      `;
      phaseIds.set(p.key, row.id);
    }
    // Keyed on milestone_key, never on sort_order: regenerating is allowed to
    // renumber and regroup, and must never move a `done` mark onto other work.
    for (const [i, m] of plan.milestones.entries()) {
      const c = m.cost;
      await sql`
        insert into artist.project_milestones
          (project_id, phase_id, milestone_key, title, detail, owner, gap_reason,
           proposed_owner, offset_days, latest_offset_days, no_date_reason,
           sourced, sources, basis, sort_order,
           cost_floor, cost_aim, cost_full, cost_basis, cost_sourced, no_price_reason)
        values (${project.id}, ${phaseIds.get(m.phase) ?? null}, ${m.key},
                ${m.title[lang]}, ${m.detail[lang]}, ${m.owner},
                ${m.gapReason ? m.gapReason[lang] : null}, ${m.proposedOwner ?? null},
                ${m.offsetDays}, ${m.latestOffsetDays},
                ${m.noDateReason && m.offsetDays == null ? m.noDateReason[lang] : null}, ${m.sourced},
                ${m.sources}, ${m.basis[lang]}, ${i + 1},
                ${sql.json(c?.floor ?? [])}, ${sql.json(c?.aim ?? [])}, ${sql.json(c?.full ?? [])},
                ${c ? c.basis[lang] : null}, ${c ? c.sourced : null},
                ${c?.noPriceReason ? c.noPriceReason[lang] : null})
        on conflict (project_id, milestone_key) do update
           set phase_id = excluded.phase_id, title = excluded.title,
               detail = excluded.detail, owner = excluded.owner,
               gap_reason = excluded.gap_reason, proposed_owner = excluded.proposed_owner,
               offset_days = excluded.offset_days,
               latest_offset_days = excluded.latest_offset_days,
               no_date_reason = excluded.no_date_reason, sourced = excluded.sourced,
               sources = excluded.sources, basis = excluded.basis,
               sort_order = excluded.sort_order,
               cost_floor = excluded.cost_floor, cost_aim = excluded.cost_aim,
               cost_full = excluded.cost_full, cost_basis = excluded.cost_basis,
               cost_sourced = excluded.cost_sourced, no_price_reason = excluded.no_price_reason
      `;
      saved++;
    }
    // Only a --budget flag is saved; a save never rewrites the stored budget.
    if (BUDGET_ARG != null) {
      await sql`
        update artist.projects
           set budget_amount = ${budget?.amount ?? null}, budget_currency = ${budget?.currency ?? null}
         where id = ${project.id}`;
    }
    // Phases a re-scope dropped: the upsert above never removes the tail.
    await sql`
      delete from artist.project_phases
       where project_id = ${project.id} and sort_order > ${plan.phases.length}
    `;
    // Milestones a re-scope dropped.
    await sql`
      delete from artist.project_milestones
       where project_id = ${project.id}
         and milestone_key <> all(${plan.milestones.map((m) => m.key)})
    `;
    await sql`update artist.projects set status = 'planned' where id = ${project.id} and status = 'scoping'`;

    // The plan's prices go to the EXPECTED tab of the root Budget sheet (this
    // release's rows only). Never fatal: Google may not be connected.
    try {
      const { writeExpected } = await import("../../../../../engine/google/workspace");
      {
        const v = plan.budget;
        const sheet = await writeExpected(
          project.title,
          {
            lines: v.lines.map((l) => ({
              key: l.key,
              owner: l.owner,
              title: l.title[lang],
              floor: l.floor.length ? totals(settle(l.floor, v.currency), lang) : "",
              aim: totals(settle(l.aim, v.currency), lang),
              full: totals(settle(l.full, v.currency), lang),
              basis: l.basis[lang],
              sources: l.sources,
              noPriceReason: l.noPriceReason?.[lang],
            })),
            tiers: { floor: totals(v.tiers.floor, lang), aim: totals(v.tiers.aim, lang), full: totals(v.tiers.full, lang) },
            budget: v.budget ? money(v.budget.amount, v.budget.currency, lang) : null,
          },
          (o) => OWNER_LABEL[o ?? "you"][lang],
        );
        if (sheet) budgetSheetUrl = sheet.url;
      }
    } catch (err) {
      console.log(`\n! Budget sheet not built: ${(err as Error).message.split("\n")[0]}`);
      console.log("  The plan is saved. Re-run --save for the sheet.");
    }
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ project: project.id, file, saved: SAVE, budgetSheet: budgetSheetUrl, plan }, null, 2));
  } else {
    printSummary(plan, project.title, lang, file, SAVE, saved, today);
    if (budgetSheetUrl) {
      console.log(
        lang === "fr"
          ? `Feuille de budget : ${budgetSheetUrl}\n  Onglet EXPECTED = ce que le plan prévoit ; onglet SPENT = tes vraies dépenses, avec le reçu.`
          : `Budget sheet: ${budgetSheetUrl}\n  EXPECTED tab = what the plan expects; SPENT tab = what you actually paid, receipt beside it.`,
      );
    }
  }
} finally {
  await sql.end();
}

/**
 * The terminal half: short, and never shows storage names (`W-9`, `phase_id`).
 * The page has the detail.
 */
function printSummary(
  plan: Plan, title: string, lang: Lang, file: string,
  saved: boolean, count: number, today: string,
) {
  const fr = lang === "fr";
  const name = (o: string | null) => OWNER_LABEL[o ?? "you"][lang];
  const d = (offset: number | null) => (offset == null ? "—" : addDays(plan.streetDate, offset));

  const first = plan.milestones.find((m) => m.date);
  const wks = Math.round(plan.daysOut / 7);

  console.log(`${title} · ${fr ? "sortie le" : "out"} ${plan.streetDate} · ${wks} ${fr ? "semaines" : "weeks"}`);
  if (first?.date) {
    const inDays = daysBetween(today, first.date);
    console.log(
      fr
        ? `Première échéance : ${first.title.fr} — ${first.date} (${inDays >= 0 ? `dans ${inDays} jours` : `il y a ${-inDays} jours`})`
        : `First deadline: ${first.title.en} — ${first.date} (${inDays >= 0 ? `in ${inDays} days` : `${-inDays} days ago`})`,
    );
  }
  console.log();

  for (const p of plan.phases) {
    // Unstaffed steps show the proposed department, not "You".
    const owners = [
      ...new Set(p.milestones.map((m) => (m.owner ? name(m.owner) : m.proposedOwner ?? name(null)))),
    ].join(" · ");
    console.log(`  ${p.order} · ${p.title[lang].padEnd(36)} ${d(p.startsDay)} → ${d(p.endsDay)}   ${owners}`);
    for (const m of p.milestones) {
      const when = m.date ? `${m.sourced ? " " : "≈"}${m.date}` : ` ${fr ? "sans date" : "no date"}`.padEnd(11);
      // The window, not just the target. "→ 2027-04-09" says the plan bends.
      const win = m.latestDate ? ` → ${m.latestDate}` : "".padEnd(0);
      console.log(`        ${when}${win.padEnd(m.latestDate ? 0 : 13)}  ${m.title[lang]}`);
    }
  }

  printBudget(plan, lang);

  // The money verdicts already printed under the budget; the rest go here.
  const rest = plan.warnings.filter((w) => !BUDGET_KINDS.has(w.kind));
  if (rest.length) {
    console.log(`\n${fr ? "À lire" : "Read these"}`);
    for (const [i, w] of rest.slice(0, 3).entries()) console.log(`  ${i + 1}. ${w.text[lang]}`);
    if (rest.length > 3) {
      console.log(`  ${fr ? `+${rest.length - 3} autres dans la page` : `+${rest.length - 3} more on the page`}`);
    }
  }

  if (plan.missingDepartments.length) {
    console.log(
      fr
        ? `\nDépartements que le label n'a pas : ${plan.missingDepartments.join(" · ")}`
        : `\nDepartments the label doesn't have: ${plan.missingDepartments.join(" · ")}`,
    );
    console.log("# these route to the Recruiting Agent: /recruit-agent");
  }
  console.log(`\n${fr ? "Plan" : "Plan"}: ${file}`);
  console.log(
    saved
      ? fr ? `Enregistré · ${count} étapes.` : `Saved · ${count} steps.`
      : fr
        ? "Pas encore enregistré. Relance avec --save quand l'artiste dit oui."
        : "Not saved yet. Re-run with --save once the artist says yes.",
  );
}

/**
 * The money half of the summary: tiers, each department's lines, and the
 * envelopes when there is a budget. The budget verdicts print right under it.
 */
function printBudget(plan: Plan, lang: Lang) {
  const fr = lang === "fr";
  const v = plan.budget;
  if (!v.lines.length) return;
  const name = (o: string | null) => OWNER_LABEL[o ?? "you"][lang];
  const c = v.currency;
  const isFree = (t: Record<string, number>) => Object.values(t).every((n) => n === 0);
  const show = (t: Record<string, number>) => (isFree(t) ? (fr ? "gratuit" : "free") : totals(t, lang));
  const range = (floor: Record<string, number>, aim: Record<string, number>, full?: Record<string, number>) =>
    isFree(floor) && isFree(aim) && (!full || isFree(full))
      ? (fr ? "gratuit" : "free")
      : `${show(floor)} → ${show(aim)}` + (full && JSON.stringify(full) !== JSON.stringify(aim) ? ` → ${show(full)}` : "");

  const head = v.budget
    ? fr ? `Budget : ${money(v.budget.amount, v.budget.currency, "fr")}` : `Budget: ${money(v.budget.amount, v.budget.currency, "en")}`
    : fr ? "Budget : aucun chiffre donné" : "Budget: no number given";
  console.log(`\n${head}`);
  for (const tier of ["floor", "aim", "full"] as const) {
    console.log(`  ${TIER_LABEL[tier][lang].padEnd(10)} ${totals(v.tiers[tier], lang)}`);
  }
  console.log();
  for (const o of v.byOwner) {
    const mine = v.lines.filter((l) => l.owner === o.owner);
    const priced = mine.some((l) => l.floor.length);
    console.log(`  ${name(o.owner).padEnd(14)} ${priced ? range(o.floor, o.aim, o.full) : fr ? "pas de prix publié" : "no published price"}`);
    for (const l of mine) {
      const what = l.floor.length
        ? range(settle(l.floor, c), settle(l.aim, c)) + (l.sourced ? "" : " ≈")
        : `${fr ? "sans prix" : "no price"} — ${l.noPriceReason?.[lang] ?? ""}`;
      console.log(`      ${l.title[lang].padEnd(40)} ${what}`);
    }
  }
  if (v.envelopes.length) {
    console.log(`\n  ${fr ? "Ce que chaque département reçoit" : "What each department gets"}`);
    for (const e of v.envelopes) {
      console.log(`  ${name(e.owner).padEnd(14)} ${money(e.amount, c, lang)}   ${fr ? "(minimum" : "(bare"} ${money(e.floor, c, lang)} · ${fr ? "correct" : "decent"} ${money(e.aim, c, lang)})`);
    }
  }
  // The verdict, right under the numbers it is about.
  for (const w of plan.warnings.filter((w) => BUDGET_KINDS.has(w.kind))) console.log(`\n  → ${w.text[lang]}`);
}

// A save also rebuilds the Plan sheet and the calendar through the recap, so
// no second command is needed. Silent when Google is not connected.
if (SAVE) {
  const sheet = Bun.spawn(["bun", "run", new URL("../../manager-weekly-recap/scripts/recap.ts", import.meta.url).pathname, "--sheet"], {
    env: { ...process.env }, stdout: "inherit", stderr: "inherit",
  });
  await sheet.exited;
}
