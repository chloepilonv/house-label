/**
 * A saved plan as calendar events. Pure: rows in, `Dated` items out.
 * Each title opens with the owning department's tag, the same word the plan
 * page uses. The event id is the milestone row id, so re-running after a date
 * change rewrites events instead of doubling them.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Dated } from "../../../../../engine/google/calendar";
import { colorFor } from "../../../../../engine/google/calendar";
import { OWNER_LABEL, addDays, type Lang } from "./milestones";

export interface MilestoneRow {
  id: string;
  milestone_key: string;
  title: string;
  detail: string | null;
  owner: string | null;
  proposed_owner: string | null;
  offset_days: number | null;
  basis: string | null;
  status: string | null;
}

export interface PlanProject {
  title: string;
  /** YYYY-MM-DD. Without it there are no dates, and this module refuses. */
  street_date: string;
}

/** `[PROMOTION]`, `[RIGHTS]`, `[YOU]` — or `[RELEASE]` for the day itself. */
export function tagFor(m: Pick<MilestoneRow, "milestone_key" | "owner" | "proposed_owner">, lang: Lang): string {
  if (m.milestone_key === "release_day") return lang === "fr" ? "[SORTIE]" : "[RELEASE]";
  // An owner the label table does not know shows its own name, so a new
  // department's steps never read as "you".
  const word = m.owner
    ? (OWNER_LABEL[m.owner]?.[lang] ?? m.owner)
    : (m.proposed_owner ?? OWNER_LABEL.you[lang]);
  return `[${word.toUpperCase()}]`;
}

/**
 * Each dated milestone becomes one all-day event; undated ones are left off.
 * A done or cancelled step gets `active: false`, which removes its event.
 */
export function milestoneEvents(project: PlanProject, rows: MilestoneRow[], lang: Lang): Dated[] {
  const out: Dated[] = [];
  for (const m of rows) {
    if (m.offset_days == null) continue;
    const parts = [m.detail?.trim(), m.basis ? `${lang === "fr" ? "Pourquoi cette date" : "Why this date"}: ${m.basis}` : null, `${lang === "fr" ? "Projet" : "Project"}: ${project.title}`];
    out.push({
      id: m.id,
      title: `${tagFor(m, lang)} ${m.title}`,
      date: addDays(project.street_date, m.offset_days),
      description: parts.filter(Boolean).join("\n\n"),
      colorId: colorFor(m.milestone_key === "release_day" ? "label-manager" : (m.owner ?? "you")),
      active: !(m.status === "done" || m.status === "cancelled"),
    });
  }
  return out;
}
