/**
 * Spec of `<Release> — Release-Credits`, the one sheet per release holding
 * every fact a rights platform asks for. Fits US, Canada and Québec at once.
 * Columns have a `key` (code) and a human `label`; rows reference songs by
 * title and people by name, with one grey "System ID" column for the seed.
 *
 * Tabs:
 *
 *   RELEASE_CREDITS  the record — one row, ℗ and © included
 *   SONG_CREDITS     one row per song — codes, duration, version, genre
 *   SONG_SPLITS      one row per song and person — three groups side by side,
 *                    COMPOSITION RIGHTS · MASTER · PERFORMER, each Name and %
 *   PEOPLE_INFO      one row per person, ever — contact, SIN, IPI, GST, QST
 *   GLOSSARY         every term above, one sentence and one example, EN + FR
 *
 * Input only: `rights-manage-catalog` imports it into `artist.*`, which stays
 * the source of truth. The credits Doc is generated from those rows.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

export interface Column {
  /** What the code and the importer call it. Never shown. */
  key: string;
  /** What the sheet shows in the header row. */
  label: string;
  /** A database id, greyed out and last — the seed's, not the artist's. */
  system?: boolean;
}

/** A merged cell above the header spanning `span` columns. Only SONG_SPLITS has them, so its header is row 2. */
export interface HeaderGroup {
  label: string;
  span: number;
}

export interface TabSpec {
  title: string;
  /** Shown as a note on cell A1, so the tab explains itself on hover. */
  purpose: string;
  columns: Column[];
  /** Header labels, in order. Derived from `columns`. */
  headers: string[];
  /** The row above the header, when the tab has one. Spans sum to the width. */
  groups?: HeaderGroup[];
  /** Rows written under the header at creation. Only GLOSSARY has any. */
  rows?: string[][];
}

/** Tab titles: a star on the tabs to fill, a book on the one to read. sheets.ts quotes every range. */
export const TITLES = {
  release: "⭐ RELEASE_CREDITS",
  songs: "⭐ SONG_CREDITS",
  splits: "⭐ SONG_SPLITS",
  people: "⭐ PEOPLE_INFO",
  glossary: "📚 GLOSSARY",
} as const;

/** "⭐ SONG_SPLITS" → "SONG_SPLITS": the title without its emoji, upper-cased. */
export const bareTitle = (title: string): string => title.replace(/^[^\p{L}\p{N}]+/u, "").trim().toUpperCase();

const SYSTEM_ID = "System ID — don't edit";
const SONG_REF = `Song (title, as in ${bareTitle(TITLES.songs)})`;

const c = (key: string, label: string): Column => ({ key, label });
const sys = (key: string): Column => ({ key, label: SYSTEM_ID, system: true });

function tab(
  title: string,
  purpose: string,
  columns: Column[],
  extra: { rows?: string[][]; groups?: HeaderGroup[] } = {},
): TabSpec {
  const spec: TabSpec = { title, purpose, columns, headers: columns.map((x) => x.label) };
  if (extra.rows) spec.rows = extra.rows;
  if (extra.groups) {
    const span = extra.groups.reduce((n, g) => n + g.span, 0);
    if (span !== columns.length) throw new Error(`${title}: groups span ${span} columns, tab has ${columns.length}`);
    spec.groups = extra.groups;
  }
  return spec;
}

/** The three rights, in SONG_SPLITS group order. French terms are in the GLOSSARY. */
export const RIGHT_TYPES = ["composition", "master", "performer"] as const;

/** The group label over each right's Name and % columns, as the sheet shows it. */
export const RIGHT_GROUPS: Record<(typeof RIGHT_TYPES)[number], string> = {
  composition: "COMPOSITION RIGHTS",
  master: "MASTER",
  performer: "PERFORMER",
};

/** How many rows the header takes: two when there is a group row, else one. */
export const headerRows = (t: { groups?: HeaderGroup[] }): number => (t.groups ? 2 : 1);

/**
 * Frozen leading columns: two, except Sheets cannot merge across the freeze
 * edge, so a grouped tab freezes up to the last group edge at or before
 * column 2 (SONG_SPLITS freezes one).
 */
export function frozenColumns(t: { groups?: HeaderGroup[] }): number {
  if (!t.groups) return 2;
  let edge = 0;
  let best = 0;
  for (const g of t.groups) {
    edge += g.span;
    if (edge <= 2) best = edge;
  }
  return best;
}

