/**
 * The scoping questions and the branches each answer opens. Single source of
 * truth (SKILL.md does not restate them); deterministic, so the same answers
 * always select the same branches. Order is dependency order; array position
 * matches `order`. Lead times live in knowledge/release-fundamentals.md. No
 * question count is part of the contract: `askable()` returns the list.
 */

export type QuestionId =
  | "title"
  | "covers"
  | "project_type"
  | "street_date"
  | "markets"
  | "physical"
  | "recording_status"
  | "lead_single"
  | "lead_single_date"
  | "masters_ready"
  | "budget"
  | "merch";

/** A phase the plan may contain. Owners are in knowledge/release-path.md. */
export type Branch =
  | "creation"
  | "rights"
  | "manufacturing"
  | "distribution"
  | "presskit"
  | "press"
  | "campaign"
  | "merch"
  | "post_release";

export interface Question {
  id: QuestionId;
  /** Sort key, not a label: lets a question be inserted at 5.5 without renumbering. */
  order: number;
  ask: { en: string; fr: string };
  /** Two or three words naming the topic, for the "Question 3 of 11 — ..." line. */
  topic: { en: string; fr: string };
  type: "choice" | "date" | "money" | "track" | "multi" | "text";
  options?: string[];
  /** An unanswered required question blocks manager-plan-release. */
  required: boolean;
  /** Which branches each answer opens. `*` means any non-empty answer. */
  opens: Partial<Record<string, Branch[]>>;
  /** Why this question exists, for the artist who asks. */
  because: string;
  /** Asked only when this holds. Absent = always asked. */
  showIf?: (answers: Partial<Record<QuestionId, unknown>>) => boolean;
  /**
   * The answers `showIf` reads. While one is unanswered the question still
   * counts in "Question n of total", so the total only ever shrinks.
   */
  dependsOn?: QuestionId[];
}

export const QUESTIONS: Question[] = [
  {
    id: "title",
    order: 1,
    ask: {
      en: "What's this project called? A working title is fine.",
      fr: "Ça s'appelle comment ? Un titre de travail, c'est correct.",
    },
    topic: { en: "the name", fr: "le nom" },
    type: "text",
    required: true,
    opens: {},
    because:
      "The plan, the page and every handoff are named after it. artist.projects.title is not nullable, so there is no scoping a project without one.",
  },
  {
    id: "project_type",
    order: 2,
    ask: {
      en: "What are you putting out — a single, an EP or an album?",
      fr: "Qu'est-ce que tu sors — un single, un EP ou un album ?",
    },
    topic: { en: "what it is", fr: "c'est quoi" },
    type: "choice",
    options: ["single", "ep", "album"],
    required: true,
    opens: {
      single: ["creation", "rights", "distribution", "campaign", "post_release"],
      ep: ["creation", "rights", "distribution", "presskit", "press", "campaign", "post_release"],
      album: ["creation", "rights", "distribution", "presskit", "press", "campaign", "post_release"],
    },
    because: "Sets which phases can exist at all.",
  },
  {
    id: "street_date",
    order: 3,
    ask: {
      en: "Do you have a release date, a target month, or nothing yet?",
      fr: "As-tu une date de sortie, un mois visé, ou rien encore ?",
    },
    topic: { en: "the release date", fr: "la date de sortie" },
    type: "date",
    required: true,
    opens: {},
    because: "The anchor. Every other date is counted backward from it.",
  },
  {
    id: "markets",
    order: 4,
    ask: {
      en: "Where are you releasing — Quebec, rest of Canada, the US, or a mix?",
      fr: "Où sors-tu ça — Québec, reste du Canada, États-Unis, ou un mélange ?",
    },
    topic: { en: "where it comes out", fr: "où ça sort" },
    type: "multi",
    options: ["quebec", "canada", "usa"],
    required: true,
    opens: {},
    because:
      "Decides the language of every draft and which institutions and deadlines " +
      "exist at all. Asked early, ahead of the long pole, because it sets the " +
      "language every remaining question is asked in.",
  },
  {
    id: "physical",
    order: 5,
    ask: {
      en: "Are you pressing anything physical — vinyl, CD, both, or neither?",
      fr: "Est-ce que tu presses du physique — vinyle, CD, les deux, ou rien ?",
    },
    topic: { en: "physical copies", fr: "les copies physiques" },
    type: "choice",
    options: ["none", "vinyl", "cd", "both"],
    required: true,
    opens: {
      vinyl: ["manufacturing"],
      cd: ["manufacturing"],
      both: ["manufacturing"],
    },
    because:
      "Vinyl is the longest lead time in a release and therefore sets where the plan starts.",
  },
  {
    id: "covers",
    order: 5.5,
    ask: {
      en: "Any covers on this — songs someone else wrote?",
      fr: "Des reprises là-dedans — des chansons écrites par quelqu'un d'autre ?",
    },
    topic: { en: "covers", fr: "reprises" },
    type: "choice",
    options: ["yes", "no"],
    required: false,
    opens: {},
    because:
      "A cover on a physical release needs a mechanical licence, and CMRRA's application asks for the pressing invoice — so it sits WITH the pressing order, not after it. Streaming needs nothing: the services pay CMRRA directly.",
    dependsOn: ["physical"],
    showIf: (a) => a.physical !== undefined && a.physical !== "none",
  },
  {
    id: "recording_status",
    order: 6,
    ask: {
      en: "Where is the music — not started, tracking, mixing, mastered, or already delivered?",
      fr: "Où en est la musique — pas commencée, en enregistrement, en mixage, masterisée, ou déjà livrée ?",
    },
    topic: { en: "where the music is at", fr: "où en est la musique" },
    type: "choice",
    options: ["not_started", "tracking", "mixing", "mastered", "delivered"],
    required: true,
    opens: {
      not_started: ["creation"],
      tracking: ["creation"],
      mixing: ["creation"],
    },
    because:
      "Decides where the plan starts. The plan books time for these; it never advises on them.",
  },
  {
    id: "masters_ready",
    order: 7,
    ask: {
      en: "When do you expect the mix and master to be finished? A guess is fine — \"I don't know\" is also an answer.",
      fr: "Le mix et le master, tu les vois finis quand ? Une estimation suffit — « je ne sais pas » est aussi une réponse.",
    },
    topic: { en: "when the master lands", fr: "quand le master arrive" },
    type: "date",
    required: false,
    opens: {},
    because:
      "The one date in a release nobody can source. No studio publishes a mix or mastering turnaround (knowledge/release-fundamentals.md), so the plan asks rather than inventing a number. Unanswered, phase 1 ships with a deadline and no estimate.",
    dependsOn: ["recording_status"],
    showIf: (a) =>
      ["not_started", "tracking", "mixing"].includes(String(a.recording_status ?? "")),
  },
  {
    id: "lead_single",
    order: 8,
    ask: {
      en: "Which track leads? You get one editorial pitch per release, and only before it goes live.",
      fr: "Quelle pièce mène ? Tu as un seul pitch éditorial par sortie, et seulement avant la mise en ligne.",
    },
    topic: { en: "the lead single", fr: "le single" },
    type: "track",
    required: false,
    opens: {},
    because:
      "Spotify allows one pitch at a time and none after release, so this is a scoping decision, not a marketing one.",
  },
  {
    id: "lead_single_date",
    order: 9,
    ask: {
      en: "When does that single come out?",
      fr: "Elle sort quand, cette pièce-là ?",
    },
    topic: { en: "the single's date", fr: "la date du single" },
    type: "date",
    required: false,
    opens: {},
    because:
      "A pre-release single has its own street date, and therefore its own delivery floor and its own editorial pitch. That date binds before the record's does.",
    dependsOn: ["lead_single", "project_type"],
    showIf: (a) =>
      !!a.lead_single && a.lead_single !== "unknown" && a.project_type !== "single",
  },
  {
    id: "budget",
    order: 10,
    ask: {
      en: "What's the budget for this, and in which currency? A number works, and so does \"not much — tell me what it costs\".",
      fr: "Quel est le budget, et dans quelle devise ? Un chiffre marche, et « pas grand-chose — dis-moi ce que ça coûte » aussi.",
    },
    topic: { en: "budget", fr: "budget" },
    type: "money",
    required: false,
    opens: {},
    because:
      "The plan is priced in three tiers — bare, decent, full — from the departments' published prices, and this number is what the tiers are read against. A number lands as the budget; anything else lands as none, and the plan answers with the tiers and asks which one.",
  },
  {
    id: "merch",
    order: 11,
    ask: {
      en: "Any merch for this release?",
      fr: "Du merch pour cette sortie ?",
    },
    topic: { en: "merch", fr: "merch" },
    type: "choice",
    options: ["yes", "no"],
    required: false,
    opens: { yes: ["merch"] },
    because:
      "No department owns merch. The window is reserved and the gap is named.",
  },
];

