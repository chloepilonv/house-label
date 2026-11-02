/**
 * The scoping interview, one question at a time, saved only when asked.
 *
 *   bun run agents/label-manager/skills/manager-scope-project/scripts/scope.ts next
 *   bun run .../scope.ts answer street_date 2026-10-30
 *   bun run .../scope.ts why physical
 *   bun run .../scope.ts save
 *   bun run .../scope.ts reset
 *
 * Rules: `next` prints exactly one question (no command prints the whole set),
 * and nothing is written until `save`. Lines starting with `# ` are for the
 * agent only; every other line is artist-facing, with no schema vocabulary.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import postgres from "postgres";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  QUESTIONS, askable, branchesFor, missingRequired, plannedTotal, validate,
  type Question, type QuestionId,
} from "./questions";

type Lang = "en" | "fr";
type Answers = Partial<Record<QuestionId, string | string[]>>;

const DRAFT_DIR = ".plans";
const DRAFT = join(DRAFT_DIR, "scope.draft.json");

interface Draft {
  answers: Answers;
  lang: Lang;
  /** Set once saved, so a later `save` updates instead of duplicating. */
  project_id?: string;
  /** What we offered from their existing data, and where each came from. */
  offered: Partial<Record<QuestionId, { value: string | string[]; from: string }>>;
}

const [cmd = "next", ...rest] = process.argv.slice(2);

const readDraft = (): Draft =>
  existsSync(DRAFT)
    ? JSON.parse(readFileSync(DRAFT, "utf8"))
    : { answers: {}, lang: "en", offered: {} };

const writeDraft = (d: Draft) => {
  mkdirSync(DRAFT_DIR, { recursive: true });
  writeFileSync(DRAFT, JSON.stringify(d, null, 2));
};

const L = {
  en: {
    of: (n: number, t: number) => `Question ${n} of ${t}`,
    options: "options",
    suggested: "suggested",
    accept: "say yes to take it, or give me another",
    done: "That's everything I need.",
    save: "Want me to save this project?",
    blocked: (ids: string[]) =>
      `Still missing before I can build a plan: ${ids.join(", ")}.`,
    saved: (t: string) => `Saved: ${t}.`,
    reset: "Draft cleared. Nothing was saved.",
    unknownOk: '"I don\'t know" is a real answer here — it keeps the question open for later.',
    branches: "What this project contains",
  },
  fr: {
    of: (n: number, t: number) => `Question ${n} sur ${t}`,
    options: "choix",
    suggested: "suggéré",
    accept: "dis oui pour le prendre, ou donne-moi autre chose",
    done: "J'ai tout ce qu'il me faut.",
    save: "Je sauvegarde le projet ?",
    blocked: (ids: string[]) =>
      `Il manque encore ceci avant de bâtir un plan : ${ids.join(", ")}.`,
    saved: (t: string) => `Sauvegardé : ${t}.`,
    reset: "Brouillon effacé. Rien n'a été sauvegardé.",
    unknownOk: '« Je ne sais pas » est une vraie réponse ici — la question reste ouverte pour plus tard.',
    branches: "Ce que ce projet contient",
  },
} as const;

const HERE = "agents/label-manager/skills/manager-scope-project/scripts/scope.ts";

/** Region → the markets answer it justifies OFFERING. Never adopted silently. */
const MARKETS_FROM_REGION: Record<string, string[]> = { QC: ["quebec", "canada"] };

const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);

/**
 * Prefill offers from the artist's own data. Read once on the first `next` and
 * cached in the draft, so the interview does not depend on the DB mid-way.
 * Only an unset DATABASE_URL means "no data"; a missing .env file does not.
 */
