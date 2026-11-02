/**
 * What creative is being asked for, and for what.
 *
 * `scope` comes first: captions belong to a task, hashtag sets to the campaign,
 * so asking it first keeps the write in the right row. `deliverable` picks the
 * shape; later questions depend on those two answers.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Flow, Question } from "../../../../../engine/interview/core";

/** Which shape comes out, and therefore which section of the knowledge applies. */
export type Branch = "captions" | "ad_copy" | "hashtags" | "ideas";

export const QUESTIONS: Question[] = [
  {
    id: "scope",
    order: 1,
    ask: {
      en: "Is this for one task in the plan, or for the campaign as a whole?",
      fr: "C'est pour une tâche précise du plan, ou pour la campagne au complet ?",
    },
    topic: { en: "what it's for", fr: "c'est pour quoi" },
    type: "choice",
    options: ["task", "campaign"],
    required: true,
    because:
      "Decides which row the writing is saved onto. Captions and ad copy live on the task they publish; hashtag sets and content ideas belong to the campaign, because a set saved onto one task is a set the rest of the plan never sees.",
  },
  {
    id: "deliverable",
    order: 2,
    ask: {
      en: "What do you need — captions, ad copy, hashtag sets, or a batch of content ideas?",
      fr: "Tu as besoin de quoi — des légendes, du texte publicitaire, des jeux de hashtags, ou une batch d'idées de contenu ?",
    },
    topic: { en: "what to write", fr: "quoi écrire" },
    type: "choice",
    options: ["captions", "ad_copy", "hashtags", "ideas"],
    required: true,
    opens: {
      captions: ["captions"],
      ad_copy: ["ad_copy"],
      hashtags: ["hashtags"],
      ideas: ["ideas"],
    },
    because:
      "Each of the four has a fixed output shape and its own rules — a caption is per platform, ad copy is AIDA or PAS against a paid objective, a hashtag set is four categories, an idea carries a hook and a CTA. Naming which one is what makes the shape checkable.",
  },
  {
    id: "task_ref",
    order: 3,
    ask: {
      en: "Which task? Its title or its number in the plan is enough.",
      fr: "Quelle tâche ? Son titre ou son numéro dans le plan, ça suffit.",
    },
    topic: { en: "which task", fr: "quelle tâche" },
    type: "text",
    required: false,
    because:
      "The task carries the content brief the writing has to match, and its platforms decide how many captions come out. Writing to a task that was never named is writing that gets saved onto the wrong one.",
    dependsOn: ["scope"],
    showIf: (a) => a.scope === "task",
  },
  {
    id: "ad_objective",
    order: 4,
    ask: {
      en: "What is the ad paying for — a click to the music, or a follow?",
      fr: "La pub paie pour quoi — un clic vers la musique, ou un abonnement ?",
    },
    topic: { en: "what the ad buys", fr: "ce que la pub achète" },
    type: "choice",
    options: ["streams", "followers"],
    required: false,
    because:
      "The call to action is the objective, worded. A hook that pulls attention toward the wrong action spends money moving people to a page that doesn't sell what the campaign needs sold.",
    dependsOn: ["deliverable"],
    showIf: (a) => a.deliverable === "ad_copy",
  },
  {
    id: "language",
    order: 5,
    ask: {
      en: "In French, in English, or both?",
      fr: "En français, en anglais, ou les deux ?",
    },
    topic: { en: "the language", fr: "la langue" },
    type: "choice",
    options: ["fr", "en", "both"],
    required: true,
    because:
      "The one place where both is a real answer. A bilingual artist gets bilingual CONTENT — a French hashtag set beside an English one, a French ad variation beside an English one — while the conversation itself stays in one language. Mixing the two in a caption is what neither audience reads.",
  },
];

export const FLOW: Flow = {
  name: "digital-marketing-draft-content",
  questions: QUESTIONS,
};
