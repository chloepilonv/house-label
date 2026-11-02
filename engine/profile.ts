/**
 * `houselabel profile`: the artist's own row, created and edited only by the
 * artist (see ARTIST_OWNED_TABLES in data/artist/client.ts). A form, not a
 * conversation, because every other answer derives from this row. Questions
 * are data (QUESTIONS) so the review screen can re-run any one of them.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { checkbox, input, select } from "@inquirer/prompts";
import { bold, dim, gold } from "./banner";
import {
  ARTIST_TYPES, CAREER_STAGES, choices, CITIZENSHIPS, COUNTRIES, DISCIPLINES,
  LANGUAGES, MARKETS, PLATFORMS, REGIONS, timezoneFor, type Choice,
} from "./catalogue";
import { resolveConfig } from "./config";
import { parseMembers, readMembers, renderMembers, type Member } from "../data/artist/members";
import { strings, type Locale } from "./strings";

/** The columns this form owns. Other artist.profile columns are filled by
 *  departments, and this form must not blank them. */
export interface ProfileAnswers {
  artist_name: string;
  artist_type: string;
  members: Member[];
  project_description: string;
  languages: string[];
  preferred_locale: Locale;
  country: string;
  region: string;
  city: string;
  citizenship: string[];
  target_markets: string[];
  genres: string[];
  disciplines: string[];
  career_stage: string;
}

export interface Link {
  platform: string;
  url: string;
}

/** Everything the form collects, before any of it is written. */
export interface Draft {
  answers: ProfileAnswers;
  /** The links to keep, and the platforms whose rows to delete. */
  links: { keep: Link[]; drop: string[] };
}

type Row = Record<string, unknown>;
type Dict = Record<string, string>;

// ── helpers ───────────────────────────────────────────────────────────────

/** A checkbox pre-ticked from what is already on file, so editing is Enter. */
const ticked = <T>(list: Choice<T>[], locale: Locale, current: readonly T[]) =>
  choices(list, locale).map((c) => ({ ...c, checked: current.includes(c.value) }));

const asArray = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const asString = (v: unknown): string => (typeof v === "string" ? v : "");

const say = <T>(list: Choice<T>[], value: T, locale: Locale): string => {
  const hit = list.find((c) => c.value === value);
  return hit ? (locale === "fr" ? hit.fr : hit.en) : String(value ?? "");
};

const sayAll = (list: Choice<string>[], values: readonly string[], locale: Locale): string =>
  values.map((v) => say(list, v, locale)).join(", ");

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * Which passport option starts selected.
 *
 * No row yet: no default. `[]` is also "prefer not to say", so matching it
 * would make the first Enter answer that. Existing row: match it, `[]`
 * included, since the form always writes the column. Matched as a set,
 * because @inquirer compares defaults by identity.
 */
export function citizenshipDefault(
  existing: Row | null,
  current: readonly string[],
): string[] | undefined {
  if (!existing) return undefined;
  return CITIZENSHIPS.find((c) => sameSet(c.value, current))?.value;
}

/**
 * Which language the label writes to the artist in. Derived, never asked: the
 * current locale if they work in it, else the first language they named.
 */
export function writeIn(languages: readonly string[], locale: Locale): Locale {
  if (languages.includes(locale)) return locale;
  return (languages[0] as Locale) ?? locale;
}

// ── the questions, as data ────────────────────────────────────────────────

interface Ctx {
  draft: Draft;
  existing: Row | null;
  locale: Locale;
  t: Dict;
}

interface Question {
  id: string;
  /** Its name on the review screen. Short — it is a column header, not a prompt. */
  label: (t: Dict) => string;
  /** Hidden questions are neither asked nor numbered. */
  when?: (d: Draft) => boolean;
  ask: (c: Ctx) => Promise<void>;
  /** The answer, as the artist would read it back. */
  show: (c: Ctx) => string;
  /**
   * Questions whose answer stops making sense once this one changes (e.g.
   * `region` depends on `country`). They are re-asked, not kept or blanked.
   */
  invalidates?: string[];
}

