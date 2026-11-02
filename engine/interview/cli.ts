/**
 * Terminal adapter for the pure interview core: draft file, printing, operator lines.
 * `next` prints exactly one question; nothing is written until `save`.
 * Output contract: lines starting `# ` are for the agent (the next command),
 * never shown to the artist; every other line is artist-facing, no schema vocabulary.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  askable, emptyState, step, withOffers,
  type Flow, type Lang, type Offer, type Question, type State,
} from "./core";

const L = {
  en: {
    of: (n: number, t: number) => `Question ${n} of ${t}`,
    options: "options",
    suggested: "suggested",
    accept: "say yes to take it, or give me another",
    done: "That's everything I need.",
    save: "Want me to save this?",
    blocked: (t: string[]) => `Still missing before I can go further: ${t.join(", ")}.`,
    saved: (t: string) => `Saved: ${t}.`,
    reset: "Draft cleared. Nothing was saved.",
    unknownOk: '"I don\'t know" is a real answer here — it keeps the question open for later.',
    contains: "What this contains",
    taken: "Taken from what you'd already told us",
  },
  fr: {
    of: (n: number, t: number) => `Question ${n} sur ${t}`,
    options: "choix",
    suggested: "suggéré",
    accept: "dis oui pour le prendre, ou donne-moi autre chose",
    done: "J'ai tout ce qu'il me faut.",
    save: "Je sauvegarde ?",
    blocked: (t: string[]) => `Il manque encore ceci avant d'aller plus loin : ${t.join(", ")}.`,
    saved: (t: string) => `Sauvegardé : ${t}.`,
    reset: "Brouillon effacé. Rien n'a été sauvegardé.",
    unknownOk: "« Je ne sais pas » est une vraie réponse ici — la question reste ouverte pour plus tard.",
    contains: "Ce que ça contient",
    taken: "Pris dans ce que tu nous avais déjà dit",
  },
} as const;

export interface InterviewCli {
  flow: Flow;
  /** Where the draft lives while the interview runs. Gitignored by `.plans/`. */
  draft: string;
  /** The command that reaches this script, for the `#` operator lines. */
  here: string;
  /**
   * Read from the artist's data on the first turn and cached in the draft, so
   * no database round trip per question.
   */
  offers?: () => Promise<{ offered: Record<string, Offer>; lang?: Lang }>;
  /** Persist the finished answers. Returns what the artist is told. */
  save?: (state: State) => Promise<{ id?: string; title: string; next?: string }>;
  argv?: string[];
  /** Injected in tests. Defaults to the real console. */
  out?: (line: string) => void;
}

/** The one place a verb list is written down, so `--help` cannot drift from it. */
const VERBS = "next · answer <id> <value> · why <id> · save · reset";

export async function runInterview(cfg: InterviewCli): Promise<void> {
  const out = cfg.out ?? ((l: string) => console.log(l));
  const [cmd = "next", ...rest] = cfg.argv ?? process.argv.slice(2);

  const read = (): State =>
    existsSync(cfg.draft) ? (JSON.parse(readFileSync(cfg.draft, "utf8")) as State) : emptyState();
  const write = (s: State) => {
    mkdirSync(dirname(cfg.draft), { recursive: true });
    writeFileSync(cfg.draft, JSON.stringify(s, null, 2));
  };

  if (cmd === "reset") {
    if (existsSync(cfg.draft)) rmSync(cfg.draft);
    out(L.en.reset);
    return;
  }

  if (cmd === "why") {
    const q = cfg.flow.questions.find((x) => x.id === rest[0]);
    if (!q) return fail(out, `No question called "${rest[0]}". Known: ${cfg.flow.questions.map((x) => x.id).join(", ")}`);
    out(q.because);
    return;
  }

  let state = read();

  // First contact: everything the artist has already told us, offered back.
  if (cfg.offers && !Object.keys(state.answers).length && !Object.keys(state.offered).length) {
    const { offered, lang } = await cfg.offers();
    state = withOffers(state, offered, lang);
    write(state);
  }

  if (cmd === "answer" || cmd === "set") {
    const [id, ...value] = rest;
    if (!id) return fail(out, `Which question? ${VERBS}`);
    if (!value.length) return fail(out, `No answer given for ${id}.`);
    const r = step(cfg.flow, state, { id, raw: value.join(" ") });
    // A rejected answer leaves the draft untouched and re-asks the same question.
    if (r.error) return fail(out, r.error);
    state = r.state;
    write(state);
  } else if (cmd !== "next") {
    return fail(out, `No such verb "${cmd}". ${VERBS}`);
  }

  if (cmd === "save") return; // unreachable; kept so the verb list stays honest

  const now = step(cfg.flow, state);
  if (now.question) return askOne(out, cfg, now.question, state, now.progress);
  return summarise(out, cfg, state, now.missing, now.branches);
}

