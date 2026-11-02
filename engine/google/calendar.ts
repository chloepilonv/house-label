/**
 * Google Calendar sync for dates departments compute. The event id is derived
 * from the source row's uuid (`hl` + hex), never stored, so re-syncing a row
 * always addresses the same event and no tracking columns are needed.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { gapi } from "./api";
import { setSetting, status } from "./store";

const CAL = "https://www.googleapis.com/calendar/v3";

export interface CalendarSummary {
  id: string;
  name: string;
  primary: boolean;
}

export async function listCalendars(): Promise<CalendarSummary[]> {
  const { items } = await gapi<{ items?: { id: string; summary?: string; primary?: boolean }[] }>(
    "the calendar list",
    `${CAL}/users/me/calendarList`,
  );
  return (items ?? []).map((c) => ({ id: c.id, name: c.summary ?? "Untitled", primary: c.primary ?? false }));
}

export async function createCalendar(name: string): Promise<string> {
  const cal = await gapi<{ id: string }>("creating the calendar", `${CAL}/calendars`, {
    method: "POST",
    json: { summary: name },
  });
  return cal.id;
}

/** Remember which calendar the artist chose, so nothing asks twice. */
export const rememberCalendar = (calendarId: string) => setSetting("calendar_id", calendarId);

/** The calendar the artist syncs to: the one they picked, else ours, made once. */
export async function targetCalendar(): Promise<string> {
  const chosen = (await status()).settings.calendar_id;
  if (typeof chosen === "string" && chosen) return chosen;
  const existing = (await listCalendars()).find((c) => c.name === "House Label");
  return existing?.id ?? (await createCalendar("House Label"));
}

/**
 * One calendar entry, built by departments. `id` must be the source row's
 * stable uuid; a fresh id per run breaks idempotency.
 */
export interface Dated {
  id: string;
  title: string;
  /** YYYY-MM-DD. All-day events: a release week is not a 3pm appointment. */
  date: string;
  description?: string;
  /** Google's palette, 1-11. `colorFor` maps a department to one. */
  colorId?: string;
  /** False for a task the artist finished or cancelled — the event is removed. */
  active?: boolean;
}

export interface SyncCounts {
  created: number;
  updated: number;
  deleted: number;
}

/**
 * Make the calendar match the list. Idempotent. Deletes only events whose id
 * derives from a given row; never touches anything else on the calendar.
 */
export async function sync(calendarId: string, items: Dated[]): Promise<SyncCounts> {
  const counts: SyncCounts = { created: 0, updated: 0, deleted: 0 };
  const cal = encodeURIComponent(calendarId);

  for (const item of items) {
    const eventId = eventIdFor(item.id);

    if (item.active === false) {
      const gone = await gapi("removing an event", `${CAL}/calendars/${cal}/events/${eventId}`, {
        method: "DELETE",
      })
        .then(() => true)
        .catch((err: { status?: number }) => {
          // 404/410: already gone, which is the state we wanted.
          if (err.status === 404 || err.status === 410) return false;
          throw err;
        });
      if (gone) counts.deleted++;
      continue;
    }

    const body = {
      id: eventId,
      summary: item.title,
      description: item.description ?? "",
      start: { date: item.date },
      end: { date: nextDay(item.date) },
      ...(item.colorId ? { colorId: item.colorId } : {}),
    };

    // PUT first: the common case after the first sync is "this already exists".
    try {
      await gapi("updating an event", `${CAL}/calendars/${cal}/events/${eventId}`, { method: "PUT", json: body });
      counts.updated++;
    } catch (err) {
      if ((err as { status?: number }).status !== 404) throw err;
      try {
        await gapi("creating an event", `${CAL}/calendars/${cal}/events`, { method: "POST", json: body });
        counts.created++;
      } catch (err2) {
        // 409: the id is a deleted event's tombstone. Update it instead of
        // inserting, or a re-added task fails forever.
        if ((err2 as { status?: number }).status !== 409) throw err2;
        await gapi("reviving an event", `${CAL}/calendars/${cal}/events/${eventId}`, {
          method: "PUT",
          json: { ...body, status: "confirmed" },
        });
        counts.created++;
      }
    }
  }

  await rememberCalendar(calendarId);
  return counts;
}

/**
 * A row's uuid as a Google event id (base32hex, 5 to 1024 chars). A uuid just
 * loses its dashes; anything else is hashed into the alphabet for a stable id.
 */
export function eventIdFor(rowId: string): string {
  const hex = rowId.replace(/-/g, "").toLowerCase();
  if (/^[0-9a-f]{16,}$/.test(hex)) return `hl${hex}`;
  const digest = new Bun.CryptoHasher("sha256").update(rowId).digest("hex");
  return `hl${digest.slice(0, 32)}`;
}

/** Google's all-day `end` is exclusive: a one-day event ends the next morning. */
export function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Which colour a department's events wear, so a full calendar stays readable. */
export function colorFor(department: string): string {
  switch (department) {
    case "digital-marketing":
      return "9"; // blueberry
    case "press":
      return "6"; // tangerine
    case "promotion":
      return "4"; // flamingo — played, next to written-about
    case "rights":
      return "3"; // grape
    case "distribution":
      return "7"; // peacock
    case "presskit":
      return "10"; // basil
    case "label-manager":
      return "11"; // tomato — the release itself
    default:
      return "1"; // lavender
  }
}