const QUESTIONS: Question[] = [
  {
    id: "name",
    label: (t) => t.lblName!,
    ask: async ({ draft, t }) => {
      draft.answers.artist_name = await input({
        message: t.nameQ!,
        default: draft.answers.artist_name,
      });
    },
    show: ({ draft }) => draft.answers.artist_name,
  },
  {
    id: "type",
    label: (t) => t.lblType!,
    invalidates: ["members"],
    ask: async ({ draft, t, locale }) => {
      draft.answers.artist_type = await select({
        message: t.typeQ!,
        choices: choices(ARTIST_TYPES, locale),
        default: draft.answers.artist_type || undefined,
      });
    },
    show: ({ draft, locale }) => say(ARTIST_TYPES, draft.answers.artist_type, locale),
  },
  {
    id: "members",
    label: (t) => t.lblMembers!,
    when: (d) => d.answers.artist_type !== "solo" && d.answers.artist_type !== "",
    ask: async ({ draft, t }) => {
      draft.answers.members = parseMembers(
        await input({ message: t.membersQ!, default: renderMembers(draft.answers.members) }),
      );
    },
    show: ({ draft }) => renderMembers(draft.answers.members),
  },
  {
    id: "project",
    label: (t) => t.lblProject!,
    ask: async ({ draft, t }) => {
      draft.answers.project_description = await input({
        message: t.projectQ!,
        default: draft.answers.project_description,
      });
    },
    show: ({ draft }) => draft.answers.project_description,
  },
  {
    id: "languages",
    label: (t) => t.lblLanguages!,
    ask: async ({ draft, t, locale }) => {
      draft.answers.languages = await checkbox({
        message: t.languagesQ!,
        choices: ticked(LANGUAGES, locale, draft.answers.languages),
        required: true,
      });
      draft.answers.preferred_locale = writeIn(draft.answers.languages, locale);
    },
    show: ({ draft, locale }) => sayAll(LANGUAGES, draft.answers.languages, locale),
  },
  {
    id: "country",
    label: (t) => t.lblCountry!,
    invalidates: ["region"],
    ask: async ({ draft, t, locale }) => {
      draft.answers.country = await select({
        message: t.countryQ!,
        choices: choices(COUNTRIES, locale),
        default: draft.answers.country || undefined,
      });
    },
    show: ({ draft, locale }) => say(COUNTRIES, draft.answers.country, locale),
  },
  {
    id: "region",
    label: (t) => t.lblRegion!,
    ask: async ({ draft, t, locale }) => {
      const list = REGIONS[draft.answers.country]!;
      draft.answers.region = await select({
        message: t.regionQ!,
        choices: choices(list, locale),
        pageSize: 14,
        default: list.some((c) => c.value === draft.answers.region) ? draft.answers.region : undefined,
      });
    },
    show: ({ draft, locale }) =>
      say(REGIONS[draft.answers.country] ?? [], draft.answers.region, locale),
  },
  {
    id: "city",
    label: (t) => t.lblCity!,
    ask: async ({ draft, t }) => {
      draft.answers.city = await input({ message: t.cityQ!, default: draft.answers.city });
    },
    show: ({ draft }) => draft.answers.city,
  },
  {
    id: "citizenship",
    label: (t) => t.lblCitizenship!,
    ask: async ({ draft, existing, t, locale }) => {
      draft.answers.citizenship = (await select({
        message: t.citizenQ!,
        choices: choices(CITIZENSHIPS, locale),
        default: citizenshipDefault(existing, draft.answers.citizenship),
      })) as string[];
    },
    show: ({ draft, locale }) =>
      CITIZENSHIPS.filter((c) => sameSet(c.value, draft.answers.citizenship))
        .map((c) => (locale === "fr" ? c.fr : c.en))
        .join("") || "—",
  },
  {
    id: "markets",
    label: (t) => t.lblMarkets!,
    ask: async ({ draft, t, locale }) => {
      draft.answers.target_markets = await checkbox({
        message: t.marketsQ!,
        choices: ticked(MARKETS, locale, draft.answers.target_markets),
        required: true,
      });
    },
    show: ({ draft, locale }) => sayAll(MARKETS, draft.answers.target_markets, locale),
  },
  {
    id: "genres",
    label: (t) => t.lblGenres!,
    ask: async ({ draft, t }) => {
      draft.answers.genres = (await input({ message: t.genreQ!, default: draft.answers.genres.join(", ") }))
        .split(",")
        .map((g) => g.trim().toLowerCase())
        .filter(Boolean);
    },
    show: ({ draft }) => draft.answers.genres.join(", "),
  },
  {
    id: "disciplines",
    label: (t) => t.lblDisciplines!,
    ask: async ({ draft, t, locale }) => {
      draft.answers.disciplines = await checkbox({
        message: t.disciplineQ!,
        choices: ticked(DISCIPLINES, locale, draft.answers.disciplines),
      });
    },
    show: ({ draft, locale }) => sayAll(DISCIPLINES, draft.answers.disciplines, locale),
  },
  {
    id: "stage",
    label: (t) => t.lblStage!,
    ask: async ({ draft, t, locale }) => {
      draft.answers.career_stage = await select({
        message: t.stageQ!,
        choices: choices(CAREER_STAGES, locale),
        default: draft.answers.career_stage || undefined,
      });
    },
    show: ({ draft, locale }) => say(CAREER_STAGES, draft.answers.career_stage, locale),
  },
  {
    id: "links",
    label: (t) => t.lblLinks!,
    ask: async (c) => {
      c.draft.links = await askLinks(c.draft.links.keep, c.draft.links.drop, c.locale);
    },
    show: ({ draft, locale }) =>
      draft.links.keep.map((l) => say(PLATFORMS, l.platform, locale)).join(", "),
  },
];

