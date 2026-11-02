/**
 * The interview as a pure function: state in, state out. No disk, database or
 * printing, so the terminal (`cli.ts`) and a future web front end share one
 * implementation. Every question has a `type` so one web component can render
 * every department's interview.
 *
 *   const a = step(FLOW, emptyState());                         // ask question 1
 *   const b = step(FLOW, a.state, { id: "title", raw: "..." }); // answer, ask 2
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

export type Lang = "en" | "fr";

/**
 * What a renderer needs to draw the input. The terminal ignores it; a web
 * wizard picks the widget from it.
 */
/**
 * `image` and `url` both carry strings, comma- or newline-separated. An
 * `image` answer goes to vision; a `url` answer is fetched and parsed.
 * `longtext` is multi-paragraph (e.g. a bio).
 */
export type QuestionType =
  | "text"
  | "longtext"
  | "choice"
  | "date"
  | "money"
  | "multi"
  | "track"
  | "url"
  | "image";

export type Answer = string | string[];
export type Answers = Record<string, Answer>;

export interface Question {
  id: string;
  /**
   * Sort key, not a label: a question can be inserted at 5.5 without renumbering.
   */
  order: number;
  ask: Record<Lang, string>;
  /** Two or three words naming the topic, for the "Question 3 of 11 — …" line. */
  topic: Record<Lang, string>;
  type: QuestionType;
  options?: string[];
  /** An unanswered required question blocks whatever the interview feeds. */
  required: boolean;
  /**
   * Accept a near-miss (unique prefix or one typo) as the option it meant. Off
   * by default: terms of art and `url` questions want a rejection, not a guess.
   */
  forgiving?: boolean;
  /** Which branches each answer opens. Keys are answer values. */
  opens?: Record<string, string[]>;
  /** Why this question exists, for the artist who asks. */
  because: string;
  /** Asked only when this holds. Absent = always asked. */
  showIf?: (a: Answers) => boolean;
  /**
   * The answers `showIf` reads. Used only for the denominator: while a
   * dependency is unanswered the question might still be asked, so it counts
   * and the total only ever shrinks.
   */
  dependsOn?: string[];
  /**
   * Where the artist's own data already answers this. Declarative so
   * `questions.ts` stays data; `offers.ts` does the reading. An offer goes to
   * `offered`, not `answers`, unless `adopt` is set. `latest` takes the most
   * recent row by the table's own ordering.
   */
  from?: { table: string; column: string; latest?: boolean };
  /**
   * Where this answer is persisted (the mirror of `from`), written by
   * `persist.ts`. `conflict` names the columns that decide update vs insert;
   * without it every run inserts a new row.
   */
  to?: { table: string; column: string; conflict?: string[] };
}

/** What the artist's own data already offers. Offered, never adopted silently. */
export interface Offer {
  value: Answer;
  /** In the artist's words: "you're based in QC". Shown beside the suggestion. */
  from: string;
  /**
   * Take the offer as the answer instead of asking. It still appears in the
   * summary with its `from` line and can be overridden. Use only where the
   * data is authoritative (not budgets, for example).
   */
  adopt?: boolean;
}

/** Everything the interview knows. Serializable: JSON in, JSON out. */
export interface State {
  answers: Answers;
  lang: Lang;
  offered: Record<string, Offer>;
  /** Set once saved, so a second save updates instead of duplicating. */
  savedId?: string;
}

export interface Flow {
  /** The skill this interview belongs to, e.g. "manager-scope-project". */
  name: string;
  questions: Question[];
  /**
   * An answer that switches the language of the remaining questions. Return a
   * lang to switch, null to leave it.
   */
  langFrom?: (a: Answers) => Lang | null;
}

export interface Step {
  /** null means the interview has everything it can ask for. */
  question: Question | null;
  state: State;
  /** `n` is 1-based and only meaningful while `question` is set. */
  progress: { n: number; total: number };
  /** Required questions still unanswered. Non-empty blocks the next stage. */
  missing: string[];
  /** The branches the answers so far select. Deterministic: same in, same out. */
  branches: string[];
  /**
   * Set when the input was rejected. `state` is returned unchanged and
   * `question` is the same one again.
   */
  error?: string;
}