async function loadOffers(): Promise<{ offered: Draft["offered"]; lang: Lang }> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "✗ DATABASE_URL is not set. That, and only that, means there is no artist\n" +
        "  data to pre-fill from. Set it and re-run — do not report the profile\n" +
        "  as empty.",
    );
    process.exit(1);
  }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const offered: Draft["offered"] = {};
  let lang: Lang = "en";
  try {
    const [profile] = await sql`
      select artist_name, country, region, preferred_locale
        from artist.profile order by id limit 1`;
    const [release] = await sql`
      select title, release_type, release_date
        from artist.releases order by release_date desc nulls last limit 1`;
    // The project already scoped, so re-scoping does not start from zero.
    const [project] = await sql`
      select title, project_type, street_date, physical, recording_status,
             markets, budget_amount, budget_currency, scope
        from artist.projects order by created_at desc limit 1`;

    if (profile?.preferred_locale?.startsWith("fr")) lang = "fr";
    if (profile?.country === "CA" && profile?.region && MARKETS_FROM_REGION[profile.region]) {
      offered.markets = {
        value: MARKETS_FROM_REGION[profile.region],
        from: lang === "fr" ? `tu es au ${profile.region}` : `you're based in ${profile.region}`,
      };
    }
    if (project?.title) {
      const from = lang === "fr"
        ? `déjà noté pour « ${project.title} »`
        : `already noted for "${project.title}"`;
      offered.title = { value: project.title, from };
      for (const [col, id] of [
        ["project_type", "project_type"],
        ["street_date", "street_date"],
        ["physical", "physical"],
        ["recording_status", "recording_status"],
      ] as [string, QuestionId][]) {
        if (project[col] != null) offered[id] = { value: String(day(project[col])), from };
      }
      if (project.markets?.length) offered.markets = { value: project.markets, from };
      if (project.budget_amount != null) {
        offered.budget = {
          value: `${project.budget_currency ?? ""} ${project.budget_amount}`.trim(),
          from,
        };
      }
      // The answers that live only in `scope` — merch, covers.
      for (const [k, v] of Object.entries(project.scope ?? {})) {
        if (k === "locale" || offered[k as QuestionId] || v == null) continue;
        if (QUESTIONS.some((q) => q.id === k)) {
          offered[k as QuestionId] = { value: v as string, from };
        }
      }
    }
    if (!project && release?.title) {
      const from = lang === "fr"
        ? `d'après « ${release.title} », déjà dans ton catalogue`
        : `from "${release.title}", already in your catalogue`;
      offered.title = { value: release.title, from };
      if (release.release_type) offered.project_type = { value: release.release_type, from };
      if (release.release_date) offered.street_date = { value: String(day(release.release_date)), from };
    }
  } finally {
    await sql.end();
  }
  return { offered, lang };
}

/** Dates: a full day, a month aimed at, or nothing yet. All three are answers. */
function normalizeDate(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (["unknown", "none", "no", "nothing", "idk", "je ne sais pas", "rien", "non"].includes(v)) {
    return "unknown";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{4}-\d{2}$/.test(v)) return `${v}-01`;
  return raw.trim();
}

function normalize(q: Question, raw: string): string | string[] {
  if (q.type === "date") return normalizeDate(raw);
  if (q.type === "multi") return raw.split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (q.type === "choice") return raw.trim().toLowerCase();
    // A track is a title; a bare yes/no means "ask me for the title".
  if (q.type === "track" && /^(yes|oui|y|no|non|n|none)$/i.test(raw.trim())) return "";
  return raw.trim();
}

function askOne(q: Question, d: Draft, n: number, total: number) {
  const t = L[d.lang];
  console.log(`${t.of(n, total)} — ${q.topic[d.lang]}`);
  console.log();
  console.log(q.ask[d.lang]);
  if (q.options?.length) console.log(`  ${t.options}: ${q.options.join(" · ")}`);
  const offer = d.offered[q.id];
  if (offer) {
    const v = Array.isArray(offer.value) ? offer.value.join(", ") : offer.value;
    console.log(`  ${t.suggested}: ${v} — ${offer.from} · ${t.accept}`);
  }
  if (!q.required) console.log(`  ${t.unknownOk}`);
  console.log(`\n# next: bun run ${HERE} answer ${q.id} <value>`);
  console.log(`# why:  bun run ${HERE} why ${q.id}   (only if the artist asks)`);
}