/** The questions that apply to this draft, in order. Review numbers index it. */
const visible = (draft: Draft): Question[] => QUESTIONS.filter((q) => !q.when || q.when(draft));

/** The same list by id, in first-pass order. Exported for the no-repeat test. */
export const visibleQuestionIds = (draft: Draft): string[] => visible(draft).map((q) => q.id);

// ── links ─────────────────────────────────────────────────────────────────

/**
 * The last question, and the only one that can be left empty. Unticking a
 * platform that was on file deletes it.
 */
export async function askLinks(
  current: Link[],
  alreadyDropped: string[],
  locale: Locale,
): Promise<{ keep: Link[]; drop: string[] }> {
  const t = strings(locale);
  const had = current.map((p) => p.platform);
  const urlOf = new Map(current.map((p) => [p.platform, p.url]));

  const picked = await checkbox({
    message: t.linksQ!,
    choices: ticked(PLATFORMS, locale, had),
    pageSize: 12,
    required: false,
  });

  const keep: Link[] = [];
  for (const platform of picked) {
    const label = PLATFORMS.find((p) => p.value === platform)!;
    const url = (
      await input({
        // The skip hint is in the prompt, not only in the error, so the way
        // out is visible before the artist gets stuck.
        message: `  ${locale === "fr" ? label.fr : label.en} ${dim(t.linkSkip!)}`,
        default: urlOf.get(platform) ?? "",
        validate: (v) => (!v.trim() || /^https?:\/\/.+/.test(v.trim()) ? true : t.urlHttp!),
      })
    ).trim();
    // A ticked platform with no URL is skipped, not written (url is NOT NULL).
    if (url) keep.push({ platform, url });
  }

  const kept = new Set(keep.map((k) => k.platform));
  // Anything dropped on an earlier pass stays dropped unless re-added.
  const drop = [...new Set([...had, ...alreadyDropped])].filter((p) => !kept.has(p));
  return { keep, drop };
}

