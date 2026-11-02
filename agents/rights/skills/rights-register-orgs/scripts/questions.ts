/**
 * The registration interview. The checklist is computed from the profile and
 * printed first (SKILL.md `## Process` step 1); questions assume it is on screen.
 * Profile facts are seeded as answers so `view()` skips them; `corrections`
 * lets the artist reject them once. A blank profile asks them normally.
 * Options are lowercase: `normalize()` lowercases answers before `validate()`.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Flow } from "../../../../../engine/interview/core";

export const FLOW: Flow = {
  name: "rights-register-orgs",

  langFrom: (a) =>
    typeof a.province === "string" && /^(qc|quebec|québec)$/i.test(a.province.trim())
      ? "fr"
      : a.province
        ? "en"
        : null,

  questions: [
    // ── seeded from the profile; asked only when it is blank ──────────────
    {
      id: "country",
      order: 1,
      ask: {
        en: "Which country do you live in — ca or us?",
        fr: "Dans quel pays habites-tu — ca ou us ?",
      },
      // `offers.ts` turns this into an offer. Options use the column's own
      // vocabulary, since an offered value must be a legal option.
      from: { table: "profile", column: "country" },
      topic: { en: "country", fr: "pays" },
      type: "choice",
      options: ["ca", "us"],
      forgiving: true,
      required: true,
      opens: { ca: ["canada"], us: ["united-states"] },
      because:
        "A Canadian and an American share no collection societies at all. Normally this comes from your profile and is never asked.",
    },
    {
      id: "province",
      order: 2,
      ask: { en: "Which province or state?", fr: "Quelle province ou quel État ?" },
      topic: { en: "province", fr: "province" },
      type: "text",
      from: { table: "profile", column: "region" },
      required: false,
      because:
        "Quebec answers come back in French. It does not change which societies are offered — no Canadian neighbouring-rights society is restricted by province.",
    },
    {
      id: "roles",
      order: 3,
      ask: {
        en: "Do you write the songs, perform them, or both?",
        fr: "Écris-tu les chansons, les interprètes-tu, ou les deux ?",
      },
      topic: { en: "your roles", fr: "tes rôles" },
      type: "multi",
      // No `from`: `profile.disciplines` uses other names, and mapping them is inference.
      // No `label` option: that role is derived from `owns_masters`.
      // Options are the question's own verbs so the artist can type them.
      options: ["write", "perform", "both"],
      forgiving: true,
      required: true,
      opens: { write: ["composition"], perform: ["master"], both: ["composition", "master"] },
      because:
        "Writing and performing collect from different societies. Registering as a writer and forgetting the performer side is the most common way artists lose money they are already owed. Owning the recordings is a third role and the next question asks it plainly.",
    },

    // ── the only thing the profile cannot know ────────────────────────────
    {
      id: "owns_masters",
      order: 4,
      ask: {
        en: "One thing your profile can't tell me: do you own your recordings? If you paid for the session and nobody signed it away, that's usually yes.",
        fr: "Une chose que ton profil ne peut pas me dire : es-tu propriétaire de tes enregistrements ? Si tu as payé la séance et que personne n'a cédé ses droits, c'est généralement oui.",
      },
      topic: { en: "master ownership", fr: "propriété des masters" },
      type: "choice",
      options: ["yes", "no", "not sure"],
      forgiving: true,
      // `yes` is the `label` role in `catalog.rights_orgs.for_whom`; SKILL.md maps it.
      required: true,
      because:
        "Owning your masters adds Panorama in Canada and the sound-recording-owner share at SoundExchange. Not owning them means that money is someone else's, and recommending those two would waste your afternoon.",
    },

    // ── A. the correction ─────────────────────────────────────────────────
    {
      id: "corrections",
      order: 5,
      ask: {
        en: "That's the list above, built from your profile. Anything wrong or missing — or an organization you want explained before you go near it?",
        fr: "Voilà la liste ci-dessus, bâtie à partir de ton profil. Y a-t-il une erreur, un oubli — ou une organisation que tu veux te faire expliquer avant de t'en approcher ?",
      },
      topic: { en: "corrections", fr: "corrections" },
      type: "text",
      required: false,
      because:
        "The checklist above was built from what you just confirmed. This catches the thing a question set cannot ask about — an old deal, a co-writer, a society that turned you down.",
    },

    // ── B. the ID vault, opt-in ──────────────────────────────────────────
    {
      id: "store_ids",
      order: 6,
      ask: {
        en: "Want me to keep your member numbers and IPI on file, so you never have to dig through emails for them again?",
        fr: "Veux-tu que je conserve tes numéros de membre et ton IPI, pour ne plus jamais avoir à fouiller tes courriels ?",
      },
      topic: { en: "keeping your numbers", fr: "conserver tes numéros" },
      type: "choice",
      options: ["yes", "no"],
      forgiving: true,
      required: true,
      opens: { yes: ["credentials"] },
      because:
        "Every society asks for your IPI, and grant and sync paperwork asks for your member numbers. Kept here, nothing asks you twice. Say no and the checklist still works — it just won't remember.",
    },
    {
      id: "joined_which",
      order: 7,
      ask: {
        en: "Which ones have you already joined? Pick from the list above.",
        fr: "Auxquelles es-tu déjà inscrit·e ? Choisis dans la liste ci-dessus.",
      },
      topic: { en: "already joined", fr: "déjà inscrit" },
      type: "multi",
      required: true,
      showIf: (a) => a.store_ids === "yes",
      dependsOn: ["store_ids"],
      because:
        "Nothing already done gets recommended again.",
    },
    {
      id: "member_numbers",
      order: 8,
      ask: {
        en: "Your member number at each — like `socan 12345678`. Skip any you don't have to hand.",
        fr: "Ton numéro de membre à chacune — par exemple `socan 12345678`. Passe celles que tu n'as pas sous la main.",
      },
      topic: { en: "member numbers", fr: "numéros de membre" },
      type: "multi",
      required: false,
      showIf: (a) => a.store_ids === "yes",
      dependsOn: ["store_ids"],
      because:
        "A registration with no member number cannot be paid out, so it stays `in progress` rather than being marked done. That is the honest state, not a nag.",
    },
    {
      id: "ipi",
      order: 9,
      ask: {
        en: "Your IPI or CAE number? It's on your PRO account — 9 or 11 digits.",
        fr: "Ton numéro IPI ou CAE ? Il est dans ton compte de société — 9 ou 11 chiffres.",
      },
      topic: { en: "IPI number", fr: "numéro IPI" },
      type: "text",
      required: false,
      showIf: (a) => a.store_ids === "yes",
      dependsOn: ["store_ids"],
      because:
        "It is issued once and quoted at every society after. Once it is on file nothing asks again — and a typo in a number nobody proofreads is expensive to unwind.",
    },
    {
      id: "tax_form",
      order: 10,
      ask: {
        en: "Have you filed a W-8BEN with any US organization?",
        fr: "As-tu rempli un formulaire W-8BEN auprès d'une organisation américaine ?",
      },
      topic: { en: "US tax form", fr: "formulaire fiscal américain" },
      type: "choice",
      options: ["yes", "no", "not sure"],
      forgiving: true,
      required: false,
      showIf: (a) => a.store_ids === "yes" && a.country === "ca",
      dependsOn: ["store_ids", "country"],
      because:
        "Without it a US organization withholds 30% of everything it pays you. It is a form, not a fee, and it is the cheapest money you will ever recover.",
    },
  ],
};

export default FLOW;
