/**
 * Run a department's eval cases in both arms and file the outputs under
 * agents/<dept>/evals/runs/iteration-<N>/. Does not grade; /recruit-evaluate does.
 * Arms: with-agent (repo as committed) and ablated (same repo, department withheld).
 *
 * Run:  bun run evals:run <slug> [--case N] [--arm with|ablated|both]
 *                                [--iteration N] [--dry]
 *
 * Needs EVAL_DATABASE_URL, a scratch database: fixtures are truncated between cases.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import postgres from "postgres";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  lstatSync,
  readdirSync,
  mkdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { $ } from "bun";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const AGENTS = join(ROOT, "agents");

// ── arguments ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const slug = argv.find((a) => !a.startsWith("--"));
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const DRY = argv.includes("--dry");
const ARM = flag("arm") ?? "both";
const ONLY_CASE = flag("case") ? Number(flag("case")) : undefined;

if (!slug) {
  console.error("✗ Usage: bun run evals:run <slug> [--case N] [--arm with|ablated|both] [--dry]");
  process.exit(1);
}
if (!["with", "ablated", "both"].includes(ARM)) {
  console.error(`✗ --arm must be with | ablated | both, got "${ARM}"`);
  process.exit(1);
}

// ── locate the department by slug (agents/agent-recruitor/ is "recruit") ──
const front = (path: string) => {
  const m = readFileSync(path, "utf8").match(/^---\n([\s\S]*?)\n---/);
  const out: Record<string, string> = {};
  for (const line of m?.[1].split("\n") ?? []) {
    const kv = line.match(/^([a-z-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
};

const dept = readdirSync(AGENTS, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(AGENTS, e.name, "AGENT.md")))
  .map((e) => ({ dir: e.name, front: front(join(AGENTS, e.name, "AGENT.md")) }))
  .find((d) => d.front.slug === slug || d.dir === slug);

if (!dept) {
  console.error(`✗ No department with slug "${slug}".`);
  process.exit(1);
}

const evalsPath = join(AGENTS, dept.dir, "evals/evals.json");
if (!existsSync(evalsPath)) {
  console.error(`✗ ${dept.dir} has no evals/evals.json — nothing to run.`);
  process.exit(1);
}
const suite = JSON.parse(readFileSync(evalsPath, "utf8"));
const cases = (suite.evals ?? []).filter((c: any) => ONLY_CASE === undefined || c.id === ONLY_CASE);
if (!cases.length) {
  console.error(ONLY_CASE ? `✗ No case with id ${ONLY_CASE}.` : "✗ evals.json has no cases.");
  process.exit(1);
}

// ── the iteration folder ───────────────────────────────────────────────────
const runsDir = join(AGENTS, dept.dir, "evals/runs");
const nextIteration = () => {
  if (!existsSync(runsDir)) return 1;
  const ns = readdirSync(runsDir)
    .map((d) => Number(d.match(/^iteration-(\d+)$/)?.[1]))
    .filter((n) => Number.isFinite(n));
  return ns.length ? Math.max(...ns) + 1 : 1;
};
const iteration = flag("iteration") ? Number(flag("iteration")) : nextIteration();
const iterDir = join(runsDir, `iteration-${iteration}`);

// ── the scratch database ───────────────────────────────────────────────────
// Hard stop if it equals the artist's database: fixtures are truncated.
const dbUrl = process.env.EVAL_DATABASE_URL;
if (!dbUrl && !DRY) {
  console.error(
    "✗ Set EVAL_DATABASE_URL — a scratch database, never the artist's.\n" +
      "  e.g. postgresql://postgres:postgres@127.0.0.1:5433/music_label_evals\n" +
      "  Create it with: bun run evals:reset",
  );
  process.exit(1);
}
if (dbUrl && process.env.DATABASE_URL && dbUrl === process.env.DATABASE_URL) {
  console.error("✗ EVAL_DATABASE_URL equals DATABASE_URL. Fixtures would truncate the artist's rows.");
  process.exit(1);
}

const sql = dbUrl ? postgres(dbUrl, { max: 1, onnotice: () => {} }) : null;

// ── the scratch catalog file ───────────────────────────────────────────────
// A case with its own `catalog.` rows reads a scratch copy of catalog.sqlite
// through CATALOG_FILE. The shipped file is never written.
const { SHIPPED_CATALOG } = await import("../../../../../data/catalog/client");
const scratchCatalog = join(tmpdir(), `houselabel-eval-catalog-${process.pid}.sqlite`);
let catalogReady = false;
const freshCatalog = async () => {
  await Bun.write(scratchCatalog, Bun.file(SHIPPED_CATALOG));
  catalogReady = true;
};

/**
 * Every BASE TABLE in the artist schema, queried so new schema files are covered.
 * Views (artist.song_share_totals) are excluded: truncating a view errors.
 */
