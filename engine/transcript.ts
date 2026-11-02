/**
 * A record of one sitting, written only when the artist asks for it, so a bug
 * report is evidence. Off by default; `.transcripts/` is gitignored.
 * One JSON object per line, append-only, so a crashed session keeps its turns.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./agent";

export interface Transcript {
  path: string;
  /** One exchange, plus what the engine made of it. */
  turn(entry: {
    said: string;
    replied: string;
    /** The checklist AFTER this turn: what is known, what is still open. */
    filled?: Record<string, unknown>;
    missing?: string[];
    /**
     * greeting · interview · work · chat: what the engine thought it was doing.
     * Distinguishes an empty `work` reply (step budget spent on tools) from a crash.
     */
    phase?: string;
    /** Which skill was running, when one was picked. */
    task?: string;
  }): void;
  /** The artist's own comment on the turn above, from `/note`. */
  note(text: string): void;
}

/** Null when logging was not asked for, so every call site stays one `?.`. */
export function openTranscript(dept: string, on: boolean): Transcript | null {
  if (!on) return null;
  const dir = join(ROOT, ".transcripts");
  mkdirSync(dir, { recursive: true });
  // Seconds in the name: two sittings with the same department in one minute
  // are a normal way to reproduce something.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const path = join(dir, `${dept}-${stamp}.jsonl`);
  const write = (o: unknown) => appendFileSync(path, `${JSON.stringify(o)}\n`);
  write({ at: new Date().toISOString(), dept, event: "start" });
  return {
    path,
    turn(entry) {
      write({ at: new Date().toISOString(), ...entry });
    },
    note(text) {
      write({ at: new Date().toISOString(), event: "note", note: text });
    },
  };
}
