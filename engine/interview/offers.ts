/**
 * Builds `state.offered` from the artist's own data, so a question is not
 * asked when the answer is on file. Offered, never adopted (unless the
 * question sets `adopt`): `from` says where each value came from.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Flow, Offer } from "./core";

/** The narrow slice of the artist client this needs. Injected, so tests need no database. */
export interface OfferSource {
  query<T>(table: string, filter?: Record<string, unknown>, opts?: { orderBy?: string; limit?: number }): Promise<T[]>;
}

/** How a table names itself to the artist: "your profile", "your latest release". */
const SAYS: Record<string, string> = {
  profile: "your profile",
  memory: "what you told me before",
  releases: "your latest release",
  songs: "your song catalogue",
  saved_distributors: "the distributor on file",
  platforms: "your platform list",
};

/** Newest first, per table. A table with no obvious clock is left in its own order. */
const NEWEST: Record<string, string> = {
  releases: "release_date desc",
  saved_distributors: "saved_at desc",
  songs: "created_at desc",
};

export async function offersFor(flow: Flow, src: OfferSource): Promise<Record<string, Offer>> {
  const wanted = flow.questions.filter((q) => q.from);
  if (!wanted.length) return {};

  // One read per table, not one per question.
  const tables = [...new Set(wanted.map((q) => q.from!.table))];
  const rows = new Map<string, Record<string, unknown> | undefined>();
  for (const t of tables) {
    const got = await src
      .query<Record<string, unknown>>(t, {}, { orderBy: NEWEST[t], limit: 1 })
      .catch(() => []);
    rows.set(t, got[0]);
  }

  const offered: Record<string, Offer> = {};
  for (const q of wanted) {
    const row = rows.get(q.from!.table);
    const raw = row?.[q.from!.column];
    // Null, empty string and empty array all mean "not on file"; never offer a blank.
    if (raw == null || raw === "" || (Array.isArray(raw) && !raw.length)) continue;
    const value = raw instanceof Date
      ? raw.toISOString().slice(0, 10)
      : Array.isArray(raw)
        ? raw.map(String)
        : String(raw);
    offered[q.id] = { value, from: SAYS[q.from!.table] ?? `your ${q.from!.table}` };
  }
  return offered;
}
