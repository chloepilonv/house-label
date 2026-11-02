/**
 * What a release must satisfy before a distributor takes it. Data only:
 * `engine/interview/load.ts` walks `FLOW`. Each question maps to a rejection
 * cause in knowledge/delivery-requirements.md. Pixel bands sit at market
 * thresholds: 1000 (DistroKid), 1400 (CD Baby, Amuse), 1600 (TuneCore), 3000
 * (Ditto, RouteNote, iMusician, UnitedMasters). "I'm not sure" routes to how to check.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Flow } from "../../../../../engine/interview/core";

export const FLOW: Flow = {
  name: "distribution-prepare-package",
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
      // Already set in the profile; never re-asked.
      from: { table: "profile", column: "preferred_locale" },
      because: "So the checklist you end up with is in the language you'll actually work from.",
    },
    {
      id: "release_title",
      order: 2,
      ask: { en: "What's the release called?", fr: "Comment s'appelle la sortie ?" },
      topic: { en: "the release", fr: "la sortie" },
      type: "text",
      required: true,
      from: { table: "releases", column: "title" },
      to: { table: "releases", column: "title", conflict: ["title"] },
      because:
        "The title has to match your cover art exactly, character for character. Mismatched text between the artwork and the metadata is one of the most common rejections there is.",
    },
    {
      id: "release_type",
      order: 3,
      ask: { en: "Single, EP, or album?", fr: "Single, EP ou album ?" },
      topic: { en: "release type", fr: "type de sortie" },
      type: "choice",
      options: ["single", "ep", "album"],
      required: true,
      from: { table: "releases", column: "release_type" },
      to: { table: "releases", column: "release_type", conflict: ["title"] },
      because:
        "It decides how many ISRCs you need — one per recording — and whether a single UPC covers it. It also changes what some distributors charge you.",
    },
    {
      id: "release_date",
      order: 4,
      ask: { en: "What's the release date, or the one you're aiming at?", fr: "Quelle est la date de sortie, ou celle que tu vises ?" },
      topic: { en: "release date", fr: "date de sortie" },
      type: "date",
      required: true,
      from: { table: "releases", column: "release_date" },
      to: { table: "releases", column: "release_date", conflict: ["title"] },
      because:
        "Two deadlines stack before it: your distributor's delivery window, and Spotify's editorial pitch, which closes 7 days before release day. I need the date to tell you whether you've already missed either.",
    },
    {
      id: "distributor",
      order: 5,
      ask: {
        en: "Which distributor is this going to? 'Haven't chosen' is fine.",
        fr: "Chez quel distributeur ça s'en va ? « Pas encore choisi » est une réponse.",
      },
      topic: { en: "distributor", fr: "distributeur" },
      type: "text",
      required: false,
      from: { table: "releases", column: "distributor" },
      to: { table: "releases", column: "distributor", conflict: ["title"] },
      because:
        "Their rules are narrower than the stores' and they're the ones who will reject you. Without a name I check against the store baseline instead and tell you it's the baseline, not their rule.",
    },
    {
      id: "audio_format",
      order: 6,
      ask: {
        en: "What format are your finished masters in?",
        fr: "Dans quel format sont tes masters finaux ?",
      },
      topic: { en: "audio format", fr: "format audio" },
      type: "choice",
      options: ["wav", "flac", "aiff", "mp3 only", "something else", "i'm not sure"],
      required: true,
      because:
        "Distributors disagree about this more than about anything else. iMusician takes WAV and nothing else; RouteNote takes FLAC or MP3 and not WAV. Your format can rule out a distributor on its own.",
    },
    {
      id: "audio_specs",
      order: 7,
      ask: {
        en: "Do you know the bit depth and sample rate — 16-bit/44.1kHz, 24-bit, higher?",
        fr: "Connais-tu la profondeur et la fréquence — 16 bits/44,1 kHz, 24 bits, plus élevé ?",
      },
      topic: { en: "audio quality", fr: "qualité audio" },
      type: "choice",
      options: ["16-bit / 44.1khz", "24-bit / 44.1khz", "24-bit / 48khz or higher", "i'm not sure"],
      required: false,
      because:
        "44.1kHz is the floor everywhere. The rule that catches people is the opposite of what they expect: send exactly what you mastered, because upconverting a 16-bit master to 24-bit can cost you lossless eligibility rather than earn it.",
    },
    {
      id: "artwork_size",
      order: 8,
      ask: {
        en: "How big is your cover art, in pixels?",
        fr: "Quelle est la taille de ta pochette, en pixels ?",
      },
      topic: { en: "artwork size", fr: "taille de la pochette" },
      type: "choice",
      options: ["under 1000", "1000 to 1399", "1400 to 1599", "1600 to 2999", "3000 or more", "i'm not sure"],
      required: true,
      because:
        "Every band here is a real cut-off. Under 1000 nobody takes it; at 1400 you lose Ditto, RouteNote, iMusician and UnitedMasters; at 3000 everyone takes it. It's the fastest thing to fix and the most common reason a release stalls.",
    },
    {
      id: "artwork_format",
      order: 9,
      ask: { en: "What file type is the cover?", fr: "Quel type de fichier est la pochette ?" },
      topic: { en: "artwork format", fr: "format de la pochette" },
      type: "choice",
      options: ["jpg", "png", "tiff", "something else", "i'm not sure"],
      required: false,
      because:
        "JPG is the only one every distributor takes. PNG is fine at some and refused at others, and it's a two-second export rather than a redesign.",
    },
    {
      id: "artwork_content",
      order: 10,
      ask: {
        en: "What's printed on the cover? Answer with all that apply: name (your artist name) · title (the release title) · url (a website or QR code) · handle (a social handle) · logo (a logo that isn't yours) · nothing (image only)",
        fr: "Qu'est-ce qui est imprimé sur la pochette ? Réponds avec tout ce qui s'applique : name (ton nom d'artiste) · title (le titre) · url (un site ou un code QR) · handle (un identifiant social) · logo (un logo qui n'est pas le tien) · nothing (image seulement)",
      },
      topic: { en: "what's on the cover", fr: "ce qui est sur la pochette" },
      type: "multi",
      // One token each: `normalize()` splits on whitespace, so a multi-word
      // option has no legal answer, and this question is required.
      options: ["name", "title", "url", "handle", "logo", "nothing"],
      required: true,
      because:
        "Specifications almost never get a cover rejected. Content does. A URL, a QR code, an Instagram handle or a streaming logo is an automatic refusal at every store, and it's the failure I see described as 'they rejected it for no reason'.",
    },
    {
      id: "identifiers",
      order: 11,
      ask: {
        en: "Do you already have ISRCs and a UPC for this release?",
        fr: "As-tu déjà des ISRC et un UPC pour cette sortie ?",
      },
      topic: { en: "identifiers", fr: "identifiants" },
      type: "choice",
      options: ["both", "isrcs only", "neither — the distributor can issue them", "i'm not sure what those are"],
      required: false,
      because:
        "Your distributor will issue both for free if you don't have them. The reason to hold your own is portability if you ever switch — and if you already have ISRCs from a previous release, reusing one on a new recording breaks the royalty trail.",
    },
    {
      id: "lyrics",
      order: 12,
      ask: { en: "Do you have the lyrics written out?", fr: "As-tu les paroles écrites ?" },
      topic: { en: "lyrics", fr: "paroles" },
      type: "choice",
      options: ["yes", "no", "instrumental"],
      required: false,
      because:
        "No store requires them, so this isn't a blocker. They feed the lyric display on Spotify and Apple Music, and it's easier to write them now than to remember to add them later.",
    },
    {
      id: "anything_else",
      order: 13,
      ask: {
        en: "Anything else about this release I should check?",
        fr: "Autre chose sur cette sortie que je devrais vérifier ?",
      },
      topic: { en: "anything else", fr: "autre chose" },
      type: "text",
      required: false,
      because:
        "A cover song, a featured artist, a remix, a re-release of something that was live before — each one adds a requirement none of the questions above would have caught.",
    },
  ],
};
