/**
 * One phase, or one department → the exact ask, with real dates.
 *
 *   bun run agents/label-manager/skills/manager-brief-department/scripts/brief.ts 3
 *   bun run .../brief.ts press
 *   bun run .../brief.ts 3 --dept=press
 *   bun run .../brief.ts 3 --json
 *
 * Code, not prose, so the phase is always read from the database. Takes a
 * department too, because one phase can be shared by several. Resolves stored
 * offsets to calendar dates, carries row ids for the receiving department, and
 * never invents an owner: an unowned step returns the gap.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import postgres from "postgres";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { OWNER_LABEL, type Lang } from "../../manager-plan-release/scripts/milestones";
import { envelopeFor, envelopeLine, type BudgetCurrency } from "../../manager-plan-release/scripts/costs";

const AGENTS = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const target = argv.find((a) => !a.startsWith("--"));
const deptFilter = argv.find((a) => a.startsWith("--dept="))?.split("=")[1];
/** Record the handoff. Off by default — briefing someone is a deliberate act. */
const SEND = argv.includes("--send");

if (!target) {
  console.error("✗ Usage: bun run .../brief.ts <phase number | department> [--dept=<slug>] [--json]");
  process.exit(1);
}
const phaseNo = /^\d+$/.test(target) ? Number(target) : null;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "✗ DATABASE_URL is not set — that, and only that, means no plan is reachable.\n" +
      "  A missing .env file does not: .env.local is gitignored and a hosted\n" +
      "  deployment has none. Do not answer from git history or from memory.",
  );
  process.exit(1);
}

/** Only these departments get the whole budget; the rest get their envelope. */
const WANTS_BUDGET = new Set(["digital-marketing"]);

/** First entry in a department's `skills:` frontmatter is its entry point. */
function entrySkill(dept: string): string | null {
  const agentMd = join(AGENTS, dept, "AGENT.md");
  if (!existsSync(agentMd)) return null;
  const m = readFileSync(agentMd, "utf8").match(/^skills:\s*\[(.*?)\]/m);
  const first = m?.[1].split(",")[0]?.trim();
  return first || null;
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
const addDays = (d: Date, n: number) =>
  new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);

