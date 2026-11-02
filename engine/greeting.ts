/**
 * The department's greeting and how the artist's first sentence is routed.
 * Generated from the department's skills, so it cannot drift from `skills:`.
 * Uses each skill's `greeting:` clause, not `description:`, which is trigger
 * text written for a model.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { generateText, type LanguageModel } from "ai";
import type { Department, Skill } from "./agent";
import type { Lang } from "./interview/core";

/** One thing the department offers to run, in the artist's words. */
export interface Offer {
  skill: string;
  /** The clause after "I can". */
  line: string;
}

const T = {
  en: {
    hey: (who: string) => `Hey! I'm ${who}.`,
    can: (offers: string[], talk: string) => `I can ${offers.join(", ")}, or just ${talk}.`,
    only: (talk: string) => `Nothing to run for you yet, but you can ${talk}.`,
    ask: "What do you want to do today?",
    talk: (dept: string) => `ask me anything about ${dept.toLowerCase()}`,
  },
  fr: {
    hey: (who: string) => `Salut ! Je suis ${who}.`,
    can: (offers: string[], talk: string) => `Je peux ${offers.join(", ")}, ou simplement ${talk}.`,
    only: (talk: string) => `Je ne peux encore rien lancer pour toi, mais tu peux ${talk}.`,
    ask: "Qu'est-ce que tu veux faire aujourd'hui ?",
    talk: (dept: string) => `me poser tes questions sur ${dept.toLowerCase()}`,
  },
} as const;

/**
 * The clause a skill contributes, in the artist's language. Falls back to the
 * text after the em dash in `description`; a task with no `greeting:` is a
 * blocker engine/modes.ts reports.
 */
export function lineFor(skill: Skill, lang: Lang): string {
  const written = lang === "fr" ? (skill.greetingFr ?? skill.greeting) : skill.greeting;
  if (written) return written;
  const afterDash = skill.description.split(/\s[—–-]\s/).slice(1).join(" — ").trim();
  return (afterDash || skill.description).replace(/\s*Triggers on.*$/s, "").replace(/\.$/, "").trim();
}

/**
 * "The Distribution Agent" → "the Distribution Agent", for use mid-sentence;
 * in French, "l'agent Distribution".
 */
const inSentence = (staff: string, lang: Lang): string =>
  lang === "fr"
    ? `l'agent ${staff.replace(/^The\s+/, "").replace(/\s+Agent$/, "")}`
    : staff.replace(/^The\b/, "the");

/**
 * Everything the department offers to run, in roster order. A skill with no
 * `greeting:` line and no `mode:` is not offered to the artist.
 */
export function offers(dept: Department, lang: Lang = "en"): Offer[] {
  return dept.skills
    .filter((s) => s.mode === "task" || s.greeting)
    .map((s) => ({ skill: s.name, line: lineFor(s, lang) }));
}

/** The "or just …" clause: AGENT.md's `discuss:` line, else a plain fallback. */
export function talkLine(dept: Department, lang: Lang = "en"): string {
  const written = lang === "fr" ? (dept.discussFr ?? dept.discuss) : dept.discuss;
  return written ?? T[lang].talk(dept.department);
}

/**
 * The whole greeting, ready to print. One paragraph, no headings, no numbers.
 */
export function renderGreeting(dept: Department, lang: Lang = "en"): string {
  const t = T[lang];
  const who = inSentence(dept.staffMember, lang);
  const lines = offers(dept, lang).map((o) => o.line);
  const middle = lines.length ? t.can(lines, talkLine(dept, lang)) : t.only(talkLine(dept, lang));
  return `${t.hey(who)} ${middle} ${t.ask}`;
}

/** The value `route` returns when the sentence is a conversation, not a job. */
const TALK = "TALK";

/** One classification call: system, prompt → the model's bare answer. */
export type Ask = (system: string, prompt: string) => Promise<string>;

const viaModel =
  (model: LanguageModel): Ask =>
  async (system, prompt) => {
    // Deterministic: the same sentence must start the same task every time.
    const res = await generateText({ model, temperature: 0, system, prompt });
    return res.text;
  };

/**
 * Resolves what the artist typed: a clear request for a `mode: task` skill
 * starts it; anything else, including a model failure, is `chat`. The bias is
 * toward talk, since a wrongly started interview costs more than one more sentence.
 * `lastSaid` gives context, e.g. "yes please" after an offer.
 */
export async function route(
  dept: Department,
  input: string,
  opts: { model: LanguageModel; lastSaid?: string; ask?: Ask },
): Promise<{ task: string } | { chat: true }> {
  const tasks = dept.skills.filter((s) => s.mode === "task");
  if (!tasks.length || !input.trim()) return { chat: true };
  const lastSaid = opts.lastSaid ?? "";
  const ask = opts.ask ?? viaModel(opts.model);

  let out = "";
  try {
    out = (
      await ask(
        "You read what a musician just typed to a staff member at their label and decide whether they asked " +
        "for one of the jobs that staff member can run. You are not talking to them.\n\n" +
        "Return ONLY one value from the list, exactly as written: the id of the job they asked for, or the " +
        `single word ${TALK}.\n\n` +
        `Return ${TALK} when they asked a question, want to talk something through, gave information, ` +
        "or when it is genuinely ambiguous which job they mean. Read for MEANING, not for words: " +
        "\"how do distributors get paid\" is a question, not a request to compare them; \"yes, do that\" " +
        "right after the staff member offered a job is that job.\n\n" +
        `Never pick the nearest job to avoid ${TALK}. A job started on a guess is an interview the ` +
        "artist did not ask for; a question answered when they wanted the job costs them one more sentence.",
        `Jobs this staff member can run:\n${tasks.map((t) => `${t.name} — ${lineFor(t, "en")}`).join("\n")}\n` +
          `${TALK} — a question, a conversation, or anything else\n\n` +
          (lastSaid.trim() ? `The staff member last said: ${lastSaid.trim().slice(0, 600)}\n` : "") +
          `They typed: ${input.trim()}`,
      )
    ).trim();
  } catch {
    return { chat: true };
  }

  // Only accept a value that is exactly one of the tasks.
  const hit = tasks.find((t) => t.name === out || out.split(/\s+/)[0] === t.name);
  return hit ? { task: hit.name } : { chat: true };
}
