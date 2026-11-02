/**
 * The interview before a pitch is written. Data only: `engine/interview/load.ts` walks `FLOW`.
 * The target is required with no default: it sets the pitch's length, language and rules.
 * The artist's own words are stored to `artist.memory` so the next pitch never re-asks.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Flow } from "../../../../../engine/interview/core";

export const FLOW: Flow = {
  name: "promotion-draft-pitch",
  langFrom: (a) => (a.language === "français" ? "fr" : a.language === "english" ? "en" : null),
  questions: [
    {
      id: "target-kind",
      order: 1,
      ask: {
        en: "Who is this pitch for — a radio station, a playlist curator, or the Spotify editorial form?",
        fr: "Ce pitch est pour qui — une radio, un curateur de playlist, ou le formulaire éditorial Spotify ?",
      },
      topic: { en: "the target", fr: "la cible" },
      type: "choice",
      options: ["radio", "curator", "editorial"],
      required: true,
      opens: { radio: ["station-rules"], curator: ["live-link"], editorial: ["form-fields"] },
      because:
        "These are three different pieces of writing. A station wants a subject line and a link; the Spotify form wants sound, mood and influences and no greeting at all.",
    },
    {
      id: "target-name",
      order: 2,
      ask: {
        en: "Which one? Name the station or the playlist.",
        fr: "Laquelle ? Nomme la radio ou la playlist.",
      },
      topic: { en: "which one", fr: "laquelle" },
      type: "text",
      required: true,
      showIf: (a) => a["target-kind"] !== "editorial",
      because:
        "Their own published rules go into the draft — file format, whether attachments are allowed, whether they take singles. I will not guess them.",
    },
    {
      id: "language",
      order: 3,
      ask: {
        en: "What language does this contact work in?",
        fr: "Ce contact travaille dans quelle langue ?",
      },
      topic: { en: "their language", fr: "leur langue" },
      type: "choice",
      options: ["english", "français", "not sure"],
      required: true,
      because:
        "The pitch is written in their language, not yours. A French email to a francophone music director is not politeness, it is the difference between being read and being skipped.",
    },
    {
      id: "own-words",
      order: 4,
      ask: {
        en: "How would you describe this record to someone who has never heard it? Your words, not a press release.",
        fr: "Comment tu décrirais ce disque à quelqu'un qui ne l'a jamais entendu ? Tes mots, pas un communiqué.",
      },
      topic: { en: "your words", fr: "tes mots" },
      type: "text",
      required: true,
      because:
        "The one sentence that makes a pitch work is always yours. I can arrange it and translate it; I cannot invent it, and I will not pretend to.",
    },
    {
      id: "link",
      order: 5,
      ask: {
        en: "Do you have a link to send them — a streaming link, or a private one if it isn't out yet?",
        fr: "As-tu un lien à leur envoyer — un lien d'écoute, ou un lien privé si ce n'est pas encore sorti ?",
      },
      topic: { en: "the link", fr: "le lien" },
      type: "text",
      required: false,
      because:
        "Some stations ban attachments by name and some ban expiring links by name. Without a link the draft carries a visible placeholder rather than a guess.",
    },
  ],
};