/** `save` is its own entry point: nothing writes to a database on `next`. */
export async function saveInterview(cfg: InterviewCli): Promise<void> {
  const out = cfg.out ?? ((l: string) => console.log(l));
  if (!existsSync(cfg.draft)) return fail(out, "Nothing to save — the interview has not started.");
  const state = JSON.parse(readFileSync(cfg.draft, "utf8")) as State;
  const t = L[state.lang];
  const now = step(cfg.flow, state);
  if (now.missing.length) return fail(out, t.blocked(topics(cfg.flow, now.missing, state.lang)));
  if (!cfg.save) return fail(out, "This interview has nothing to save to yet.");

  const saved = await cfg.save(state);
  if (saved.id) writeFileSync(cfg.draft, JSON.stringify({ ...state, savedId: saved.id }, null, 2));
  out(t.saved(saved.title));
  if (saved.next) out(`\n${saved.next}`);
}

const topics = (flow: Flow, ids: string[], lang: Lang) =>
  ids.map((id) => flow.questions.find((q) => q.id === id)?.topic[lang] ?? id);

function askOne(
  out: (l: string) => void,
  cfg: InterviewCli,
  q: Question,
  state: State,
  progress: { n: number; total: number },
) {
  const t = L[state.lang];
  out(`${t.of(progress.n, progress.total)} — ${q.topic[state.lang]}`);
  out("");
  out(q.ask[state.lang]);
  if (q.options?.length) out(`  ${t.options}: ${q.options.join(" · ")}`);
  const offer = state.offered[q.id];
  if (offer) {
    const v = Array.isArray(offer.value) ? offer.value.join(", ") : offer.value;
    out(`  ${t.suggested}: ${v} — ${offer.from} · ${t.accept}`);
  }
  if (!q.required) out(`  ${t.unknownOk}`);
  out(`\n# next: ${cfg.here} answer ${q.id} <value>`);
  out(`# why:  ${cfg.here} why ${q.id}   (only if the artist asks)`);
}

function summarise(
  out: (l: string) => void,
  cfg: InterviewCli,
  state: State,
  missing: string[],
  branches: string[],
) {
  const t = L[state.lang];
  out(t.done);
  out("");
  for (const q of askable(cfg.flow, state.answers)) {
    const v = state.answers[q.id];
    if (v === undefined) continue;
    const line = `  ${q.topic[state.lang].padEnd(24)} ${Array.isArray(v) ? v.join(", ") : v}`;
    // An adopted answer was never asked, so the summary is the only place the
    // artist sees it before saving. Say where it came from.
    const taken = state.offered[q.id];
    out(taken?.adopt ? `${line}  (${taken.from})` : line);
  }
  if (branches.length) out(`\n${t.contains}: ${branches.join(" · ")}`);
  if (missing.length) {
    out(`\n${t.blocked(topics(cfg.flow, missing, state.lang))}`);
    out(`# blocked: answer those before going further`);
    return;
  }
  out(`\n${t.save}`);
  out(`\n# on yes:    ${cfg.here} save`);
  out(`# on change: ${cfg.here} answer <id> <value>`);
}

function fail(out: (l: string) => void, msg: string) {
  // stderr, so a caller piping the artist-facing half never picks this up.
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
}
