/**
 * The saved plan, on the artist's Google Calendar.
 *
 *   bun run agents/label-manager/skills/manager-plan-release/scripts/calendar.ts            # preview
 *   bun run .../calendar.ts --sync                                                            # write it
 *   bun run .../calendar.ts --project="Nightdrive" --sync                                    # not the latest one
 *
 * `houselabel calendar sync` is the same function. A script rather than the
 * model calling `calendar_sync`, so which rows get passed is not re-decided
 * every run. The sync is idempotent.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import postgres from "postgres";
import { sync, targetCalendar } from "../../../../../engine/google/calendar";
import { status } from "../../../../../engine/google/store";
import { milestoneEvents, type MilestoneRow, type PlanProject } from "./events";
import type { Lang } from "./milestones";

export interface SyncPlanOptions {
  /** A project title fragment or id. Default: the most recently scoped project. */
  project?: string;
  /** Write to Google. Without it, preview only. */
  write?: boolean;
}

export interface SyncPlanReport {
  project: string;
  streetDate: string;
  calendarId: string | null;
  events: { date: string; title: string; active: boolean }[];
  created: number;
  updated: number;
  deleted: number;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v as string | null));

export async function syncPlan(opts: SyncPlanOptions = {}): Promise<SyncPlanReport> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set — no project is reachable.");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const [project] = opts.project
      ? await sql`
          select id, title, street_date, markets, scope from artist.projects
           where id::text = ${opts.project} or title ilike ${"%" + opts.project + "%"}
           order by created_at desc limit 1`
      : await sql`select id, title, street_date, markets, scope from artist.projects order by created_at desc limit 1`;
    if (!project) throw new Error(opts.project ? `No project matches "${opts.project}".` : "No project yet — scope one first: manager-scope-project.");

    const streetDate = iso(project.street_date);
    if (!streetDate) throw new Error(`"${project.title}" has no release date, so there is nothing to put on a calendar.`);

    const rows = (await sql`
      select id, milestone_key, title, detail, owner, proposed_owner, offset_days, basis, status
        from artist.project_milestones where project_id = ${project.id} order by sort_order`) as unknown as MilestoneRow[];
    if (!rows.length) throw new Error(`"${project.title}" has no saved plan. Run plan.ts --save first.`);

    const lang: Lang = (project.scope?.locale as Lang) ?? ((project.markets ?? []).includes("quebec") ? "fr" : "en");
    const plan: PlanProject = { title: project.title, street_date: streetDate };
    const events = milestoneEvents(plan, rows, lang);

    const report: SyncPlanReport = {
      project: project.title,
      streetDate,
      calendarId: null,
      events: events.map((e) => ({ date: e.date, title: e.title, active: e.active !== false })),
      created: 0, updated: 0, deleted: 0,
    };
    if (!opts.write) return report;

    if (!(await status()).connected) throw new Error("No Google account is connected. `houselabel connect google` first.");
    const calendarId = await targetCalendar();
    const counts = await sync(calendarId, events);
    return { ...report, calendarId, ...counts };
  } finally {
    await sql.end();
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
  try {
    const r = await syncPlan({ project: arg("project"), write: argv.includes("--sync") });
    if (argv.includes("--json")) {
      console.log(JSON.stringify(r, null, 2));
    } else {
      console.log(`\n  ${r.project} — street date ${r.streetDate}\n`);
      for (const e of r.events) console.log(`  ${e.active ? " " : "✓"} ${e.date}  ${e.title}`);
      console.log(
        r.calendarId
          ? `\n  ✓ calendar ${r.calendarId}\n    ${r.created} added · ${r.updated} updated · ${r.deleted} removed\n`
          : `\n  ${r.events.length} events. Nothing written — add --sync to put them on the calendar.\n`,
      );
    }
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
  }
}
