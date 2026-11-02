/**
 * Every dated thing the artist has to do, from four places, as one list.
 *
 *   · the artist's own priorities — label-manager memory `priorities`, a JSON
 *     list of {title, owner, due, note?, link?, replaces?, done?}. What the
 *     artist said this week wins, and `replaces` hides the plan steps it
 *     stands in for.
 *   · the release plan's milestones — `artist.project_milestones`, dated from
 *     the street date at read time, linked to the page their date came from
 *   · digital-marketing's dated tasks — `artist.marketing_tasks`
 *   · every other department's own list — memory `todo` on that department,
 *     a JSON list of {title, due, note?, link?, done?, id?}
 *
 * Read and never written: a status changes in the Plan sheet (plan-sheet.ts)
 * or in the department that owns the row, never here.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Artist } from "../../../../../data/artist/client";
import { OWNER_LABEL, SOURCES, type Lang } from "../../manager-plan-release/scripts/milestones";

export const DAY = 86_400_000;
export const iso = (d: Date): string => d.toISOString().slice(0, 10);
export const day = (s: string | Date): Date => new Date(`${typeof s === "string" ? s.slice(0, 10) : iso(s)}T00:00:00Z`);
export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY);
/** The Monday of the week `d` is in (a Sunday belongs to the week before). */
export const mondayOf = (d: Date): Date => addDays(d, -((d.getUTCDay() + 6) % 7));

/** Owners that are not a department on the roster, named for the artist all the same. */
const EXTRA_OWNERS: Record<string, Record<Lang, string>> = {
  "label-manager": { en: "Label manager", fr: "Label manager" },
  artwork: { en: "Artwork", fr: "Visuel" },
};
export const OWNERS = [...Object.keys(OWNER_LABEL), ...Object.keys(EXTRA_OWNERS)];
export const ownerLabel = (slug: string, lang: Lang): string =>
  OWNER_LABEL[slug]?.[lang] ?? EXTRA_OWNERS[slug]?.[lang] ?? slug;

export interface Item {
  title: string;
  /** department slug, or "you" */
  owner: string;
  due: Date;
  /** The far end of the window, when the plan gives one. A window still open is not late. */
  last?: Date;
  note?: string;
  /** Where to do it — the form, the page the date came from, the content. */
  link?: string;
  priority?: boolean;
  done: boolean;
  /** "To do" · "Done" · "Won't do" — the Plan sheet's word, when it has one ("In progress" from a task row). */
  status?: string;
  milestone?: boolean;
  /** Stable id for the sheet and the calendar. */
  key: string;
  /** ISO day the row last changed — how "done last week" is known. */
  updatedAt?: string;
}

export interface Project {
  id: string;
  title: string;
  projectType: string;
  streetDate: Date | null;
  leadSingleDate: Date | null;
  driveFolderId: string | null;
}

const keyOf = (owner: string, id: string) => `${owner}|${id}`;

export async function gatherItems(artist: Artist): Promise<{ project: Project | null; items: Item[] }> {
  const p = await artist.one<{
    id: string; title: string; project_type: string; street_date: string | null; lead_single_date: string | null; drive_folder_id: string | null; status: string;
  }>("projects", {}, { orderBy: "created_at desc" });
  if (!p || p.status === "abandoned") return { project: null, items: [] };
  const project: Project = {
    id: p.id, title: p.title, projectType: p.project_type,
    streetDate: p.street_date ? day(p.street_date) : null,
    leadSingleDate: p.lead_single_date ? day(p.lead_single_date) : null,
    driveFolderId: p.drive_folder_id,
  };
  const items: Item[] = [];

  const memory = await artist.query<{ key: string; value: string }>("memory", { agent: "label-manager", key: "priorities" });
  const priorities = parse<{ title: string; owner?: string; due: string; note?: string; link?: string; replaces?: string[]; done?: boolean }>(memory[0]?.value);
  const replaced = new Set(priorities.flatMap((x) => x.replaces ?? []));
  for (const x of priorities)
    items.push({ title: x.title, owner: x.owner ?? "you", due: day(x.due), note: x.note, link: x.link, priority: true, done: !!x.done, key: keyOf(x.owner ?? "you", x.title) });

  for (const dept of OWNERS) {
    const rows = await artist.query<{ key: string; value: string; updated_at?: string }>("memory", { agent: dept, key: "todo" });
    for (const t of parse<{ title: string; due: string; note?: string; link?: string; done?: boolean; id?: string }>(rows[0]?.value))
      if (t.due && !replaced.has(t.title))
        items.push({ title: t.title, owner: dept, due: day(t.due), note: t.note, link: t.link, done: !!t.done, key: keyOf(dept, t.id ?? t.title) });
  }

  if (project.streetDate) {
    const street = project.streetDate;
    const milestones = await artist.query<{
      title: string; owner: string | null; proposed_owner: string | null; offset_days: number | null; latest_offset_days: number | null;
      status: string; detail: string | null; sources: string[] | null; updated_at: string;
    }>("project_milestones", { project_id: project.id }, { limit: 300 });
    for (const m of milestones) {
      if (m.offset_days === null || replaced.has(m.title) || m.status === "skipped") continue;
      const link = (m.sources ?? []).map((k) => SOURCES[k]?.url).find(Boolean);
      items.push({
        title: m.title, owner: m.owner ?? m.proposed_owner ?? "you",
        due: addDays(street, Number(m.offset_days)),
        last: m.latest_offset_days === null ? undefined : addDays(street, Number(m.latest_offset_days)),
        note: m.detail ?? undefined, link, done: m.status === "done", milestone: true,
        key: keyOf(m.owner ?? "you", m.title), updatedAt: iso(day(m.updated_at)),
      });
    }
  }

  const tasks = await artist.query<{ id: string; title: string; due_date: string | null; status: string; content_url: string | null; updated_at: string }>(
    "marketing_tasks", {}, { limit: 300 });
  for (const t of tasks)
    if (t.due_date && !replaced.has(t.title) && t.status !== "skipped")
      items.push({
        title: t.title, owner: "digital-marketing", due: day(t.due_date), link: t.content_url ?? undefined,
        done: t.status === "done", status: t.status === "in_progress" ? "In progress" : undefined,
        key: keyOf("digital-marketing", t.id), updatedAt: iso(day(t.updated_at)),
      });

  return { project, items };
}

function parse<T>(json: string | undefined): T[] {
  try {
    const v = JSON.parse(json ?? "[]");
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export interface Week {
  monday: Date;
  sunday: Date;
  /** Open, due between Monday and Sunday, date order, priorities first on a tie. */
  week: Item[];
  /** Open, and the LAST honest day has passed. */
  late: Item[];
  /** Open, after this week. */
  later: Item[];
  /** Ticked in the seven days before Monday. */
  done: Item[];
}

/** Pure, so it is tested: which bucket each item falls in for the week of `today`. */
export function splitWeek(items: Item[], today: Date): Week {
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const weekAgo = iso(addDays(monday, -7));
  const open = items.filter((i) => !i.done).sort((a, b) => +a.due - +b.due || Number(!!b.priority) - Number(!!a.priority));
  const late = open.filter((i) => +(i.last ?? i.due) < +monday);
  const week = open.filter((i) => !late.includes(i) && +i.due <= +sunday);
  const later = open.filter((i) => +i.due > +sunday);
  const done = items.filter((i) => i.done && i.updatedAt && i.updatedAt >= weekAgo && i.updatedAt < iso(monday));
  return { monday, sunday, week, late, later, done };
}
