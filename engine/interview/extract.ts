/**
 * Reads a whole reply for every open slot it answers. A reply can fill
 * several slots or none.
 *
 * The strict half of a pair: this fills slots nobody just asked about, where a
 * wrong fill is never re-asked. `interpret()` is the generous half, for the
 * question just put to them. One prompt cannot do both jobs.
 * Nothing is adopted without passing `validate()`; values outside `options` are dropped.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { generateText, type LanguageModel } from "ai";
import { askable, normalize, validate, type Answers, type Flow, type Lang, type Question } from "./core";

/** What one reply turned out to contain. */
export interface Extraction {
  /** Slot id → the value, already normalized and validated. */
  filled: Answers;
  /** Ids the model proposed and `validate()` refused. Kept for the log, not shown. */
  rejected: string[];
}

const describe = (q: Question, lang: Lang): string =>
  `- ${q.id} (${q.type}${q.required ? ", needed" : ", optional"}): ${q.ask[lang]}` +
  (q.options?.length ? `\n    one of: ${q.options.join(" | ")}` : "");

/**
 * Everything this reply answered, across every slot still open. `open` comes
 * from the answers so far, so a locked `showIf` slot is never filled.
 */
export async function extract(
  model: LanguageModel,
  flow: Flow,
  answers: Answers,
  said: string,
  lang: Lang,
  /**
   * What the staff member said immediately before. Needed to place short
   * replies ("5k", "EP + Album") in the right slot.
   */
  asked?: string,
): Promise<Extraction> {
  const open = askable(flow, answers).filter((q) => answers[q.id] === undefined);
  if (!open.length || !said.trim()) return { filled: {}, rejected: [] };

  const res = await generateText({
    model,
    temperature: 0,
    system:
      "You read one thing a musician said and note which items on a checklist it answered.\n\n" +
      "Return one line per item you can fill, exactly `id: value <- quoted words`, where the quoted words are " +
      "copied CHARACTER FOR CHARACTER from their message and are the part that says it. Return the single word " +
      "NOTHING when the " +
      "message answers none of them — a question they asked, small talk, or a change of subject all mean NOTHING.\n\n" +
      "RULES\n" +
      "- Fill an item only when they actually said it. Never infer, never assume a default, never carry over " +
      "what a similar artist would say. An empty checklist is asked about again; a wrong entry never is.\n" +
      "- One message can fill several items. \"I was at Believe but I'm back independent\" says both which " +
      "situation they are in AND who they were with.\n" +
      "- Where an item lists allowed values, the value MUST be copied from that list exactly. Map their meaning " +
      "onto it: \"5k\" onto the band that contains 5,000; \"EP + Album\" onto the count that means two releases.\n" +
      "- The noun in the item is the unit. If it asks how many RELEASES, an EP and an album is two, not twelve tracks.\n" +
      "- For an item accepting several values, separate them with commas. Three answers to a three-way question " +
      "is three answers, not an error.\n" +
      "- Never fill an item they explicitly refused or deferred. \"skip that\" and \"not sure yet\" are not values.\n" +
      "- Use what was just asked ONLY to break a tie. A bare \"5k\" is ambiguous and belongs to the question it " +
      "answers; \"cost, reliability and store coverage\" is not ambiguous and belongs to whichever item it fits, " +
      "even if that is not the one just asked. Recency settles ties, it does not outrank meaning.\n" +
      "- Check EVERY open item against the message before you stop. Volunteering something nobody asked for is " +
      "normal conversation, and it is the whole reason this reads the whole list.\n" +
      "- Never fill an item because a word in the message resembles one of its allowed values. Someone naming " +
      "a grant programme has not told you their priorities.\n" +
      "- A NUMBER GOES IN THE BAND THAT CONTAINS IT. \"5k\" is 5,000: it belongs to a band running from 2,000 " +
      "to 10,000, NOT to one that starts above 10,000. Read both ends of every band before choosing.\n" +
      "- The quoted words are a check on you. If you cannot quote the exact part of their message that says an " +
      "item, you are inferring it — leave it out.\n" +
      "- READ THE QUOTE BACK BEFORE YOU RETURN IT. On its own, out of context, does it answer that item's " +
      "question? A file path does not say whether there are lyrics. \"not sure what i do next\" does not say " +
      "which identifiers they hold. A remark about their profile is not a remark about the release. All three " +
      "of those were filed as answers and none of them were.\n" +
      "- A message that is CONFUSED, frustrated, or asking for help fills nothing. \"I don't know\", \"can't you " +
      "see?\", \"what do I do now\" are states, not values — unless an item explicitly offers not-sure as one of " +
      "its allowed answers AND that is plainly what they mean about THAT item.",
    prompt:
      `The checklist, still open:\n${open.map((q) => describe(q, lang)).join("\n")}\n\n` +
      (asked ? `The staff member had just said:\n${asked.slice(-600)}\n\n` : "") +
      `They said: ${said}`,
  });

  return parseExtraction(open, said, res.text);
}

/**
 * Everything after the model answers: parse, check, validate. Separate from
 * the call so it can be tested without a network client.
 */
export function parseExtraction(open: Question[], said: string, text: string): Extraction {
  const filled: Answers = {};
  const rejected: string[] = [];
  // Punctuation and case differ between what they typed and what gets quoted
  // back; the words are what must match.
  const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9\u00c0-\u024f]+/gi, " ").trim();
  const said_ = words(said);

  for (const line of text.split("\n")) {
    const m = /^\s*-?\s*([a-z_][a-z0-9_]*)\s*:\s*(.+?)\s*(?:<-\s*"?(.*?)"?\s*)?$/i.exec(line);
    if (!m) continue;
    const q = open.find((x) => x.id === m[1]);
    if (!q) continue;

    // Evidence check: the model must quote words that are actually in the
    // message. A claim that cannot be quoted is dropped.
    const quote = words(m[3] ?? "");
    if (!quote || !said_.includes(quote)) { rejected.push(q.id); continue; }

    const value = normalize(q, m[2]!);
    // The pure core is still the authority. A proposal it refuses is dropped.
    if (validate(q, value)) rejected.push(q.id);
    else filled[q.id] = value;
  }
  return { filled, rejected };
}
