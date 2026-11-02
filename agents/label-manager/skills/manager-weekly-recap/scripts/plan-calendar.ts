/**
 * Every task on the label's Google Calendar, beside the plan's milestones.
 *
 * Milestones go through `syncPlan` (manager-plan-release/scripts/calendar.ts,
 * their own `[OWNER]` events); everything else here is one all-day event per
 * task on the same calendar, keyed on the task so a re-run updates instead of
 * doubling, and a ticked task leaves. Removes only events this script made —
 * a "[DEPARTMENT] " title on the label's own calendar that no current task
 * claims — never a milestone and never anything the artist put there.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Lang } from "../../manager-plan-release/scripts/milestones";
import { iso, ownerLabel, OWNERS, type Item } from "./items";

export interface CalendarCounts {
  created: number;
  updated: number;
  deleted: number;
}

const tag = (owner: string, lang: Lang) => `[${(owner === "you" ? (lang === "fr" ? "Toi" : "You") : ownerLabel(owner, lang)).toUpperCase()}] `;

export async function syncTaskCalendar(items: Item[], lang: Lang): Promise<CalendarCounts | null> {
  const { available } = await import("../../../../../engine/google/workspace");
  if (!(await available().catch(() => false))) return null;
  const { sync, targetCalendar, eventIdFor } = await import("../../../../../engine/google/calendar");
  const { syncPlan } = await import("../../manager-plan-release/scripts/calendar");
  const { gapi } = await import("../../../../../engine/google/api");

  await syncPlan({ write: true }).catch(() => undefined);
  const calendarId = await targetCalendar();
  const cal = encodeURIComponent(calendarId);
  const tasks = items.filter((i) => !i.milestone);
  const keep = new Set(tasks.map((i) => eventIdFor(`todo:${i.key}`)));
  const tags = new Set([...OWNERS, "you"].flatMap((o) => [tag(o, "en"), tag(o, "fr")]));
  const plan = new Set((await syncPlan({ write: false }).catch(() => ({ events: [] as { title: string }[] }))).events.map((e) => e.title));

  let pageToken = "";
  do {
    const r = await gapi<{ items: { id: string; summary?: string }[]; nextPageToken?: string }>(
      "listing events",
      `https://www.googleapis.com/calendar/v3/calendars/${cal}/events?maxResults=2500&showDeleted=false${pageToken ? `&pageToken=${pageToken}` : ""}`,
    );
    for (const e of r.items)
      if (!keep.has(e.id) && !plan.has(e.summary ?? "") && [...tags].some((t) => e.summary?.startsWith(t)))
        await gapi("removing a stale task", `https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${e.id}`, { method: "DELETE" }).catch(() => {});
    pageToken = r.nextPageToken ?? "";
  } while (pageToken);

  return sync(
    calendarId,
    tasks.map((i) => ({
      id: `todo:${i.key}`,
      title: `${tag(i.owner, lang)}${i.title}`,
      date: iso(i.due),
      description: [i.note, i.link].filter(Boolean).join("\n"),
      active: !i.done,
    })),
  );
}
