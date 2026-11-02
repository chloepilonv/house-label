/**
 * The interview the distribution comparison needs. Data only: `engine/interview/load.ts`
 * walks `FLOW`, so nothing here may read a file, open a database or print.
 * Revenue is asked (optional, banded) because fee + cut x revenue is the bill;
 * without it the comparison says so rather than inventing a break-even.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Flow } from "../../../../../engine/interview/core";

export const FLOW: Flow = {
  name: "distribution-compare-services",
  // Asked first so every later question arrives in the artist's language.
  langFrom: (a) => (a.language === "français" ? "fr" : a.language === "english" ? "en" : null),
  questions: [
    {
      id: "language",
      order: 1,
      ask: { en: "Which language would you like to do this in?", fr: "Dans quelle langue veux-tu qu'on fasse ça ?" },
      topic: { en: "language", fr: "langue" },
      type: "choice",
      options: ["english", "français"],
      required: true,
      from: { table: "profile", column: "preferred_locale" },
      because:
        "Half this market prices in USD and publishes in English only. Knowing which language you read in decides which distributors can actually support you, not just which words I use.",
    },
    {
      id: "situation",
      order: 2,
      ask: {
        en: "Where are you starting from — is this your first release, are you with someone right now, are you between distributors, or just shopping around?",
        fr: "Tu pars d'où — première sortie, tu es avec quelqu'un en ce moment, tu es entre deux distributeurs, ou tu magasines ?",
      },
      topic: { en: "your situation", fr: "ta situation" },
      type: "choice",
      // A released catalogue with no distributor is its own state: the music
      // must be re-delivered rather than moved.
      options: [
        "first release",
        "already with a distributor",
        "between distributors",
        "shopping around",
      ],
      required: true,
      opens: {
        "already with a distributor": ["switching"],
        "between distributors": ["switching", "re-delivery"],
        "first release": ["first-release"],
        "shopping around": ["comparing"],
      },
      because:
        "Switching costs money and time that starting fresh does not. If you already have releases live, the comparison has to price moving them, not just price signing up — and if they have come down already, it has to price putting them back.",
    },
    {
      id: "current_distributor",
      order: 3,
      ask: {
        en: "Who are you with, or who were you with last?",
        fr: "Tu es avec qui, ou tu étais avec qui en dernier ?",
      },
      topic: { en: "current distributor", fr: "distributeur actuel" },
      type: "text",
      required: false,
      // The saved choice first, the inference from releases second. Never re-ask.
      from: { table: "saved_distributors", column: "saved_name" },
      showIf: (a) => a.situation === "already with a distributor" || a.situation === "between distributors",
      dependsOn: ["situation"],
      because:
        "What leaving costs is the least published thing in this market. I can only tell you what happens if you stop paying if I know whose terms to read.",
    },
    {
      id: "catalog_size",
      order: 4,
      ask: {
        en: "How many releases are live under that account — or were, before you left?",
        fr: "Combien de sorties sont en ligne sous ce compte — ou l'étaient, avant que tu partes ?",
      },
      topic: { en: "catalogue to move", fr: "catalogue à déplacer" },
      type: "choice",
      options: ["1", "2 to 5", "6 to 20", "more than 20", "i'm not sure"],
      required: false,
      showIf: (a) => a.situation === "already with a distributor" || a.situation === "between distributors",
      dependsOn: ["situation"],
      because:
        "Moving a catalogue means taking every release down and putting it back up, and each one loses its stream count and its playlist positions. Twenty releases is a different decision from one.",
    },
    {
      id: "release_pace",
      order: 5,
      ask: {
        en: "How many releases do you expect to put out in the next year?",
        fr: "Combien de sorties penses-tu faire dans la prochaine année ?",
      },
      topic: { en: "how often you release", fr: "fréquence de sortie" },
      type: "choice",
      options: ["just one", "2 or 3", "4 or more", "i don't know yet"],
      required: true,
      because:
        "This is the single number that decides the fee model. A yearly subscription is cheap if you release four times and expensive if you release once; pay-per-release is the reverse.",
    },
    {
      id: "annual_revenue",
      order: 6,
      ask: {
        en: "Roughly what do your recordings earn from streaming in a year? A rough band is fine, and 'I don't know' is a real answer.",
        fr: "À peu près combien tes enregistrements rapportent en streaming par année ? Une fourchette suffit, et « je ne sais pas » est une vraie réponse.",
      },
      topic: { en: "streaming revenue", fr: "revenus de streaming" },
      type: "choice",
      options: ["nothing yet", "under $500", "$500 to $2,000", "$2,000 to $10,000", "over $10,000", "i don't know"],
      required: false,
      because:
        "A percentage and a flat fee are the same bill at one revenue level and very different at another. Without a rough figure I can only tell you the rates, not which one costs you less.",
    },
    {
      id: "country",
      order: 7,
      ask: { en: "Which country are you based in?", fr: "Dans quel pays es-tu basé·e ?" },
      topic: { en: "where you are", fr: "où tu es" },
      type: "choice",
      options: ["canada", "united states", "somewhere else"],
      required: true,
      from: { table: "profile", column: "country" },
      opens: { canada: ["canada"], "united states": ["us"] },
      because:
        "One distributor in this entire market prices in Canadian dollars. Everyone else quotes USD, so a Canadian comparing them is comparing pre-exchange numbers.",
    },
    {
      id: "grant_factor",
      order: 8,
      ask: {
        en: "Do you apply for Canadian funding — FACTOR, Musicaction, RadioStar — or plan to?",
        fr: "Est-ce que tu fais des demandes de subventions — FACTOR, Musicaction, RadioStar — ou comptes en faire ?",
      },
      topic: { en: "funding", fr: "subventions" },
      type: "choice",
      options: ["yes", "no", "i'd like to"],
      required: false,
      showIf: (a) => a.country === "canada",
      dependsOn: ["country"],
      because:
        "One distributor advertises that its members qualify for those programs. If that holds, choosing a distributor is partly a funding decision — and I'll flag that the claim is theirs and unverified against the funders.",
    },
    {
      id: "french_needed",
      order: 9,
      ask: {
        en: "Do you need support and paperwork in French?",
        fr: "As-tu besoin du service et des documents en français ?",
      },
      topic: { en: "French support", fr: "service en français" },
      type: "choice",
      options: ["yes", "no", "nice to have"],
      required: false,
      showIf: (a) => a.country === "canada",
      dependsOn: ["country"],
      because:
        "Most of this market operates in English only. If French matters to you it removes options, and it's better to know that before you're three screens into a signup form.",
    },
    {
      id: "priorities",
      order: 10,
      ask: {
        en: "Which of these matter most to you? Name as many as genuinely do — keep (what you keep) · price (what you're charged) · exit (what leaving costs) · speed (how fast it ships) · reach (where it goes) · canada (CAD pricing, French, grants)",
        fr: "Lesquels comptent le plus pour toi ? Nomme-en autant qu'il en faut — keep (ce que tu gardes) · price (ce qu'on te charge) · exit (le coût de partir) · speed (la vitesse) · reach (où ça va) · canada (prix en CAD, français, subventions)",
      },
      topic: { en: "what matters most", fr: "ce qui compte le plus" },
      type: "multi",
      // One token each: `normalize()` splits multi answers on whitespace and
      // commas. The readable phrasing lives in `ask:`, where nothing parses it.
      options: ["keep", "price", "exit", "speed", "reach", "canada"],
      required: false,
      because:
        "Every comparison shows all six. This decides which ones get ranked on, so the list is ordered by what you care about rather than by what I assume. Two or three is typical; there is no limit.",
    },
    {
      id: "ruled_out",
      order: 11,
      ask: {
        en: "Anything you've already decided against, and why?",
        fr: "Y a-t-il des options que tu as déjà écartées, et pourquoi ?",
      },
      topic: { en: "already ruled out", fr: "déjà écarté" },
      type: "text",
      required: false,
      because:
        "So nobody proposes it to you again in six months. Your reason gets saved with it, which is what stops a future conversation re-arguing a decision you already made.",
    },
    {
      id: "anything_else",
      order: 12,
      ask: {
        en: "Anything else I should know before I compare these?",
        fr: "Autre chose que je devrais savoir avant de comparer ?",
      },
      topic: { en: "anything else", fr: "autre chose" },
      type: "text",
      required: false,
      because:
        "The last question is always this one. A deal you've been offered, a deadline, a bad experience — any of it changes the answer, and none of it fits the questions above.",
    },
  ],
};
