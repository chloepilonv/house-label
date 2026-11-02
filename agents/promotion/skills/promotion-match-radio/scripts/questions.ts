/**
 * The interview before radio stations are ranked. Data only:
 * `engine/interview/load.ts` walks `FLOW`, so nothing here may read a file,
 * open a database or print. Country is asked (prefilled via `from:`), not
 * derived: CanCon quotas apply to Canadian artists, and a Canadian may work a US release.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Flow } from "../../../../../engine/interview/core";

export const FLOW: Flow = {
  name: "promotion-match-radio",
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
        "Half the stations worth reaching in Quebec publish their rules in French only, and the pitch goes out in the station's language, not yours.",
    },
    {
      id: "market",
      order: 2,
      ask: {
        en: "Which country are you working this record in — Canada, the United States, or both?",
        fr: "Dans quel pays travailles-tu ce disque — le Canada, les États-Unis, ou les deux ?",
      },
      topic: { en: "the market", fr: "le marché" },
      type: "choice",
      options: ["canada", "united states", "both"],
      required: true,
      from: { table: "profile", column: "country" },
      opens: { canada: ["quota"], "united states": ["no-quota"], both: ["quota", "no-quota"] },
      because:
        "Canadian stations owe a fixed share of their airtime to Canadian music. American stations owe nobody anything. This is the difference between a list and the wrong list.",
    },
    {
      id: "format",
      order: 3,
      ask: {
        en: "What are you sending them — a single, an EP, or an album?",
        fr: "Tu leur envoies quoi — un single, un EP, ou un album ?",
      },
      topic: { en: "the release", fr: "la sortie" },
      type: "choice",
      options: ["single", "ep", "album"],
      required: true,
      from: { table: "releases", column: "release_type" },
      // Several campus stations refuse singles (CKUT, CJSW).
      opens: { single: ["singles-refused"] },
      because:
        "Several campus stations refuse singles in writing. Knowing which you have keeps stations off your list that would bin it unopened.",
    },
    {
      id: "release-date",
      order: 4,
      ask: {
        en: "When does it come out? An approximate date is fine.",
        fr: "Ça sort quand ? Une date approximative, c'est correct.",
      },
      topic: { en: "the date", fr: "la date" },
      type: "date",
      required: false,
      from: { table: "releases", column: "release_date" },
      because:
        "Radio runs weeks ahead of release, not days. Without a date I can still rank the stations, but I cannot tell you what is already too late.",
    },
    {
      id: "regions",
      order: 5,
      ask: {
        en: "Anywhere in particular you want to be heard? Pick as many as apply.",
        fr: "Des endroits en particulier où tu veux être entendu ? Choisis-en autant que tu veux.",
      },
      topic: { en: "where", fr: "où" },
      type: "multi",
      // One token each: `normalize()` splits multi answers on whitespace.
      options: ["quebec", "ontario", "maritimes", "prairies", "westcoast", "anywhere"],
      required: false,
      because:
        "A station in your own city is likelier to answer, and a francophone station outside Quebec is a real target most artists never think of.",
    },
    {
      id: "budget",
      order: 6,
      ask: {
        en: "Is there any budget for this, or should I stick to the free routes?",
        fr: "As-tu un budget pour ça, ou je m'en tiens aux routes gratuites ?",
      },
      topic: { en: "budget", fr: "budget" },
      type: "choice",
      options: ["free only", "under 100", "100 to 500", "over 500", "not sure"],
      required: false,
      opens: { "free only": ["direct-only"] },
      because:
        "The cheapest real radio campaign in Canada costs $7. Knowing whether you have that changes the order of the list, not just its length.",
    },
  ],
};
