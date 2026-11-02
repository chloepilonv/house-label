/**
 * The five optional site fields no other table holds: where the site lives
 * and its link-outs (../references/artist-website.md). Everything else is read
 * from the tables that own it.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Flow, Question } from "../../../../../engine/interview/core";

export const QUESTIONS: Question[] = [
  {
    id: "default_locale",
    order: 1,
    ask: {
      en: "The page carries French and English behind a toggle. Which one opens first?",
      fr: "La page a le français et l'anglais derrière un bouton. Lequel s'affiche en premier ?",
    },
    topic: { en: "first language", fr: "langue d'ouverture" },
    type: "choice",
    options: ["fr", "en"],
    required: false,
    because:
      "Both languages are always on the page — Quebec, Canada and the US are served as equals. The only choice is which one a visitor sees before touching anything, and that is the artist's market, not ours to guess.",
  },
  {
    id: "domain",
    order: 2,
    ask: {
      en: "Do you own a domain for it — odile-ray.com, say? Leave it blank and you get a vercel.app address for now.",
      fr: "Tu as un nom de domaine — odile-ray.com, par exemple ? Laisse vide et tu auras une adresse vercel.app pour l'instant.",
    },
    topic: { en: "the domain", fr: "le domaine" },
    type: "text",
    required: false,
    because:
      "The deploy adds the domain to the Vercel project and prints the DNS record to set at the registrar. Without one the site is still live, on a vercel.app address the artist can share today.",
  },
  {
    id: "shop_url",
    order: 3,
    ask: {
      en: "Where is your merch sold — a Bandcamp merch page, a Shopify, a lnk.to store? Paste the link, or say none.",
      fr: "Où se vend ton merch — la page merch Bandcamp, un Shopify, une boutique lnk.to ? Colle le lien, ou dis aucun.",
    },
    topic: { en: "the store", fr: "la boutique" },
    type: "url",
    required: false,
    because:
      "Every artist site studied links OUT to a store rather than running one; so does this page. Merch itself is out of scope. One link is all the page needs.",
  },
  {
    id: "newsletter_url",
    order: 4,
    ask: {
      en: "Where do fans sign up for your newsletter — a Mailchimp, Substack or Laylo link? Or none yet.",
      fr: "Où les fans s'abonnent à ton infolettre — un lien Mailchimp, Substack ou Laylo ? Ou pas encore.",
    },
    topic: { en: "the newsletter", fr: "l'infolettre" },
    type: "url",
    required: false,
    because:
      "The one asset the artist keeps when an algorithm changes is the list. The page's contact block is built around that signup; without a link it shows nothing there rather than a form that goes nowhere.",
  },
  {
    id: "bandsintown_artist",
    order: 5,
    ask: {
      en: "Are your shows on Bandsintown? Your artist name there, and the page shows upcoming dates by itself.",
      fr: "Tes spectacles sont sur Bandsintown ? Ton nom d'artiste là-bas, et la page affiche les prochaines dates toute seule.",
    },
    topic: { en: "the shows widget", fr: "le widget spectacles" },
    type: "text",
    required: false,
    because:
      "Bandsintown syncs to Spotify as well, so an artist who plays live wants it anyway. With it, upcoming shows never go stale on the site; without it the page lists what the booking department has marked booked, which is the same list a week late.",
  },
];

export const FLOW: Flow = {
  name: "digital-marketing-build-website",
  questions: QUESTIONS,
};