/** The group row as cells: the label in the first column of its span, blanks after. */
export function groupRow(groups: HeaderGroup[]): string[] {
  return groups.flatMap((g) => [g.label, ...Array<string>(g.span - 1).fill("")]);
}

/** The GLOSSARY tab: one row per column label, with a sentence, an example and the French. */
const GLOSSARY: string[][] = [
  ["Right — composition", "The song itself, words and music. Its money is collected by a PRO (SOCAN, ASCAP, BMI). The COMPOSITION RIGHTS group on SONG_SPLITS.", "Name = Odile Ray · % = 50", "auteur-compositeur — l'œuvre : paroles et musique"],
  ["Right — master", "The recording as a sound file — who owns it and who the distributor pays. The MASTER group on SONG_SPLITS.", "Name = Odile Ray · % = 80 / Name = Producer X · % = 20", "masters / enregistrements — droit voisin, côté propriétaire"],
  ["Right — performer", "Whoever played or sang on the recording. Neighbouring-rights money, collected by Artisti / SoundExchange. The PERFORMER group on SONG_SPLITS.", "Name = Session drummer · % = 10", "interprète — droit voisin, côté artiste"],
  ["%", "This person's share of ONE right on ONE song. Each of the three groups totals 100 per song.", "composer 50 + lyricist 50 = 100", "part en pourcentage — 100 par droit, par chanson"],
  ["Recording code (ISRC)", "The recording's 12-character ID. One per recording; a remix gets a new one. Your distributor assigns it if you have none.", "CA-6P8-26-00001", "code ISRC — identifie l'enregistrement"],
  ["Song code (ISWC)", "The song's ID, assigned by your PRO after you register the work. Same song, every recording.", "T-123.456.789-0", "code ISWC — identifie l'œuvre"],
  ["Barcode (UPC)", "The release's barcode. One per album / EP / single, from the distributor.", "0 12345 67890 5", "code-barres de la parution"],
  ["Writer number (IPI)", "Your writer/publisher number, issued when you join a PRO (SOCAN, ASCAP, BMI). Needed on every composition split or the share cannot be paid. No IPI yet? Put the SOCAN member number instead.", "00012345678", "numéro IPI — à défaut, le numéro de membre SOCAN"],
  ["SIN (NAS)", "Social insurance number — needed to pay a person and issue their tax slip. This file has no per-cell permissions: share it only with people who may read every row.", "123 456 789", "numéro d'assurance sociale (NAS) — pour payer et produire le relevé fiscal"],
  ["GST/HST number / QST number", "Sales-tax registration numbers, for people who invoice you. Blank for individuals under the threshold.", "123456789 RT0001 · 1234567890 TQ0001", "numéros de TPS/TVH et de TVQ"],
  ["Who owns the recording (℗)", "The ℗ line stores print: who owns the sound recording, and the year it was first released. Usually the label, or you if self-released.", "℗ 2026 Odile Ray", "propriétaire de l'enregistrement (℗), et l'année de première parution"],
  ["Who owns the song (©)", "The © line stores print: who owns the composition — the writer, or their publisher — and the year it was first published.", "© 2026 Odile Ray / Éditions X", "propriétaire de l'œuvre (©), et l'année de première publication"],
  ["Version", "What kind of recording this is. Changes whether it needs its own ISRC.", "original · remix · live · acoustic · radio edit", "type de version"],
  ["Explicit lyrics?", "Whether the lyrics need a parental-advisory flag on stores.", "yes · no · clean version", "contenu explicite"],
  [SYSTEM_ID, "The database's own number for that row. Leave it alone — it is how a re-run knows what is already here and adds only what is missing.", "4c3b3e5b-…", "identifiant système — ne pas modifier"],
];

