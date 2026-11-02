/**
 * The presskit intake. `engine/interview/load.ts` imports `FLOW`.
 *
 * Order is deliberate, not schema order: vibe first because it shapes the
 * design, photos second. One step is one topic, not one column. Steps skip
 * when the data exists (`showIf`); `withOffers()` names what the brief found.
 * `locale` is never asked: it comes from `preferred_locale`.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Answers, Flow, Question } from "../../../../../engine/interview/core";

export type QuestionId =
  | "moodboard"
  | "sharing"
  | "replace"
  | "brand"
  | "photos"
  | "bio"
  | "bandcamp"
  | "releases_typed"
  | "press"
  | "press_urls"
  | "shows_awards"
  | "contact";

const q = (x: Question & { id: QuestionId }): Question => x;

/** "no", "none", "nope" — the artist saying they have not got one. */
const declined = (v: unknown): boolean =>
  typeof v === "string" && /^(no|none|nope|non|aucun|aucune|pas de)\b/i.test(v.trim());

export const QUESTIONS: Question[] = [
  // ── 1. Vibe / moodboard ─────────────────────────────────────────────────
  // Deliberately open: notes, image links and articles all land in one answer.
  q({
    id: "moodboard",
    order: 1,
    type: "longtext",
    ask: {
      en: "Before we pull together your info, let's set the vibe. What aesthetic should this presskit feel like? Think mood, colours, typography, references — 'dark and editorial, warm oranges', 'raw street photography', 'minimal and airy', or name artists or magazines whose look you love. You can also paste moodboard image URLs or article links.",
      fr: "Avant de rassembler tes infos, définissons l'ambiance. Quelle esthétique devrait avoir ce presskit ? Pense mood, couleurs, typographie, références — « sombre et éditorial, oranges chauds », « photo de rue brute », « minimal et aéré », ou nomme des artistes ou magazines dont tu aimes le look. Tu peux aussi coller des liens d'images ou d'articles.",
    },
    topic: { en: "the vibe", fr: "l'ambiance" },
    required: false,
    because:
      "It drives the colours, the typography and the layout of every slide. 'No preference' is itself an answer worth saving — it stops us asking again next time.",
  }),

  // Branding sits next to the vibe: an artist with colours should not have
  // them guessed from a mood.
  q({
    id: "brand",
    order: 2,
    type: "text",
    ask: {
      en: "Do you already have brand colours, a typeface or a logo? Paste hex codes, name a Google Font, or drop a logo link. Say no and I'll derive it all from the vibe you just described.",
      fr: "As-tu déjà des couleurs de marque, une typographie ou un logo ? Colle des codes hex, nomme une Google Font, ou donne un lien vers ton logo. Dis non et je déduirai tout de l'ambiance que tu viens de décrire.",
    },
    topic: { en: "your branding", fr: "ton image de marque" },
    required: false,
    because:
      "Colours you chose beat colours we guessed. Anything you leave out is still derived, so a single accent colour is a fine answer.",
  }),

  // ── 2. Photos ───────────────────────────────────────────────────────────
  // The profile's photos arrive as an offer.
  q({
    id: "photos",
    order: 3,
    type: "image",
    ask: {
      en: "Could you share some photos of you? Upload files, paste image URLs, or say 'use the ones on my profile' and I'll pull them from there.",
      fr: "Peux-tu partager des photos de toi ? Téléverse des fichiers, colle des liens d'images, ou dis « prends celles de mon profil » et je les récupérerai.",
    },
    topic: { en: "photos", fr: "photos" },
    required: false,
    because:
      "Three is the minimum for a complete presskit. The first becomes the cover unless you name another, and each is tagged hero, secondary or gallery so a regeneration puts them back in the same places.",
  }),

  // ── 3. Bio / background ─────────────────────────────────────────────────
  // One question for both bios. Releases, shows and press in a pasted bio
  // are extracted in the same turn.
  q({
    id: "bio",
    order: 4,
    type: "longtext",
    ask: {
      en: "Do you have an existing bio, old presskit, or CV? You can paste it here, or just tell me about yourself — who you are, your sound, career highlights.",
      fr: "As-tu une bio, un ancien presskit ou un CV ? Colle-le ici, ou parle-moi simplement de toi — qui tu es, ton son, tes moments forts.",
    },
    topic: { en: "your bio", fr: "ta bio" },
    required: false,
    opens: { no: ["bio:draft"], none: ["bio:draft"] },
    because:
      "It becomes slides one and two. Anything else in it — a venue, an award, a magazine — is pulled out in the same turn rather than asked about again later.",
  }),

  // ── 3b. Discography ─────────────────────────────────────────────────────
  // Bandcamp first: one URL yields every title, year and cover. Typing is the fallback.
  q({
    id: "bandcamp",
    order: 5,
    type: "text",
    ask: {
      en: "Do you have a Bandcamp page? If yes, drop the URL and I'll pull all your releases — titles, years and cover art — in one go.",
      fr: "As-tu une page Bandcamp ? Si oui, donne l'adresse et je récupérerai toutes tes sorties — titres, années et pochettes — d'un coup.",
    },
    topic: { en: "Bandcamp", fr: "Bandcamp" },
    required: false,
    opens: { no: [], none: [] },
    because:
      "One link beats typing out a discography. You confirm the list before any of it is saved.",
  }),
  q({
    id: "releases_typed",
    order: 6,
    type: "longtext",
    showIf: (a: Answers) => declined(a.bandcamp),
    dependsOn: ["bandcamp"],
    ask: {
      en: "No problem — list your releases instead. One per line: title, whether it's an album, EP or single, and the year.",
      fr: "Pas de souci — énumère plutôt tes sorties. Une par ligne : titre, album/EP/single, et l'année.",
    },
    topic: { en: "your releases", fr: "tes sorties" },
    required: false,
    because: "Slide three is the catalogue. Nothing released yet is a real answer and changes the slide rather than emptying it.",
  }),

  // ── 4. Press ────────────────────────────────────────────────────────────
  // Offer to search before asking the artist to find their own coverage.
  q({
    id: "press",
    order: 7,
    type: "choice",
    options: ["search", "paste", "none"],
    ask: {
      en: "I can search the web for articles about you and you pick which ones to keep — sound good? Or paste the URLs yourself if you have them ready.",
      fr: "Je peux chercher sur le web des articles à ton sujet et tu choisis lesquels garder — ça te va ? Ou colle les liens toi-même si tu les as sous la main.",
    },
    topic: { en: "press", fr: "presse" },
    required: false,
    opens: { search: ["press:crawl"] },
    because:
      "Artists routinely forget coverage they got. Anything found lands as `suggested` and stays off the deck until you confirm it — a search can always turn up a different person with your name.",
  }),
  q({
    id: "press_urls",
    order: 8,
    type: "url",
    showIf: (a: Answers) => a.press === "paste",
    dependsOn: ["press"],
    ask: {
      en: "Paste them — one per line. Articles, reviews, interviews.",
      fr: "Colle-les — un par ligne. Articles, critiques, entrevues.",
    },
    topic: { en: "the links", fr: "les liens" },
    required: true,
    because: "The outlet, headline and date are read off each page — nothing is invented.",
  }),

  // ── 5. Shows & recognition ──────────────────────────────────────────────
  // One question for shows, tours and awards. A tour poster dropped here goes
  // to vision, not the gallery (branch in SKILL.md).
  q({
    id: "shows_awards",
    order: 9,
    type: "longtext",
    ask: {
      en: "Any notable shows, tours, or awards we should feature? If you have a tour poster handy, drop it in and I'll read the dates off it.",
      fr: "Des spectacles, tournées ou prix marquants à mettre en avant ? Si tu as une affiche de tournée sous la main, envoie-la et j'en lirai les dates.",
    },
    topic: { en: "shows and awards", fr: "spectacles et prix" },
    required: false,
    opens: { no: ["shows:empty"], none: ["shows:empty"] },
    because:
      "Slides four and five. Reading the poster you already made beats retyping it, and every date read off it waits for your confirmation before it is saved.",
  }),

  // ── 6. Contact & socials ────────────────────────────────────────────────
  // Socials are not asked: `artist.platforms` holds them. Asked is the address
  // to print, which is often not the artist's own.
  q({
    id: "contact",
    order: 10,
    type: "text",
    ask: {
      en: "Best email for press to reach you? And a booking contact if it's a different one.",
      fr: "Quel courriel pour que la presse te joigne ? Et un contact booking si c'est différent.",
    },
    topic: { en: "contact", fr: "contact" },
    required: true,
    because:
      "This gets printed publicly, which is why it is asked separately from the address on your profile — those are often not the same one.",
  }),

  // ── 11-12. The deck itself ──────────────────────────────────────────────
  // Strict `choice` questions: `sharing` is a permission, and `replace`
  // destroys a link a journalist may already have.
  q({
    id: "sharing",
    order: 11,
    type: "choice",
    options: ["anyone with the link", "only people i invite"],
    ask: {
      en: "When the deck is ready — should anyone with the link be able to open it, or only people you invite?",
      fr: "Quand le document sera prêt — n'importe qui avec le lien peut l'ouvrir, ou seulement les gens que tu invites ?",
    },
    topic: { en: "who can open it", fr: "qui peut l'ouvrir" },
    required: true,
    because:
      "A presskit is meant to be forwarded — a journalist sends it to their editor. A link that asks for permission is a link that gets dropped. Invite-only is right when you are pitching something unannounced.",
  }),

  q({
    id: "replace",
    order: 12,
    type: "choice",
    options: ["replace it", "keep both"],
    ask: {
      en: "If you already have a deck — replace it, or keep both?",
      fr: "Si tu as déjà un document — le remplacer, ou garder les deux ?",
    },
    topic: { en: "the old one", fr: "l'ancien" },
    required: false,
    because:
      "Replacing changes what the old link points at, which matters if you have already sent it to anyone. Skip it if this is your first one.",
  }),
];

export const FLOW: Flow = {
  name: "presskit-build",
  questions: QUESTIONS,
  // No `langFrom`: the language comes from the profile's `preferred_locale`.
};

export default FLOW;
