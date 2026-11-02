/**
 * Writes an interview's answers into the artist's tables as they arrive, not
 * at the end, since interviews are often abandoned. Only slots with a `to`
 * are written.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Answers, Flow } from "./core";

export interface Writer {
  upsert(table: string, row: Record<string, unknown>, conflict?: string[]): Promise<Record<string, unknown>>;
  query<T>(table: string, filter?: Record<string, unknown>, opts?: { limit?: number }): Promise<T[]>;
}

/** Where one write landed, in words the artist can act on. */
export interface Saved {
  table: string;
  columns: string[];
  /** The command that reads it back. Said out loud every time — see below. */
  howToRead: string;
}

/**
 * Persist whatever these answers declare a home for. Returns what was written
 * so the caller can tell the artist where it is saved.
 */
export async function persist(flow: Flow, answers: Answers, w: Writer): Promise<Saved[]> {
  // One row per table: several columns of the same release are one upsert.
  const rows = new Map<string, { row: Record<string, unknown>; conflict: string[] }>();
  for (const q of flow.questions) {
    if (!q.to) continue;
    const value = answers[q.id];
    if (value === undefined) continue;
    // "i'm not sure" means the question is still open, so nothing is written.
    if (typeof value === "string" && /^(i'?m not sure|i don'?t know|unknown|not sure)/i.test(value.trim())) continue;
    const at = rows.get(q.to.table) ?? { row: {}, conflict: q.to.conflict ?? [] };
    at.row[q.to.column] = value;
    if (q.to.conflict?.length) at.conflict = q.to.conflict;
    rows.set(q.to.table, at);
  }

  const saved: Saved[] = [];
  for (const [table, { row, conflict }] of rows) {
    // A row that is only its own key carries no information; skip it.
    const real = Object.keys(row).filter((c) => !conflict.includes(c));
    if (!real.length) continue;

    // Look up, then write, never ON CONFLICT: `artist.releases` has no unique
    // index on `title` (a single and its album can share a name). Match the key
    // here and update by primary key, so a rerun never duplicates a row.
    let key: Record<string, unknown> | null = null;
    if (conflict.length && conflict.every((c) => row[c] !== undefined)) {
      key = Object.fromEntries(conflict.map((c) => [c, row[c]]));
      const [existing] = await w.query<{ id?: string }>(table, key, { limit: 1 });
      if (existing?.id) {
        await w.upsert(table, { ...row, id: existing.id }, ["id"]);
        saved.push({ table: `artist.${table}`, columns: Object.keys(row), howToRead: `bun run artist:get ${table}` });
        continue;
      }
    }
    await w.upsert(table, row);
    saved.push({
      table: `artist.${table}`,
      columns: Object.keys(row),
      howToRead: `bun run artist:get ${table}`,
    });
  }
  return saved;
}