export const TABS: TabSpec[] = [
  tab(
    TITLES.release,
    "The record. One row. ℗ is the recording's owner, © the song's — stores want both.",
    [
      c("title", "Title"),
      c("release_type", "Type (single / EP / album)"),
      c("release_date", "Release date"),
      c("upc", "Barcode (UPC)"),
      c("label", "Label"),
      c("distributor", "Distributor"),
      c("p_year", "Year the recording was first released (℗)"),
      c("p_owner", "Who owns the recording (℗)"),
      c("c_year", "Year the song was first published (©)"),
      c("c_owner", "Who owns the song — writer or publisher (©)"),
      c("cover_artwork_by", "Cover artwork by"),
      c("cover_photo_by", "Cover photo by"),
      c("art_direction", "Art direction"),
      c("design", "Design"),
      c("recorded_at", "Recorded at"),
      c("mixed_at", "Mixed at"),
      c("mastered_at", "Mastered at"),
      sys("release_id"),
    ],
  ),
  tab(
    TITLES.songs,
    "One row per song. Seeded from your catalog; add what is missing.",
    [
      c("track_number", "Track #"),
      c("title", "Title"),
      c("isrc", "Recording code (ISRC)"),
      c("iswc", "Song code (ISWC)"),
      c("duration", "Duration (m:ss)"),
      c("version_type", "Version (original, remix, live…)"),
      c("explicit", "Explicit lyrics?"),
      c("genre", "Genre"),
      c("subgenre", "Sub-genre"),
      c("language", "Language"),
      c("lyrics_url", "Lyrics (link)"),
      sys("song_id"),
    ],
  ),
  tab(
    TITLES.splits,
    "One row per person, per song. Three groups side by side — COMPOSITION RIGHTS, MASTER, PERFORMER — each a Name and a %. Each group totals 100 per song; leave a group blank when the person has no share in it.",
    [
      c("song", SONG_REF),
      c("composition_name", "Name"),
      c("composition_share", "%"),
      c("master_name", "Name"),
      c("master_share", "%"),
      c("performer_name", "Name"),
      c("performer_share", "%"),
    ],
    {
      groups: [
        { label: "", span: 1 },
        { label: RIGHT_GROUPS.composition, span: 2 },
        { label: RIGHT_GROUPS.master, span: 2 },
        { label: RIGHT_GROUPS.performer, span: 2 },
      ],
    },
  ),
  tab(
    TITLES.people,
    "One row per person, ever. Never type anyone twice. This tab holds a SIN, so share the file only with people who may read every row.",
    [
      c("first_name", "First name"),
      c("last_name", "Last name"),
      c("position", "Role / position"),
      c("email", "Email"),
      c("phone", "Phone"),
      c("postal_address", "Postal address"),
      c("sin", "SIN (NAS)"),
      c("ipi", "Writer number (IPI) — or SOCAN member #"),
      c("gst_hst_number", "GST/HST number (TPS)"),
      c("qst_number", "QST number (TVQ)"),
    ],
  ),
  tab(
    TITLES.glossary,
    "Every term in this sheet — one sentence, one example, in French too.",
    [c("term", "Term"), c("what_it_is", "What it is"), c("example", "Example"), c("en_francais", "En français")],
    { rows: GLOSSARY },
  ),
];

/**
 * Old or hand-edited tab titles → current spec tab, applied by `reconcileTabs`
 * in sheets.ts before adding anything. A title in neither this nor TABS is
 * deleted when empty, kept and reported when not.
 */
export const LEGACY_TITLES: Record<string, string> = {
  RELEASE: "RELEASE_CREDITS",
  SONGS: "SONG_CREDITS",
  SONGS_CREDITS: "SONG_CREDITS",
  PEOPLE: "PEOPLE_INFO",
  SPLITS: "SONG_SPLITS",
  SONGS_SPLITS: "SONG_SPLITS",
};

/**
 * The spec tab an existing title stands for, or null. "SONGS_SPLITS" — an
 * older spelling, with or without a star — is "⭐ SONG_SPLITS".
 */
export function targetTitle(title: string): string | null {
  const bare = bareTitle(title);
  const spec = TABS.find((t) => bareTitle(t.title) === bare);
  if (spec) return spec.title;
  const legacy = LEGACY_TITLES[bare];
  return legacy ? (TABS.find((t) => bareTitle(t.title) === legacy)?.title ?? null) : null;
}

/** `Nightdrive — Release-Credits`. Named from the release so two are two files. */
export function sheetName(releaseTitle: string): string {
  return `${releaseTitle.replace(/[/\\]/g, "-").trim()} — Release-Credits`;
}

/** The header label for a key, so the seed writes into the right column by name. */
export function labelOf(tabTitle: string, key: string): string {
  const t = TABS.find((x) => x.title === tabTitle);
  const col = t?.columns.find((x) => x.key === key);
  if (!col) throw new Error(`no column "${key}" on ${tabTitle}`);
  return col.label;
}

/** Column indexes that are system ids — greyed out by the styling pass. */
export const systemColumns = (t: TabSpec) =>
  t.columns.map((x, i) => (x.system ? i : -1)).filter((i) => i >= 0);

/** Every glossary term, for the test that keeps them in step with the labels. */
export const GLOSSARY_TERMS = GLOSSARY.map((r) => r[0]);
