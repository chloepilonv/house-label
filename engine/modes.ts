/**
 * The rung each department has earned, computed from disk, so the hand-set
 * `status:` in AGENT.md can be checked. Uses the roster's own rung names.
 * Production requires both modes, because the engine reaches a department
 * through its greeting.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { INTERNAL, listDepartments, ROOT } from "./agent";
import { parseDoc } from "./frontmatter";

export type Rung = "draft" | "developed" | "beta" | "production";

/** Low to high. Index order is the comparison. */
export const RUNGS: Rung[] = ["draft", "developed", "beta", "production"];

export const atLeast = (a: Rung, b: Rung): boolean => RUNGS.indexOf(a) >= RUNGS.indexOf(b);

/**
 * Departments served through the interview core rather than the prompt-embedded
 * flows in questions.ts. Only grows. A name here changes which mechanism runs,
 * and modes.test.ts refuses it until the department qualifies.
 */
export const SERVED: string[] = [
  // Being here does not mean signed off: AGENT.md stays `beta` until the
  // artist has run it herself.
  "digital-marketing",
  "distribution",
  "rights",
  "presskit",
  "promotion",
];

/**
 * The one mode a skill can declare: a `task` the interview core runs when
 * asked. Questions are answered by the department itself.
 */
export type Mode = "task";

export interface SkillMode {
  name: string;
  /** null when the SKILL.md has not declared one. */
  mode: Mode | null;
  /** A task skill without one cannot be run by the interview core. */
  hasQuestions: boolean;
  /** Any `scripts/` at all. The beta gate. */
  hasScripts: boolean;
  /** At least one eval case names this skill. The developed gate. */
  hasEval: boolean;
  /** `greeting:` — the clause the artist hears. A task without one cannot be offered. */
  hasGreeting: boolean;
}

export interface DeptRung {
  name: string;
  /** What its AGENT.md says. */
  claimed: Rung | null;
  /**
   * What AGENT.md says about the GUI. Claimed only: `status_frontend:` is the
   * artist's call, so there is no `earned` counterpart.
   */
  frontend: Rung | null;
  /** What the folder actually supports. */
  earned: Rung;
  skills: SkillMode[];
  tasks: string[];
  /** What stands between `earned` and the next rung, in words a pass can act on. */
  blockers: string[];
}

const AGENTS = join(ROOT, "agents");

/** `metadata:` arrives from the parser as one joined string; this reads into it. */
const metaValue = (metadata: string | undefined, key: string): string | null =>
  metadata?.match(new RegExp(`\\b${key}:\\s*([a-z-]+)`))?.[1] ?? null;

async function readDept(name: string): Promise<DeptRung> {
  const dir = join(AGENTS, name);
  const agentMd = await Bun.file(join(dir, "AGENT.md")).text().catch(() => "");
  const front = parseDoc(agentMd).front;
  const asRung = (v: string | undefined): Rung | null => (RUNGS.includes(v as Rung) ? (v as Rung) : null);
  const claimed = asRung(front.status);
  const frontend = asRung(front.status_frontend);

  const evalsRaw = await Bun.file(join(dir, "evals", "evals.json")).text().catch(() => "");
  const evaluated = new Set<string>(
    (JSON.parse(evalsRaw || "{}").evals ?? []).map((e: { skill: string }) => e.skill),
  );

  const entries = await readdir(join(dir, "skills"), { withFileTypes: true }).catch(() => []);
  const skills: SkillMode[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const text = await Bun.file(join(dir, "skills", e.name, "SKILL.md")).text().catch(() => "");
    if (!text) continue;
    const raw = metaValue(parseDoc(text).front.metadata, "mode");
    const scripts = await readdir(join(dir, "skills", e.name, "scripts")).catch(() => []);
    skills.push({
      name: e.name,
      mode: raw === "task" ? raw : null,
      hasGreeting: !!metaValue(parseDoc(text).front.metadata, "greeting"),
      hasQuestions: scripts.includes("questions.ts"),
      hasScripts: scripts.length > 0,
      hasEval: evaluated.has(e.name),
    });
  }

  const tasks = skills.filter((s) => s.mode === "task");
  const blockers: string[] = [];

  // ── gates, low to high; each names what would clear it ──
  let earned: Rung = "draft";
  if (!agentMd) blockers.push("no AGENT.md");

  const unevaluated = skills.filter((s) => !s.hasEval).map((s) => s.name);
  if (agentMd && !unevaluated.length) earned = "developed";
  else if (unevaluated.length) blockers.push(`no eval case for ${unevaluated.join(", ")}`);

  const scripted = skills.filter((s) => s.hasScripts);
  if (earned === "developed" && scripted.length) earned = "beta";
  else if (earned === "developed") blockers.push("no skill has a scripts/ — nothing deterministic to run");

  if (earned === "beta") {
    const undeclared = skills.filter((s) => s.mode === null).map((s) => s.name);
    const unquestioned = tasks.filter((s) => !s.hasQuestions).map((s) => s.name);
    if (undeclared.length) blockers.push(`${undeclared.join(", ")} declare no \`mode:\``);
    if (unquestioned.length) blockers.push(`${unquestioned.join(", ")} are tasks with no scripts/questions.ts`);
    const unspoken = tasks.filter((s) => !s.hasGreeting).map((s) => s.name);
    if (unspoken.length) blockers.push(`${unspoken.join(", ")} carry no \`greeting:\` — the artist cannot be offered what has no sentence`);
    if (!blockers.length && !SERVED.includes(name)) blockers.push("wired, but not yet listed in SERVED");
    if (!blockers.length) earned = "production";
  }

  return { name, claimed, frontend, earned, skills, tasks: tasks.map((s) => s.name), blockers };
}

/** Every department that serves an artist. Meta departments are out of scope. */
export async function listArtistFacing(): Promise<string[]> {
  return (await listDepartments()).filter((n) => !INTERNAL.has(n));
}

export async function readRungs(): Promise<DeptRung[]> {
  return Promise.all((await listArtistFacing()).map(readDept));
}

/** A department claiming more than it earned. The defect the README names. */
export const overclaiming = (all: DeptRung[]): DeptRung[] =>
  all.filter((d) => d.claimed && !atLeast(d.earned, d.claimed));