export const emptyState = (lang: Lang = "en"): State => ({ answers: {}, lang, offered: {} });

/**
 * The questions that apply to this artist, in order. `showIf` drops the ones
 * their answers have made meaningless.
 */
export function askable(flow: Flow, answers: Answers): Question[] {
  return flow.questions
    .filter((q) => !q.showIf || q.showIf(answers))
    .sort((a, b) => a.order - b.order);
}

/**
 * The most questions this interview will ask. A conditional question whose
 * dependency is still open counts, so the denominator never grows.
 */
export function plannedTotal(flow: Flow, answers: Answers): number {
  return flow.questions.filter(
    (q) =>
      !q.showIf ||
      q.showIf(answers) ||
      (q.dependsOn ?? []).some((d) => answers[d] === undefined),
  ).length;
}

/** Required questions still unanswered. */
export function missingRequired(flow: Flow, answers: Answers): string[] {
  return askable(flow, answers)
    .filter((q) => q.required)
    .filter((q) => {
      const v = answers[q.id];
      return v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);
    })
    .map((q) => q.id);
}

/** The branches a set of answers selects. */
export function branchesFor(flow: Flow, answers: Answers): string[] {
  const out = new Set<string>();
  for (const q of flow.questions) {
    const given = answers[q.id];
    if (given === undefined) continue;
    for (const value of Array.isArray(given) ? given : [given]) {
      for (const branch of q.opens?.[value] ?? []) out.add(branch);
    }
  }
  return [...out];
}

/** The words that mean "I don't know" in both languages. All are real answers. */
const DUNNO = new Set([
  "unknown", "none", "no", "nothing", "idk", "dunno",
  "je ne sais pas", "sais pas", "rien", "non", "aucune", "aucun",
]);

/** Dates: a full day, a month aimed at, or nothing yet. All three are answers. */
function normalizeDate(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (DUNNO.has(v)) return "unknown";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{4}-\d{2}$/.test(v)) return `${v}-01`;
  return raw.trim();
}

/**
 * The artist's typing, turned into a comparable value.
 *
 * A `multi` answer splits on whitespace as well as commas, so every `choice`
 * and `multi` option must be lowercase and every `multi` option a single
 * token. Put readable phrasing in `ask:`. Enforced by `load.test.ts`.
 */
/**
 * The option an answer obviously meant, or the answer unchanged: exact match,
 * then unique prefix, then one typo. Two options within a typo of each other
 * both lose. Opt-in per question (`forgiving: true`).
 */
function closestOption(options: string[], v: string): string {
  if (options.includes(v)) return v;
  const starts = options.filter((o) => o.startsWith(v) || v.startsWith(o));
  if (starts.length === 1 && v.length >= 3) return starts[0]!;
  const near = options.filter((o) => editDistance(o, v) <= (v.length > 6 ? 2 : 1));
  return near.length === 1 ? near[0]! : v;
}

/** Levenshtein, iterative, two rows. Option lists are short; this is never hot. */
function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length]!;
}

export function normalize(q: Question, raw: string): Answer {
  if (q.type === "date") return normalizeDate(raw);
  const opts = q.forgiving ? q.options : undefined;
  if (q.type === "multi") {
    const words = raw
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!opts) return words;

    // With known options, keep only words that are options, so "songwriter and
    // performer" does not fail on "and". If nothing matches, return the raw
    // words so `validate` reports what could not be used.
    const picked = [...new Set(words.map((w) => closestOption(opts, w)).filter((w) => opts.includes(w)))];
    return picked.length ? picked : words;
  }
  if (q.type === "choice") {
    const v = raw.trim().toLowerCase();
    return opts ? closestOption(opts, v) : v;
  }
  if (q.type === "choice") return raw.trim().toLowerCase();
  if (q.type === "url" || q.type === "image") {
    const v = raw.trim().toLowerCase();
    if (DUNNO.has(v)) return [];
    // Split on newlines first: a pasted list arrives one per line, and a URL
    // may contain a comma.
    return raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  }
  // `longtext` keeps the artist's paragraph breaks.
  return raw.trim();
}