// ── the form ──────────────────────────────────────────────────────────────

/** A draft seeded from whatever is already on file. */
export function seedDraft(existing: Row | null, links: Link[], locale: Locale): Draft {
  const cur = existing ?? {};
  const languages = asArray(cur.languages).length ? asArray(cur.languages) : [locale];
  return {
    answers: {
      artist_name: asString(cur.artist_name),
      artist_type: asString(cur.artist_type),
      members: readMembers(cur.members),
      project_description: asString(cur.project_description),
      languages,
      preferred_locale: (asString(cur.preferred_locale) as Locale) || writeIn(languages, locale),
      country: asString(cur.country),
      region: asString(cur.region),
      city: asString(cur.city),
      citizenship: asArray(cur.citizenship),
      target_markets: asArray(cur.target_markets),
      genres: asArray(cur.genres),
      disciplines: asArray(cur.disciplines),
      career_stage: asString(cur.career_stage),
    },
    links: { keep: links, drop: [] },
  };
}

/**
 * Ask one question. On the review screen, also repair what its answer
 * invalidated. `repair` is off on the first pass, where those questions are
 * still ahead (otherwise they get asked twice). A question no longer visible
 * is reset, not re-asked.
 */
async function runQuestion(q: Question, c: Ctx, repair = true): Promise<void> {
  await q.ask(c);
  if (!repair) return;
  for (const id of q.invalidates ?? []) {
    const dep = QUESTIONS.find((x) => x.id === id)!;
    if (dep.when && !dep.when(c.draft)) {
      if (id === "members") c.draft.answers.members = [];
      continue;
    }
    await dep.ask(c);
  }
}

/** Every question, in order, seeded from what is already on file. */
export async function askProfile(existing: Row | null, links: Link[], locale: Locale): Promise<Draft> {
  const t = strings(locale);
  const draft = seedDraft(existing, links, locale);
  const c: Ctx = { draft, existing, locale, t };
  // `visible` is recomputed each step: an answer can make later questions exist.
  for (let i = 0; i < visible(draft).length; i++) await runQuestion(visible(draft)[i]!, c, false);
  return draft;
}

// ── review ────────────────────────────────────────────────────────────────

/**
 * Every answer on one numbered screen before anything is written, so the
 * artist can change any one by number.
 */
export function renderReview(c: Ctx): string {
  const qs = visible(c.draft);
  const width = Math.max(...qs.map((q) => q.label(c.t).length));
  return qs
    .map((q, i) => {
      const value = q.show(c).trim();
      return `  ${dim(String(i + 1).padStart(2))}  ${q.label(c.t).padEnd(width)}  ${
        value ? bold(value) : dim(c.t.reviewEmpty!)
      }`;
    })
    .join("\n");
}

/** Show it, let them fix any line, and return when they are done. */
export async function review(c: Ctx, head: string, why: string): Promise<void> {
  for (;;) {
    const qs = visible(c.draft);
    console.log(bold(`\n  ${head}`));
    console.log(dim(`  ${why}\n`));
    console.log(renderReview(c));
    console.log("");
    const pick = (
      await input({
        message: c.t.reviewQ!,
        validate: (v) => {
          if (!v.trim()) return true;
          const n = Number(v.trim());
          return Number.isInteger(n) && n >= 1 && n <= qs.length ? true : c.t.reviewBad!;
        },
      })
    ).trim();
    if (!pick) return;
    console.log("");
    await runQuestion(qs[Number(pick) - 1]!, c);
  }
}

// ── the command ───────────────────────────────────────────────────────────

/** Postgres 42P01, through whichever wrapper surfaced it. */
const isMissingTable = (err: unknown): boolean => {
  const e = err as { code?: string; message?: string };
  return e?.code === "42P01" || /does not exist/i.test(e?.message ?? "");
};

/**
 * Build the workspace root and `Artist/`, reported in one line. Never fatal:
 * the row is already saved. Silent when no Google account is connected.
 */