/**
 * Refuse a bad answer before anything is written. Choice answers are
 * CHECK-constrained in the schema; catching e.g. `physical: "vinyle"` here
 * avoids failing at save time after the whole interview.
 */
export function validate(q: Question, value: string | string[]): string | null {
  const opts = q.options;
  if (opts?.length) {
    const given = Array.isArray(value) ? value : [value];
    const bad = given.filter((v) => v !== "unknown" && !opts.includes(v));
    if (bad.length) return `${bad.join(", ")} — I can take: ${opts.join(", ")}`;
  }
  if (q.type === "date" && typeof value === "string" && value !== "unknown") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `"${value}" isn't a date I can use — give me 2027-04-16, or 2027-04 for a month, or say you don't know`;
    }
  }
  return null;
}

/** The questions that apply to this artist, in order; `showIf` drops the rest. */
export function askable(answers: Partial<Record<QuestionId, unknown>>): Question[] {
  return QUESTIONS.filter((q) => !q.showIf || q.showIf(answers)).sort((a, b) => a.order - b.order);
}

/**
 * The most questions this interview can still ask. A conditional question
 * with an open dependency counts, so the total never grows.
 */
export function plannedTotal(answers: Partial<Record<QuestionId, unknown>>): number {
  return QUESTIONS.filter(
    (q) =>
      !q.showIf ||
      q.showIf(answers) ||
      (q.dependsOn ?? []).some((d) => answers[d] === undefined),
  ).length;
}

/** Required questions still unanswered. Non-empty blocks manager-plan-release. */
export function missingRequired(answers: Partial<Record<QuestionId, unknown>>): QuestionId[] {
  return askable(answers).filter((q) => q.required)
    .filter((q) => answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === "")
    .map((q) => q.id);
}

/** The branches a set of answers selects. Deterministic: same in, same out. */
export function branchesFor(answers: Partial<Record<QuestionId, string | string[]>>): Branch[] {
  const out = new Set<Branch>();
  for (const q of QUESTIONS) {
    const given = answers[q.id];
    if (given === undefined) continue;
    for (const value of Array.isArray(given) ? given : [given]) {
      for (const branch of q.opens[value] ?? []) out.add(branch);
    }
  }
  return [...out];
}
