/**
 * The interview before a playlist shortlist. Data only: `engine/interview/load.ts` walks `FLOW`.
 * Asks whether a pitch is in flight: Spotify allows one pitched song at a time.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Flow } from "../../../../../engine/interview/core";

export const FLOW: Flow = {
  name: "promotion-match-playlists",
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
        "The Spotify pitch itself asks whether the track is francophone, and that answer changes which editors ever see it.",
    },
    {
      id: "release-date",
      order: 2,
      ask: {
        en: "When does the track come out?",
        fr: "Le morceau sort quand ?",
      },
      topic: { en: "the date", fr: "la date" },
      type: "date",
      // Required, unlike the radio flow: the editorial window closes seven
      // days before release and is computed from this date.
      required: true,
      from: { table: "releases", column: "release_date" },
      because:
        "The editorial pitch closes seven days before release and never reopens for that song. Without the date I cannot tell you whether that door is open.",
    },
    {
      id: "editorial-spent",
      order: 3,
      ask: {
        en: "Have you already pitched another unreleased song to Spotify that hasn't come out yet?",
        fr: "As-tu déjà proposé un autre morceau inédit à Spotify qui n'est pas encore sorti ?",
      },
      topic: { en: "pitches in flight", fr: "propositions en cours" },
      type: "choice",
      options: ["no", "yes", "not sure"],
      required: true,
      opens: { yes: ["editorial-blocked"], "not sure": ["editorial-check"] },
      because:
        "You get one pitched song at a time. If one is still in flight, the editorial route is closed until it comes out — and I would rather say so than send you to a form that rejects you.",
    },
    {
      id: "mood",
      order: 4,
      ask: {
        en: "How would you describe how the track sounds and feels? Two or three words is plenty.",
        fr: "Comment tu décrirais le son et l'ambiance du morceau ? Deux ou trois mots, c'est assez.",
      },
      topic: { en: "the sound", fr: "le son" },
      type: "text",
      required: false,
      because:
        "Spotify's own guidance is to be specific about sound, mood, instruments and influences. Your words go into the pitch; mine would be a guess.",
    },
    {
      id: "curator-budget",
      order: 5,
      ask: {
        en: "Would you pay a few euros per curator to guarantee they listen, or free routes only?",
        fr: "Paierais-tu quelques euros par curateur pour garantir une écoute, ou seulement les routes gratuites ?",
      },
      topic: { en: "budget", fr: "budget" },
      type: "choice",
      options: ["free only", "a little", "yes", "not sure"],
      required: false,
      opens: { "free only": ["direct-only"] },
      because:
        "Paying a curator to listen is legitimate and cheap. Paying for a guaranteed placement is not — that one gets your track flagged and pulled, and I will say so every time.",
    },
  ],
};