function summarize(d: Draft) {
  const t = L[d.lang];
  const list = askable(d.answers);
  console.log(t.done);
  console.log();
  for (const q of list) {
    const v = d.answers[q.id];
    if (v === undefined) continue;
    console.log(`  ${q.topic[d.lang].padEnd(24)} ${Array.isArray(v) ? v.join(", ") : v}`);
  }
  const branches = branchesFor(d.answers);
  console.log(`\n${t.branches}: ${branches.join(" · ")}`);
  const missing = missingRequired(d.answers);
  if (missing.length) {
    const topics = missing.map((id) => QUESTIONS.find((q) => q.id === id)!.topic[d.lang]);
    console.log(`\n${t.blocked(topics)}`);
    console.log(`# blocked: answer those before planning`);
    return;
  }
  console.log(`\n${t.save}`);
  console.log(`\n# on yes:    bun run ${HERE} save`);
  console.log(`# on change: bun run ${HERE} answer <id> <value>`);
}

// ── commands ───────────────────────────────────────────────────────────────

if (cmd === "reset") {
  if (existsSync(DRAFT)) rmSync(DRAFT);
  console.log(L.en.reset);
  process.exit(0);
}

if (cmd === "why") {
  const q = QUESTIONS.find((x) => x.id === rest[0]);
  if (!q) { console.error(`✗ No question called "${rest[0]}".`); process.exit(1); }
  console.log(q.because);
  process.exit(0);
}

const draft = readDraft();

if (cmd === "answer" || cmd === "set") {
  const [id, ...value] = rest;
  const q = QUESTIONS.find((x) => x.id === id);
  if (!q) {
    console.error(`✗ No question called "${id}". Known: ${QUESTIONS.map((x) => x.id).join(", ")}`);
    process.exit(1);
  }
  if (!value.length) { console.error(`✗ No answer given for ${id}.`); process.exit(1); }
  const normalized = normalize(q, value.join(" "));
  const bad = validate(q, normalized);
  if (bad) {
    // Draft untouched: the artist re-answers this one question.
    console.error(`✗ ${bad}`);
    process.exit(1);
  }
  draft.answers[q.id] = normalized;
  // Language never changes mid-interview: preferred_locale is the only source.
  delete draft.offered[q.id];
  writeDraft(draft);
}