/**
 * Whether one `url`/`image` entry can be acted on. Images may be a local
 * path. Nothing is fetched here: the core touches no network.
 */
function usable(type: QuestionType, raw: string): boolean {
  const v = raw.trim();
  if (!v) return false;
  if (/^https?:\/\//i.test(v)) {
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  }
  // A bare path only counts for images, and only when it looks like a file.
  return type === "image" && /\.(png|jpe?g|webp|gif|heic|avif)$/i.test(v);
}

/** null when the value is usable. A string is what the artist is told. */
export function validate(q: Question, value: Answer): string | null {
  const opts = q.options;
  if (opts?.length) {
    const given = Array.isArray(value) ? value : [value];
    const bad = given.filter((v) => v !== "unknown" && !opts.includes(v));
    if (bad.length) return `${bad.join(", ")} — I can take: ${opts.join(", ")}`;
  }
  if (q.type === "url" || q.type === "image") {
    const given = Array.isArray(value) ? value : [value];
    const bad = given.filter((v) => !usable(q.type, String(v)));
    if (bad.length) {
      return q.type === "url"
        ? `${bad.join(", ")} — I need a full link starting with http:// or https://`
        : `${bad.join(", ")} — I need an image link, or the path to a file on your machine`;
    }
  }
  if (q.type === "date" && typeof value === "string" && value !== "unknown") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `"${value}" isn't a date I can use — give me 2027-04-16, or 2027-04 for a month, or say you don't know`;
    }
  }
  return null;
}

/**
 * One turn: reads the state, optionally applies one answer, returns the next
 * question. Never mutates its input.
 */
export function step(flow: Flow, state: State, input?: { id: string; raw: string }): Step {
  let next: State = { ...state, answers: { ...state.answers }, offered: { ...state.offered } };

  if (input) {
    const q = flow.questions.find((x) => x.id === input.id);
    if (!q) return { ...view(flow, state), error: `No question called "${input.id}".` };

    const value = normalize(q, input.raw);
    const bad = validate(q, value);
    // Nothing is written on a bad answer; the same question is re-asked.
    if (bad) return { ...view(flow, state), error: bad };

    next.answers[q.id] = value;
    // An offer that has been answered is no longer an offer.
    delete next.offered[q.id];
    const lang = flow.langFrom?.(next.answers);
    if (lang) next.lang = lang;
  }

  return view(flow, next);
}

/** The read half of `step`, so both paths compute the same numbers. */
function view(flow: Flow, state: State): Step {
  const list = askable(flow, state.answers);
  const question = list.find((q) => state.answers[q.id] === undefined) ?? null;
  return {
    question,
    state,
    progress: {
      n: question ? list.indexOf(question) + 1 : list.length,
      total: plannedTotal(flow, state.answers),
    },
    missing: missingRequired(flow, state.answers),
    branches: branchesFor(flow, state.answers),
  };
}

/** Merge what the artist's own data offers. Offers never become answers. */
export function withOffers(state: State, offered: Record<string, Offer>, lang?: Lang): State {
  const merged = { ...offered, ...state.offered };
  const answers = { ...state.answers };

  // An `adopt` offer becomes the answer outright. Its entry also stays in
  // `offered`, because the summary reads the provenance line from there.
  for (const [id, offer] of Object.entries(merged)) {
    if (offer.adopt && answers[id] === undefined) answers[id] = offer.value;
  }

  return {
    ...state,
    lang: lang ?? state.lang,
    answers,
    // An already-answered question keeps its answer; an offer cannot overwrite one.
    offered: Object.fromEntries(
      Object.entries(merged).filter(([id, o]) => o.adopt || state.answers[id] === undefined),
    ),
  };
}