async function artistTables(): Promise<string[]> {
  if (!sql) return [];
  const rows = await sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'artist' and table_type = 'BASE TABLE'
  `;
  return rows.map((r) => r.table_name);
}

/** Wipe every fixture so rows never leak between cases. */
async function truncateAll(tables: string[]) {
  if (!sql || !tables.length) return;
  await sql.unsafe(
    `truncate ${tables.map((t) => `artist.${t}`).join(", ")} restart identity cascade`,
  );
}

/**
 * Resolve "20 days before the run date" to an ISO date for this run.
 * Relative dates keep a fixture meaningful after a literal date would pass.
 */
const RUN_DATE = new Date();
const RELATIVE = /^(\d+)\s+(day|week|month)s?\s+(before|after)\s+the\s+run\s+date$/i;

function resolveDates(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const m = typeof value === "string" ? value.match(RELATIVE) : null;
    if (!m) {
      out[key] = value;
      continue;
    }
    const n = Number(m[1]) * (m[3].toLowerCase() === "before" ? -1 : 1);
    const d = new Date(RUN_DATE);
    if (m[2].toLowerCase() === "day") d.setUTCDate(d.getUTCDate() + n);
    else if (m[2].toLowerCase() === "week") d.setUTCDate(d.getUTCDate() + n * 7);
    else d.setUTCMonth(d.getUTCMonth() + n);
    out[key] = d.toISOString().slice(0, 10);
  }
  return out;
}

/**
 * Insert a case's `given` rows; returns what it loaded. A `catalog.` table the
 * case names is truncated and refilled with its rows; others keep the seed.
 * `catalogDirtied` tells the caller to reseed afterwards.
 */
const catalogDirtied = new Set<string>();

async function loadGiven(given: Record<string, any> | undefined) {
  const loaded: Record<string, number> = {};
  if (!given) return loaded;
  for (const [qualified, value] of Object.entries(given)) {
    const [schema, table] = qualified.includes(".") ? qualified.split(".") : ["artist", qualified];
    const rows = Array.isArray(value) ? value : [value];
    if (schema === "catalog") {
      if (!catalogReady) await freshCatalog();
      const { Database } = await import("bun:sqlite");
      const db = new Database(scratchCatalog, { readwrite: true });
      db.run(`delete from ${table}`);
      for (const row of rows) {
        const r = resolveDates(row) as Record<string, unknown>;
        const cols = Object.keys(r);
        const vals = cols.map((c) => (r[c] !== null && typeof r[c] === "object" ? JSON.stringify(r[c]) : typeof r[c] === "boolean" ? (r[c] ? 1 : 0) : r[c])) as never[];
        db.query(`insert into ${table} (${cols.map((c) => `"${c}"`).join(",")}) values (${cols.map(() => "?").join(",")})`).run(...vals);
      }
      db.close();
      catalogDirtied.add(table);
      loaded[qualified] = rows.length;
      continue;
    }
    const conn = sql;
    if (!conn) throw new Error(`no scratch database — set EVAL_DATABASE_URL to load ${qualified}`);
    for (const row of rows) {
      await conn`insert into ${conn(`${schema}.${table}`)} ${conn(resolveDates(row))}`;
    }
    loaded[qualified] = rows.length;
  }
  return loaded;
}

// ── the ablation ───────────────────────────────────────────────────────────
// Remove one department: skill symlinks, generated subagent and source. Parked
// outside the repo, since an agent that can `ls` finds anything inside it, and
// restored in a finally. `agents:sync` cannot recover a hard kill (the source is
// parked), so the manifest plus the startup sweep do.
const SKILLS_DIR = join(ROOT, ".claude/skills");
const SUBAGENTS_DIR = join(ROOT, ".claude/agents");
const PARKING = join(tmpdir(), "house-label-ablation");
const MANIFEST = join(PARKING, "manifest.json");

/** Where a parked path came from, so restoring never has to guess. */
type Parked = { from: string; as: string };

/**
 * lstat, not existsSync: a parked symlink dangles (its target is parked too),
 * and existsSync would report it missing.
 */
function pathExists(p: string): boolean {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

/** The manifest is the recovery record: it outlives this process, memory does not. */
function writeManifest(parked: Parked[]) {
  const existing: Parked[] = pathExists(MANIFEST)
    ? JSON.parse(readFileSync(MANIFEST, "utf8"))
    : [];
  writeFileSync(MANIFEST, JSON.stringify([...existing, ...parked], null, 2));
}

function park(from: string, as: string, out: Parked[]) {
  if (!pathExists(from)) return;
  renameSync(from, join(PARKING, as));
  out.push({ from, as });
}

/**
 * Restore, and report anything that had to be clobbered on the way back.
 * A destination that reappeared means the ablated arm restored its department
 * itself. The parked copy wins, and the return value flags the arm as contaminated.
 */
function unpark(parked: Parked[]): string[] {
  const clobbered: string[] = [];
  for (const p of parked) {
    const at = join(PARKING, p.as);
    if (!pathExists(at)) continue;
    if (pathExists(p.from)) {
      clobbered.push(p.from);
      rmSync(p.from, { recursive: true, force: true });
    }
    renameSync(at, p.from);
  }
  const left: Parked[] = pathExists(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : [];
  const done = new Set(parked.map((p) => p.as));
  writeFileSync(MANIFEST, JSON.stringify(left.filter((p) => !done.has(p.as)), null, 2));
  return clobbered;
}

/**
 * Drain anything a previous run left parked, before this one starts.
 * A `finally` does not survive SIGKILL, so recovery happens at startup from disk.
 */
function sweepParking() {
  if (!pathExists(MANIFEST)) return;
  const stale: Parked[] = JSON.parse(readFileSync(MANIFEST, "utf8"));
  if (!stale.length) return;
  console.log(`   recovering ${stale.length} path(s) parked by an interrupted run`);
  unpark(stale);
}

/**
 * Withhold the department: its `.claude/` entries and its source. Both arms keep
 * the same tools, so a source folder left in place would just be grepped.
 * `evals/` stays: the runner writes its output there.
 */
function withhold(): Parked[] {
  mkdirSync(PARKING, { recursive: true });
  const parked: Parked[] = [];
  for (const name of readdirSync(SKILLS_DIR)) {
    if (name.startsWith(`${dept!.front.slug}-`)) {
      park(join(SKILLS_DIR, name), `skill--${name}`, parked);
    }
  }
  park(join(SUBAGENTS_DIR, `${dept!.dir}.md`), `agent--${dept!.dir}.md`, parked);
  for (const part of ["AGENT.md", "knowledge", "skills"]) {
    park(join(AGENTS, dept!.dir, part), `src--${dept!.dir}--${part}`, parked);
  }
  writeManifest(parked);
  return parked;
}

/**
 * Remove the cases (the answer key) from disk for both arms. Deleted rather than
 * parked, and restored from memory, so there is no copy to find.
 *
 * If hard-killed in between, the file is git-tracked:
 *   git checkout -- agents/<dept>/evals/evals.json
 */
const casesBytes = readFileSync(evalsPath);

function hideCases(): true {
  rmSync(evalsPath, { force: true });
  return true;
}

function showCases() {
  if (!pathExists(evalsPath)) writeFileSync(evalsPath, casesBytes);
}

// ── running one prompt ─────────────────────────────────────────────────────
// The department's own `tools:` is the allowlist for both arms; fewer tools
// would test tool access, not writing. `Skill` is always appended: production
// grants it, and without it skills (e.g. scripts/questions.ts) are never run.
// The ablated arm loses the skills themselves, since their symlinks dangle.
const allowedTools = [
  ...(dept.front.tools ?? "Read, Grep, Glob").split(",").map((t) => t.trim()).filter(Boolean),
  "Skill",
].join(",");

/**
 * Point DATABASE_URL at the scratch database for the case, so fixtures are read.
 * EVAL_DATABASE_URL is stripped: an agent that sees it knows it is being tested.
 */
function childEnv(): Record<string, string> {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  if (dbUrl) env.DATABASE_URL = dbUrl;
  if (catalogReady) env.CATALOG_FILE = scratchCatalog;
  delete env.EVAL_DATABASE_URL;
  return env;
}

/**
 * Tell the child it is answering an artist, not repairing the repo. Tools stay
 * identical across arms, so this is a request, not a sandbox; unpark() reports
 * when it is ignored.
 */
const CHILD_PROMPT =
  "You are replying to the person who just wrote to you, and to nothing else. " +
  "The state of this repository is deliberate. Do not investigate it, do not " +
  "remark on it, and never restore, check out, or recreate files that look " +
  "missing. Do not mention evaluations, test cases, or your own configuration.";

async function ask(prompt: string): Promise<string> {
  const res = await $`claude -p ${prompt} --allowed-tools ${allowedTools} --append-system-prompt ${CHILD_PROMPT}`
    .cwd(ROOT)
    .env(childEnv())
    .nothrow()
    .quiet();
  const out = res.stdout.toString().trim();
  if (res.exitCode !== 0) {
    return `[runner] claude exited ${res.exitCode}\n\n${res.stderr.toString().trim()}\n\n${out}`;
  }
  return out;
}

// ── run ────────────────────────────────────────────────────────────────────
// Recover an interrupted run first, and restore on Ctrl-C. SIGKILL is covered
// by the startup sweep.
mkdirSync(PARKING, { recursive: true });
sweepParking();
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    showCases();
    const stale: Parked[] = pathExists(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : [];
    if (stale.length) {
      console.log(`\n   ${sig} — restoring ${stale.length} parked path(s)`);
      unpark(stale);
    }
    process.exit(130);
  });
}

console.log(`── ${dept.dir} · iteration ${iteration} · ${cases.length} case(s) · arm: ${ARM}`);
if (DRY) console.log("   --dry: fixtures and stubs only, claude is not called\n");

// Apply the artist schemas if the scratch database is bare. Shells out to
// artist:migrate to keep one copy of the foreign-key file order.
let tables = await artistTables();
if (sql && !tables.length) {
  console.log("   scratch database is bare — applying data/artist/*.sql");
  const res = await $`bun run data/artist/migrate.ts`
    .cwd(ROOT)
    .env({ ...process.env, DATABASE_URL: dbUrl! })
    .nothrow()
    .quiet();
  if (res.exitCode !== 0) {
    console.error(`✗ Could not migrate the scratch database:\n${res.stderr.toString()}`);
    process.exit(1);
  }
  tables = await artistTables();
}

/** Put the shipped catalog back after a case owned a catalog table. */
async function reseedCatalog() {
  if (!catalogDirtied.size) return;
  await freshCatalog();
  catalogDirtied.clear();
}

const summary: any = {
  agent: suite.agent,
  department: dept.dir,
  iteration,
  arm: ARM,
  cases: [],
};

for (const c of cases) {
  const caseDir = join(iterDir, `case-${c.id}`);
  mkdirSync(caseDir, { recursive: true });
  process.stdout.write(`  case ${c.id} (${c.skill ?? "—"}) `);

  let loaded: Record<string, number> = {};
  let blocked: string | null = null;
  try {
    await truncateAll(tables);
    loaded = await loadGiven(c.given);
  } catch (err: any) {
    // A fixture that fails to load ends the case.
    blocked = `given failed to load: ${err.message}`;
  }

  if (blocked) {
    process.stdout.write(`— BLOCKED\n`);
    Bun.write(join(caseDir, "grading.json"), JSON.stringify({ id: c.id, blocked }, null, 2));
    summary.cases.push({ id: c.id, blocked });
    continue;
  }

  // Cases are hidden from both arms. Non-empty `contaminated` means the ablated
  // arm restored its department, so its answer is not a baseline.
  let contaminated: string[] = [];

  hideCases();
  try {
    if (!DRY && (ARM === "with" || ARM === "both")) {
      await Bun.write(join(caseDir, "with-agent.md"), await ask(c.prompt));
      process.stdout.write("with ");
    }

    if (!DRY && (ARM === "ablated" || ARM === "both")) {
      const parked = withhold();
      try {
        await Bun.write(join(caseDir, "ablated.md"), await ask(c.prompt));
      } finally {
        contaminated = unpark(parked);
      }
      process.stdout.write(contaminated.length ? "ablated·CONTAMINATED " : "ablated ");
    }
  } finally {
    showCases();
    await reseedCatalog();
  }

  // Verdicts stay null: this script files evidence, the skill judges it.
  await Bun.write(
    join(caseDir, "grading.json"),
    JSON.stringify(
      {
        id: c.id,
        skill: c.skill ?? null,
        prompt: c.prompt,
        expected_output: c.expected_output ?? null,
        given_loaded: loaded,
        ablated_contaminated: contaminated.length ? contaminated : null,
        assertions: (c.assertions ?? []).map((a: string) => ({
          assertion: a,
          with_agent: null,
          ablated: null,
          evidence: null,
          discriminates: null,
        })),
      },
      null,
      2,
    ),
  );

  summary.cases.push({
    id: c.id,
    skill: c.skill ?? null,
    given_loaded: loaded,
    ablated_contaminated: contaminated.length ? contaminated : null,
  });
  process.stdout.write("✓\n");
}

await Bun.write(join(iterDir, "summary.json"), JSON.stringify(summary, null, 2));

// End the pool, or postgres.js keeps the process alive.
if (sql) await sql.end();
if (catalogReady) await Bun.file(scratchCatalog).delete().catch(() => {});

console.log(`\n✓ ${iterDir.replace(ROOT + "/", "")}`);
console.log("  Grade it with /recruit-evaluate — verdicts are null until judged.");
