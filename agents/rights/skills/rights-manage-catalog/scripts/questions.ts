/**
 * The catalog interview: one song into the catalog, by hand or out of a file.
 *
 * Entry mode comes first: manual and file both produce an `artist.songs` row.
 * The file branch asks only privacy consent (the file leaves the machine) and
 * the merge policy. Shares are not enforced here; `check-splits.ts` does the math.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { Flow } from "../../../../../engine/interview/core";

export const FLOW: Flow = {
  name: "rights-manage-catalog",

  questions: [
    {
      id: "action",
      order: 1,
      ask: {
        en: "What are we doing — looking at the catalog you have, or adding to it?",
        fr: "On fait quoi — on regarde le catalogue que tu as, ou on y ajoute ?",
      },
      topic: { en: "what we're doing", fr: "ce qu'on fait" },
      type: "choice",
      options: ["see my catalog", "add by hand", "add from a file"],
      forgiving: true,
      required: true,
      opens: {
        "see my catalog": ["read"],
        "add by hand": ["manual"],
        "add from a file": ["import"],
      },
      because:
        "Seeing what you already have is the commonest reason to open this, and it should not cost you an interview. Picking it ends the questions here and prints the catalog.",
    },

    // ── the file branch ────────────────────────────────────────────────────
    {
      id: "file_consent",
      order: 2,
      ask: {
        en: "The file goes to Anthropic's API to be read. Titles, ISRCs, UPCs and writer credits are public identifiers and fine. Don't send anything holding passwords, bank details or logins. OK to continue?",
        fr: "Le fichier sera envoyé à l'API d'Anthropic pour être lu. Les titres, ISRC, UPC et crédits d'auteur sont des identifiants publics, aucun problème. N'envoie rien contenant des mots de passe, coordonnées bancaires ou identifiants de connexion. On continue ?",
      },
      topic: { en: "privacy", fr: "confidentialité" },
      type: "choice",
      options: ["yes", "no"],
      forgiving: true,
      required: true,
      showIf: (a) => a.action === "add from a file",
      dependsOn: ["action"],
      because:
        "The file leaves your machine. You should know that before it does, not after.",
    },
    {
      id: "file_path",
      order: 3,
      ask: {
        en: "Where's the file? CSV, XLS, XLSX, PDF or a screenshot, up to 15 MB.",
        fr: "Où est le fichier ? CSV, XLS, XLSX, PDF ou une capture d'écran, jusqu'à 15 Mo.",
      },
      topic: { en: "the file", fr: "le fichier" },
      type: "text",
      required: true,
      showIf: (a) => a.action === "add from a file" && a.file_consent === "yes",
      dependsOn: ["action", "file_consent"],
      because:
        "Its name is recorded on every row it creates, as `source_label`. That is what makes a bad import reversible.",
    },
    {
      id: "merge_policy",
      order: 4,
      ask: {
        en: "When a song in the file matches one you already have, what should I do by default?",
        fr: "Quand une chanson du fichier correspond à une que tu as déjà, que dois-je faire par défaut ?",
      },
      topic: { en: "on a match", fr: "en cas de correspondance" },
      type: "choice",
      options: ["ask me row by row", "fill blanks only, never overwrite", "skip it"],
      forgiving: true,
      required: true,
      showIf: (a) => a.action === "add from a file" && a.file_consent === "yes",
      dependsOn: ["action", "file_consent"],
      because:
        "The import never overwrites a value you already have without being told to. This sets the default; you still see every decision before anything is committed.",
    },

    // ── the manual branch ──────────────────────────────────────────────────
    {
      id: "title",
      order: 5,
      ask: { en: "What's the song called?", fr: "Quel est le titre de la chanson ?" },
      topic: { en: "title", fr: "titre" },
      type: "text",
      required: true,
      showIf: (a) => a.action === "add by hand",
      dependsOn: ["action"],
      because:
        "It is the only field a song cannot be saved without. Everything else can be filled in later.",
    },
    {
      id: "isrc",
      order: 6,
      ask: {
        en: "Do you have an ISRC for it? Leave it blank if not — most distributors issue one when you release.",
        fr: "As-tu un ISRC pour cette chanson ? Laisse vide sinon — la plupart des distributeurs en émettent un à la sortie.",
      },
      topic: { en: "ISRC", fr: "ISRC" },
      type: "text",
      required: false,
      showIf: (a) => a.action === "add by hand",
      dependsOn: ["action"],
      because:
        "The ISRC identifies the recording. Without it, SoundExchange and Re:Sound cannot match a play to your master, so the money sits unclaimed.",
    },
    {
      id: "writer_shares",
      order: 8,
      ask: {
        en: "COMPOSITION — the split, name and percentage together: `you 50, sam 50`. Must total 100.",
        fr: "COMPOSITION — le partage, nom et pourcentage ensemble : `toi 50, sam 50`. Le total doit faire 100.",
      },
      topic: { en: "composition split", fr: "partage de composition" },
      type: "multi",
      required: true,
      showIf: (a) => a.action === "add by hand",
      dependsOn: ["action"],
      because:
        "This is its own 100% pie, independent of the recording. An undocumented split is the most common reason royalties sit frozen at a society: they collect the money and cannot pay it out until every writer agrees on the number.",
    },
    {
      id: "publisher",
      order: 9,
      ask: {
        en: "COMPOSITION — do you have a publisher or an admin like Songtrust? Say no if not.",
        fr: "COMPOSITION — as-tu un éditeur ou un administrateur comme Songtrust ? Dis non sinon.",
      },
      topic: { en: "publisher", fr: "éditeur" },
      type: "text",
      required: false,
      showIf: (a) => a.action === "add by hand",
      dependsOn: ["action"],
      because:
        "Societies pay a writer share and a publisher share separately — roughly half each. With no publisher, that half is still yours to claim; unclaimed, it stays with the society.",
    },
    {
      id: "master_shares",
      order: 11,
      ask: {
        en: "MASTER — the split, name and percentage together: `you 80, producer 20`. Must total 100.",
        fr: "MASTER — le partage, nom et pourcentage ensemble : `toi 80, réalisateur 20`. Le total doit faire 100.",
      },
      topic: { en: "master split", fr: "partage du master" },
      type: "multi",
      required: true,
      showIf: (a) => a.action === "add by hand",
      dependsOn: ["action"],
      because:
        "The second 100% pie. Producer points come out of this one, usually 2 to 5. Do not confuse it with the SoundExchange statutory split — 45% featured artist, 5% non-featured, 50% owner — which is fixed by US law and applies on top of whatever you enter here.",
    },
    {
      id: "release",
      order: 12,
      ask: {
        en: "Is it on a release? Name the single, EP or album, or say not yet.",
        fr: "Fait-elle partie d'une sortie ? Nomme le simple, l'EP ou l'album, ou dis pas encore.",
      },
      topic: { en: "release", fr: "sortie" },
      type: "text",
      required: false,
      showIf: (a) => a.action === "add by hand",
      dependsOn: ["action"],
      because:
        "The UPC lives on the release, not the song, and the label manager plans dates against it.",
    },
  ],
};

export default FLOW;