try {
  const [project] = await sql`
    select id, title, project_type, street_date, markets, physical, scope,
           recording_status, budget_amount, budget_currency
      from artist.projects
     order by created_at desc
     limit 1
  `;
  if (!project) {
    console.error("✗ Nothing is planned yet — there is no project.\n" +
                  "  Scope one first: manager-scope-project.");
    process.exit(1);
  }
  // The plan was written in the artist's language; the brief is read by them.
  const lang: Lang = (project.scope?.locale as Lang) ?? "en";
  const label = (o: string | null) => OWNER_LABEL[o ?? "you"]?.[lang] ?? o ?? "you";

  const street = project.street_date ? new Date(project.street_date) : null;
  const dateFor = (n: number | null) => (street && n != null ? addDays(street, n) : null);

  const phases = await sql`
    select id, sort_order, title from artist.project_phases
     where project_id = ${project.id} order by sort_order`;
  const all = await sql`
    select id, phase_id, milestone_key, title, detail, owner, gap_reason,
           proposed_owner, offset_days, latest_offset_days, no_date_reason,
           sourced, sources, status,
           cost_floor, cost_aim, cost_full, cost_basis, no_price_reason
      from artist.project_milestones
     where project_id = ${project.id}
     order by sort_order`;

  if (!all.length) {
    console.error("✗ This project has no plan yet. Build one: manager-plan-release.");
    process.exit(1);
  }

  // Either a phase number or a department slug narrows the set.
  let scope = all;
  let heading: string;
  if (phaseNo != null) {
    const phase = phases.find((p: any) => p.sort_order === phaseNo);
    if (!phase) {
      console.error(`✗ There is no phase ${phaseNo}. This plan has: ` +
                    phases.map((p: any) => `${p.sort_order} · ${p.title}`).join(" | "));
      process.exit(1);
    }
    scope = all.filter((m: any) => m.phase_id === phase.id);
    heading = `${phaseNo} · ${phase.title}`;
  } else {
    scope = all.filter((m: any) => m.owner === target);
    if (!scope.length) {
      const inPlan = [...new Set(all.map((m: any) => m.owner).filter(Boolean))];
      console.error(`✗ "${target}" owns nothing in this plan. In it: ${inPlan.join(", ")}.`);
      process.exit(1);
    }
    heading = target;
  }
  if (deptFilter) scope = scope.filter((m: any) => m.owner === deptFilter);

  const owners = [...new Set(scope.map((m: any) => m.owner))];
  const dept = deptFilter ?? (owners.length === 1 ? owners[0] : null);

  // Same arithmetic as the plan page, so the two never disagree.
  const budgetCurrency: BudgetCurrency = project.budget_currency ?? ((project.markets ?? []).some((m: string) => m === "quebec" || m === "canada") ? "CAD" : "USD");
  const envelope = dept
    ? envelopeFor(
        all.map((m: any) => ({ owner: m.owner, floor: m.cost_floor ?? [], aim: m.cost_aim ?? [] })),
        project.budget_amount != null ? { amount: Number(project.budget_amount), currency: budgetCurrency } : null,
        budgetCurrency,
        dept,
      )
    : null;

  const shape = (m: any) => ({
    key: m.milestone_key,
    title: m.title,
    detail: m.detail,
    owner: m.owner,
    due: dateFor(m.offset_days),
    approximate: !m.sourced,
    no_date_reason: m.no_date_reason,
    gap_reason: m.gap_reason,
    status: m.status,
    cost: m.cost_floor?.length
      ? { floor: m.cost_floor, aim: m.cost_aim, full: m.cost_full, basis: m.cost_basis }
      : m.no_price_reason ? { no_price_reason: m.no_price_reason } : undefined,
    id: m.id,
  });

  const facts = {
    project_id: project.id,
    title: project.title,
    project_type: project.project_type,
    street_date: street ? street.toISOString().slice(0, 10) : null,
    markets: project.markets,
    physical: project.physical,
    ...(dept && WANTS_BUDGET.has(dept)
      ? { budget: `${project.budget_currency ?? ""} ${project.budget_amount ?? ""}`.trim() }
      : {}),
    // Every department whose steps carry a price gets its envelope.
    ...(envelope ? { envelope: envelopeLine(envelope, lang) } : {}),
  };

  if (JSON_OUT) {
    console.log(JSON.stringify({ heading, owners, facts, milestones: scope.map(shape) }, null, 2));
  } else if (owners.length > 1 && !deptFilter) {
    // Several departments share this window: list them and let the artist pick.
    console.log(`${heading}\n`);
    for (const o of owners) {
      const mine = scope.filter((m: any) => m.owner === o);
      const proposed = [...new Set(scope.filter((m: any) => m.owner === o).map((m: any) => m.proposed_owner).filter(Boolean))];
      console.log(`  ${o ? label(o) : proposed.length ? `${proposed.join(", ")} — a department the label does not have` : `${label(null)} — nobody on staff owns these`}`);
      for (const m of mine) {
        console.log(`    ${dateFor(m.offset_days) ?? "no date"}  ${m.title}`);
      }
      console.log();
    }
    console.log(`${owners.length} departments share this window, so there are ${owners.length} asks, not one.`);
    console.log("Say which one and I'll write it.");
    console.log(`\n# next: bun run .../brief.ts ${phaseNo ?? target} --dept=<slug>`);
  } else {
    const dated = scope.filter((m: any) => m.offset_days != null);
    const deadline = dated.length ? dateFor(Math.max(...dated.map((m: any) => m.offset_days))) : null;
    const starts = dated.length ? dateFor(Math.min(...dated.map((m: any) => m.offset_days))) : null;
    const skill = dept ? entrySkill(dept) : null;

    // ── record the handoff ──────────────────────────────────────────────────
    // The row is the work item; the receiving department marks it delivered.
    // `deadline` is frozen on purpose (the only stored absolute date), so a
    // later street-date move is detectable against the live window.
    let handoffId: string | null = null;
    if (SEND) {
      if (!dept) {
        console.error("✗ Refusing to record a handoff with no department.");
        console.error("  Pick one with --dept=<slug>, or this is a gap, not an ask.");
        process.exit(1);
      }
      if (!deadline) {
        console.error("✗ Refusing to record a handoff with no deadline — nothing here is dated.");
        process.exit(1);
      }
      const phaseId = scope.find((m: any) => m.phase_id)?.phase_id ?? null;
      if (!phaseId) {
        console.error("✗ Refusing to record a handoff for steps that belong to no phase.");
        process.exit(1);
      }
      const blockers = scope.flatMap((m: any) => (m.status === "blocked" ? [m.title] : []));
      const body = [
        `${project.title} — ${project.project_type}, out ${facts.street_date}.`,
        `Markets: ${(project.markets ?? []).join(", ") || "unset"}. Physical: ${project.physical}.`,
        (facts as any).budget ? `Budget: ${(facts as any).budget}.` : null,
        (facts as any).envelope ?? null,
        `Window ${starts} → ${deadline}.`,
        ...scope.map((m: any) =>
          `  ${m.offset_days != null ? dateFor(m.offset_days) : "no date"}` +
          `${m.latest_offset_days != null ? ` → ${dateFor(m.latest_offset_days)}` : ""}  ${m.title}`),
      ].filter(Boolean).join("\n");
      const [row] = await sql`
        insert into artist.project_handoffs
          (project_id, phase_id, department, skill, body, blockers, deadline)
        values (${project.id}, ${phaseId}, ${dept}, ${skill}, ${body},
                ${blockers}, ${deadline})
        returning id
      `;
      handoffId = row.id;
      await sql`
        update artist.project_phases set status = 'in_progress'
         where id = ${phaseId} and status = 'pending'
      `;
    }

    console.log(`${heading}${dept ? ` → ${label(dept)}` : ""}`);
    if (starts && deadline) console.log(`${starts} → ${deadline}`);
    console.log();
    console.log(`  ${project.title} — ${project.project_type}, out ${facts.street_date}.`);
    console.log(`  Markets: ${(project.markets ?? []).join(", ") || "unset"}. Physical: ${project.physical}.`);
    if ((facts as any).budget) console.log(`  Budget: ${(facts as any).budget}.`);
    if ((facts as any).envelope) console.log(`  ${(facts as any).envelope}`);
    console.log();
    console.log("  What they need to deliver:");
    for (const m of scope) {
      // Show the window, not just the target, so the department knows the slack.
      const when = m.offset_days != null
        ? `${m.sourced ? " " : "≈"}${dateFor(m.offset_days)}` +
          (m.latest_offset_days != null ? ` → ${dateFor(m.latest_offset_days)}` : "")
        : "  no date  ";
      console.log(`   ${when}  ${m.title}`);
      if (m.detail) console.log(`               ${m.detail}`);
      if (m.no_date_reason && m.offset_days == null) console.log(`               (${m.no_date_reason})`);
    }
    console.log();
    console.log(`  db · project ${project.id}`);
    console.log();
    if (!dept) {
      const wanted = [...new Set(scope.map((m: any) => m.proposed_owner).filter(Boolean))];
      if (wanted.length) {
        // A gap the label could close is a hiring decision, not a dead end.
        console.log(`Nobody on staff does this. It wants a department the label`);
        console.log(`does not have: ${wanted.join(", ")}.`);
        console.log(`\n→ If you want one, ask the Recruiting Agent: recruit-agent`);
      } else {
        console.log(scope[0]?.gap_reason
          ? `${scope[0].gap_reason}\nThere is no one to hand this to. The gap is the output.`
          : "Nobody on staff owns this. The gap is the output — assigning it to an\nadjacent department would invent an owner.");
      }
    } else {
      console.log(skill ? `→ Ask ${label(dept)}: ${skill}` : `→ ${label(dept)} has no skills yet — nothing to invoke.`);
      if (handoffId) console.log(`\nHanded off. I'll remember what was asked and when.`);
      else if (dept) console.log(`# not recorded — re-run with --send once the artist actually asks`);
    }
  }
} finally {
  await sql.end();
}