async function announceWorkspace(): Promise<void> {
  try {
    const { ensureArtistBranch, currentArtistName } = await import("./google/workspace");
    const branch = await ensureArtistBranch(await currentArtistName());
    if (!branch) return;
    console.log(dim(`  ✓ Drive: https://drive.google.com/drive/folders/${branch.rootId}`));
  } catch (err) {
    console.log(dim(`  ! Drive folder not built: ${(err as Error).message.split("\n")[0]}`));
    console.log(dim("    Everything is saved. `houselabel drive setup` retries it."));
  }
}

/** `houselabel profile`. Same screen whether the row exists or not. */
export async function profile(): Promise<void> {
  const cfg = await resolveConfig();
  if (!cfg) {
    console.log(`\n  ${dim("Not set up yet. Run")} ${bold("houselabel init")} ${dim("first.")}\n`);
    process.exit(1);
  }

  const { openArtist } = await import("../data/artist/client");
  let artist;
  try {
    artist = await openArtist();
  } catch (err) {
    console.log(`\n  ${dim(strings(cfg.locale ?? "en").profileNoDb!)}`);
    console.log(`  ${dim((err as Error).message.split("\n")[0])}\n`);
    process.exit(1);
  }

  try {
    // A database with no tables (right after `artist:reset`) would otherwise
    // surface as a Postgres stack trace.
    let existing: Row | null;
    let links: Link[];
    try {
      existing = await artist.one<Row>("profile", { id: 1 });
      links = await artist.query<Link>("platforms", {}, { orderBy: "platform asc" });
    } catch (err) {
      if (!isMissingTable(err)) throw err;
      const t = strings(cfg.locale ?? "en");
      console.log(`\n  ${dim(t.profileNoTables!)}`);
      console.log(`  ${bold("houselabel init")} ${dim(t.profileNoTablesFix!)}\n`);
      await artist.close();
      process.exit(1);
    }

    // The form speaks the language the artist last chose, not the CLI's.
    const locale = ((existing?.preferred_locale as Locale) ?? cfg.locale ?? "en") as Locale;
    const t = strings(locale);

    // An existing profile opens on the review screen.
    let draft: Draft;
    if (existing) {
      draft = seedDraft(existing, links, locale);
    } else {
      console.log(bold(`\n  ${t.profileHead}`));
      // Announce the review before the first question.
      console.log(dim(`  ${t.profileHeadsUp}\n`));
      draft = await askProfile(existing, links, locale);
    }

    const before = JSON.stringify(draft);
    await review(
      { draft, existing, locale, t },
      existing ? t.profileEditHead! : t.reviewHead!,
      existing ? t.profileEditWhy! : t.reviewWhy!,
    );
    const untouched = existing !== null && JSON.stringify(draft) === before;

    // id is written explicitly: artist.profile is a single row pinned to 1 by
    // a check constraint, and upsert() nulls any conflict column left out.
    await artist.upsert(
      "profile",
      {
        id: 1,
        ...draft.answers,
        members: JSON.stringify(draft.answers.members),
        timezone: timezoneFor(draft.answers.country, draft.answers.region),
      },
      ["id"],
    );

    for (const { platform, url } of draft.links.keep)
      await artist.upsert("platforms", { platform, url }, ["platform"]);
    for (const platform of draft.links.drop) await artist.remove("platforms", { platform });

    // Say "unchanged" rather than "updated" when nothing moved.
    console.log(
      gold(
        `\n  ✓ ${untouched ? t.profileUnchanged : existing ? t.profileUpdated : t.profileCreated}${untouched ? "." : "!"}`,
      ),
    );
    if (!untouched) console.log(dim(`  ${t.profileWhoReads}`));

    // The workspace root and `Artist/` belong to this command, not a
    // department: `Artist/` exists before any release. A script keeps its name stable.
    await announceWorkspace();

    console.log(dim(`  ${t.profileAgain}\n`));
  } finally {
    await artist.close();
  }
}
