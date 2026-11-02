/**
 * Maps a free-form reply onto one of a question's options, or null. Lives in
 * the adapter layer (called by `session.ts`) because `core.ts` touches no
 * model. Never invents a value or picks "the closest" outside the set.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { generateText, type LanguageModel } from "ai";
import type { Lang, Question } from "./core";

/** What the artist said, resolved to allowed values — or null when it cannot be. */
export async function interpret(
  model: LanguageModel,
  q: Question,
  said: string,
  lang: Lang,
): Promise<string | null> {
  const options = q.options ?? [];
  if (!options.length) return null;

  const multi = q.type === "multi";
  const res = await generateText({
    model,
    // Deterministic: the same sentence must map to the same value every time.
    temperature: 0,
    system:
      "You map what a musician said onto a fixed list of allowed values. You are not talking to them.\n\n" +
      "Return ONLY the matching value, exactly as written in the list. " +
      (multi ? "Several may apply — return them comma-separated.\n" : "Return exactly one.\n") +
      "Return the single word NONE when what they said does not correspond to any value in the list, " +
      "or when it is genuinely ambiguous between two.\n\n" +
      "Answer the question as written. If it asks how many RELEASES, an EP and an album is two — do not count " +
      "tracks. The noun in the question is the unit.\n\n" +
      "Read for MEANING, not for words. \"I was at Believe but I'm back independent, so nothing\" means they " +
      "are not with a distributor now — the past one is context, not the answer. \"probably 3 or 4\" answers a " +
      "range question. \"dunno\" and \"not sure\" map to an option that says so if the list has one, else NONE.\n\n" +
      "Never invent a value that is not in the list. Never pick the nearest one to avoid returning NONE: a wrong " +
      "value recorded silently is read by every later step as though they said it.",
    prompt:
      `Question: ${q.ask[lang]}\n` +
      `Allowed values: ${options.join(" | ")}\n` +
      `They said: ${said}`,
  });

  const out = res.text.trim();
  if (!out || /^none$/i.test(out)) return null;

  // A returned value must be one of the options exactly, or it is discarded,
  // so `validate()` still decides.
  const pick = (v: string) => options.find((o) => o.toLowerCase() === v.trim().toLowerCase());
  if (!multi) return pick(out) ?? null;

  const picks = out.split(",").map(pick).filter(Boolean) as string[];
  return picks.length ? picks.join(", ") : null;
}