if (cmd === "save") {
  const missing = missingRequired(draft.answers);
  if (missing.length) {
    console.error(`✗ ${L[draft.lang].blocked(missing)}`);
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("✗ DATABASE_URL is not set."); process.exit(1); }
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const a = draft.answers;
  const dateOrNull = (v: unknown) =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  try {
    const row = {
      title: String(a.title),
      project_type: String(a.project_type),
      street_date: dateOrNull(a.street_date),
      date_is_target: typeof a.street_date === "string" && a.street_date.endsWith("-01"),
      physical: String(a.physical ?? "none"),
      recording_status: String(a.recording_status ?? "not_started"),
      markets: (Array.isArray(a.markets) ? a.markets : []) as string[],
      lead_single_date: dateOrNull(a.lead_single_date),
      masters_ready_on: dateOrNull(a.masters_ready),
      budget_amount: typeof a.budget === "string" ? Number(a.budget.replace(/[^\d.]/g, "")) || null : null,
      budget_currency: typeof a.budget === "string" && /usd/i.test(a.budget) ? "USD"
        : typeof a.budget === "string" && /\d/.test(a.budget) ? "CAD" : null,
      scope: { ...a, locale: draft.lang },
    };
    // Identity is the title, not a draft-local id, so clearing the draft does
    // not create a duplicate row.
    const [existing] = await sql`
      select id from artist.projects where title = ${row.title} order by created_at desc limit 1`;
    const target = draft.project_id ?? existing?.id ?? null;
    const [saved] = target
      ? await sql`update artist.projects set ${sql(row)} where id = ${target} returning id, title`
      : await sql`insert into artist.projects ${sql(row)} returning id, title`;
    draft.project_id = saved.id;
    writeDraft(draft);
    console.log(L[draft.lang].saved(saved.title));

    // The release row other departments read; without it they use the newest old release.
    const { ensureReleaseForProject } = await import("../../../../../data/artist/release-link");
    await ensureReleaseForProject(sql, { id: saved.id, title: row.title, project_type: row.project_type, street_date: row.street_date });

    // The Drive release folder. Scripted because its name is derived from the
    // row (engine/google/workspace.ts); a model-chosen name would drift into a
    // second folder. Never fatal: Google is often not connected.
    try {
      const { ensureReleaseBranch, ensureCreditsSheet, currentArtistName } = await import(
        "../../../../../engine/google/workspace"
      );
      const branch = await ensureReleaseBranch(await currentArtistName(), row);
      if (branch) {
        await sql`update artist.projects set drive_folder_id = ${branch.releaseId} where id = ${saved.id}`;
        console.log(
          draft.lang === "fr"
            ? `\nDossier Drive : ${branch.url}\n  Dépose tes masters dans Songs/Audio, ta pochette dans Artwork.`
            : `\nDrive folder: ${branch.url}\n  Masters go in Songs/Audio, cover art in Artwork.`,
        );

        // Seeded with the release's songs (usually none yet), so the seed is an
        // append that re-runs every time.
        const [proj] = await sql`select release_id from artist.projects where id = ${saved.id}`;
        const songs = proj?.release_id
          ? await sql`
              select id, release_id, title, isrc, iswc, duration_seconds, genre, language
                from artist.songs where release_id = ${proj.release_id} order by created_at`
          : [];
        const [rel] = proj?.release_id
          ? await sql`
              select id, title, release_type, release_date, upc, label, distributor,
                     p_year, p_owner, c_year, c_owner
                from artist.releases where id = ${proj.release_id}`
          : [];
        const sheet = await ensureCreditsSheet(
          branch.releaseId,
          rel ?? { id: saved.id, title: row.title, release_type: row.project_type, release_date: row.street_date },
          songs,
        );
        if (sheet)
          console.log(
            draft.lang === "fr"
              ? `\nFeuille de crédits : ${sheet.url}\n  Envoie-la à tes collaborateurs — c'est là qu'ils inscrivent leur IPI et leur IPN.`
              : `\nCredits sheet: ${sheet.url}\n  Send it to your collaborators — that is where they put their IPI and IPN.`,
          );
      }
    } catch (err) {
      console.log(`\n! Drive folder not built: ${(err as Error).message.split("\n")[0]}`);
      console.log("  The project is saved. `houselabel drive setup` retries it.");
    }

    console.log(
      draft.lang === "fr"
        ? "\nProchaine étape : le plan daté, avec qui s'occupe de quoi."
        : "\nNext: the dated plan, with who owns what.",
    );
    console.log("# next: bun run agents/label-manager/skills/manager-plan-release/scripts/plan.ts");
  } finally {
    await sql.end();
  }
  process.exit(0);
}

// `next` — and the tail of `answer`, so one call per turn is enough.
if (!Object.keys(draft.offered).length && !Object.keys(draft.answers).length) {
  const { offered, lang } = await loadOffers();
  draft.offered = offered;
  draft.lang = lang;
  writeDraft(draft);
}

const list = askable(draft.answers);
const nextQ = list.find((q) => draft.answers[q.id] === undefined);
if (!nextQ) summarize(draft);
else askOne(nextQ, draft, list.indexOf(nextQ) + 1, plannedTotal(draft.answers));
