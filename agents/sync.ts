/**
 * Publish agents/ to what coding agents scan: .claude/skills/ symlinks and
 * .claude/agents/ subagents. Both are committed so a fresh clone works.
 *
 *   bun run agents:sync    write the symlinks and subagents
 *   bun run agents:check   verify the contract and that the written output is current; writes nothing (CI)
 *
 * Author: Chloe Bibiane Pilon Vaillancourt.
 */
import { Glob } from "bun";
import { mkdir, readdir, rm, symlink, lstat, readlink } from "node:fs/promises";
import { relative, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const AGENTS = join(ROOT, "agents");
const SKILLS_OUT = join(ROOT, ".claude/skills");
const SUBAGENTS_OUT = join(ROOT, ".claude/agents");

const CHECK = process.argv.includes("--check");
const problems: string[] = [];
const fail = (file: string, msg: string) => problems.push(`${file}\n    ${msg}`);

/**
 * Generated files that would change without --check. Kept apart from `problems`
 * because the fix is `agents:sync`, not a source edit.
 */
const stale: string[] = [];

/** Frontmatter fields the Agent Skills spec allows at the top level. */
const SPEC_KEYS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);

/** Sections every AGENT.md / SKILL.md carries, in order. */
/** The four rungs, and the emoji the staff table shows each one with. */
const BADGE: Record<string, string> = {
  draft: "📝",
  developed: "✅",
  beta: "🧪",
  production: "🚀",
};

const AGENT_SECTIONS = ["Role", "Skills", "Guidelines and rules", "Knowledge", "Tools", "Memory"];
const SKILL_SECTIONS = ["Input", "Process", "Output", "Guidelines"];

type Front = Record<string, string>;

function parse(src: string): { front: Front; keys: string[]; body: string } {
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { front: {}, keys: [], body: src };
  const [, raw, body] = m;
  const front: Front = {};
  const keys: string[] = [];
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const km = lines[i].match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (!km) continue;
    let [, key, val] = km;
    keys.push(key);
    if (val === ">" || val === "|" || val === "") {
      const block: string[] = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) block.push(lines[++i].trim());
      val = block.join(" ");
    }
    front[key] = val.trim();
  }
  return { front, keys, body };
}

/** Capabilities engine/google/tools.ts builds. Duplicated from engine/frontmatter.ts
 *  on purpose (sync.ts imports nothing from engine/); agents/google.test.ts keeps them in step. */
const GOOGLE_CAPABILITIES = ["drive", "calendar", "gmail"];

/** Services engine/<service>/tools.ts builds. Kept in step with engine/frontmatter.ts
 *  by engine/buffer/buffer.test.ts. */
const SERVICES = ["buffer", "hunter"];

/** Drive workspace folders as tokens. Duplicated from engine/frontmatter.ts, kept in
 *  step by the same test. Tree: engine/google/WORKSPACE.md. */
const WORKSPACE_FOLDERS = [
  "artist/presskit",
  "artist/photos",
  "artist/brand",
  "artist/admin",
  "releases",
  "releases/songs",
  "releases/audio",
  "releases/lyrics",
  "releases/artwork",
  "releases/video",
  "releases/digital-contents",
  "budget",
];

const sections = (body: string) =>
  [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());

/** Placeholders a scaffold left behind. Code spans are exempt: recruitor files discuss
 *  `{{placeholder}}` as prose. */
const leftover = (body: string) =>
  body.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").includes("{{");

/** Relative markdown links that do not resolve. */
async function deadLinks(body: string, fileAbs: string) {
  const dead: string[] = [];
  for (const m of body.matchAll(/\]\((\.[^)#\s]*)(?:#[^)\s]*)?\)/g)) {
    const target = join(fileAbs, "..", m[1]);
    const ok = (await Bun.file(target).exists()) || (await lstat(target).then(() => true, () => false));
    if (!ok) dead.push(m[1]);
  }
  return dead;
}

/** Every table the schemas define, so `data:` is resolved rather than trusted. */
const KNOWN_TABLES = new Set<string>();
for await (const f of new Glob("data/**/*.sql").scan(ROOT)) {
  const sql = await Bun.file(join(ROOT, f)).text();
  for (const m of sql.matchAll(/create table if not exists\s+([a-z_]+\.[a-z_]+)/gi))
    KNOWN_TABLES.add(m[1].toLowerCase());
  // Views are valid read targets (e.g. artist.platform_latest).
  for (const m of sql.matchAll(/create (?:or replace )?view\s+([a-z_]+\.[a-z_]+)/gi))
    KNOWN_TABLES.add(m[1].toLowerCase());
}

/** Tables in an AGENT.md `data:` block. Tables not built yet go under `proposed:`,
 *  which is exempt from resolution. */
function declaredTables(data: string | undefined) {
  if (!data) return { real: [], proposed: [] };
  const grab = (key: string) =>
    [...(data.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`))?.[1] ?? "").matchAll(/[a-z_]+\.[a-z_]+/g)]
      .map((m) => m[0]);
  return { real: [...grab("catalog"), ...grab("artist")], proposed: grab("proposed") };
}

// ── read the roster ────────────────────────────────────────────────────────
type Dept = { dir: string; front: Front; body: string; skills: string[]; topics: string[] };
const depts: Dept[] = [];

for (const dir of (await readdir(AGENTS, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()) {
  const agentPath = join(AGENTS, dir, "AGENT.md");
  const file = Bun.file(agentPath);
  if (!(await file.exists())) {
    fail(`agents/${dir}/`, "no AGENT.md — every department folder needs one");
    continue;
  }
  const { front, body } = parse(await file.text());
  const skills: string[] = [];
  const skillsDir = join(AGENTS, dir, "skills");
  for (const s of await readdir(skillsDir, { withFileTypes: true }).catch(() => [])) {
    if (s.isDirectory()) skills.push(s.name);
    else fail(`agents/${dir}/skills/${s.name}`, "a skill is a directory with SKILL.md, not a loose file");
  }
  const topics = (await readdir(join(AGENTS, dir, "knowledge")).catch(() => []))
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
  depts.push({ dir, front, body, skills: skills.sort(), topics: topics.sort() });
}

// ── regenerate the staff table's derived columns ───────────────────────────
// Runs before the checks: sync exits on any violation, so a regenerator placed
// after them could never fix its drift. Status, Skills, Knowledge and Database
// mirror disk, so sync owns them. Under --check the diff is collected as `stale`.
{
  const p = join(AGENTS, "README.md");
  const before = await Bun.file(p).text();
  let md = before;
  for (const { dir, front, skills, topics } of depts) {
    const { real } = declaredTables(front.data);
    const tables = real.length ? real.map((t) => `\`${t}\``).join(" · ") : "—";
    const verbs = skills.length
      ? skills.map((k) => `\`${k.replace(`${front.slug}-`, "")}\``).join(" · ")
      : "—";
    const knows = topics.length ? topics.map((t) => `\`${t}\``).join(" · ") : "—";
    const rung = (v: string | undefined) => `${BADGE[v ?? ""] ?? "❓"} ${v ?? "?"}`;
    const status = rung(front.status);
    const frontend = rung(front.status_frontend);
    // Anchor on the four hand-written columns and rewrite everything after.
    // Matching "the last column" appended a column per run.
    md = md.replace(
      new RegExp(String.raw`^(\| \[\`${dir}/\`\]\(\./${dir}\)(?:[^|\n]*\|){4})[^\n]*$`, "m"),
      (_m, head) => `${head} ${status} | ${frontend} | ${verbs} | ${knows} | ${tables} |`,
    );
  }
  if (CHECK) {
    if (md !== before) stale.push("agents/README.md — the staff table's generated columns");
  } else {
    await Bun.write(p, md);
  }
}


// ── check the contract ─────────────────────────────────────────────────────
const seen = new Map<string, string>();

for (const { dir, front, body, skills } of depts) {
  const at = `agents/${dir}/AGENT.md`;
  const slug = front.slug;

  if (front.name !== dir) fail(at, `name: "${front.name}" must equal the folder name "${dir}"`);
  if (!slug) fail(at, "missing slug: — it prefixes every skill this agent owns");
  if (!front.description) fail(at, "missing description: — it is how Claude decides to delegate here");
  if (!Object.hasOwn(BADGE, front.status ?? ""))
    fail(at, `status: must be draft | developed | beta | production, got "${front.status ?? ""}"`);
  // `status_frontend:` is a second ladder for the GUI, set by the artist and
  // ungated. Only the word is checked, so both ladders share one vocabulary.
  if (!Object.hasOwn(BADGE, front.status_frontend ?? ""))
    fail(
      at,
      `status_frontend: must be draft | developed | beta | production, got "${front.status_frontend ?? ""}"`,
    );
  // `tier:` is read by houselabel's engine; `model:` by Claude Code.
  if (!["fast", "standard", "deep"].includes(front.tier ?? ""))
    fail(
      at,
      `tier: must be fast | standard | deep, got "${front.tier ?? ""}" — it decides which model engine/ runs for this department`,
    );

  // `google:` is required, empty list included: a missing line means undecided.
  // Values are the capabilities engine/google/ builds a tool for.
  if (front.google === undefined)
    fail(
      at,
      "missing google: — every department declares what it may do with the artist's Google account, " +
        "`google: []` included. See agents/README.md → Google.",
    );

  // `discuss:` completes the greeting; without it the greeting falls back to the name.
  if (!front.discuss)
    fail(at, 'missing discuss: — the "or just …" clause of the greeting. See agents/README.md → `mode:` and `greeting:`.');
  else
    for (const cap of (front.google.match(/\[([^\]]*)\]/)?.[1] ?? "").split(",").map((v) => v.trim()).filter(Boolean))
      if (!GOOGLE_CAPABILITIES.includes(cap))
        fail(at, `google: names "${cap}" — it must be one of ${GOOGLE_CAPABILITIES.join(" | ")}`);

  // `services:` (MCP servers): required like `google:`; an unknown one fails the build.
  if (front.services === undefined)
    fail(at, "missing services: — every department declares the outside services it uses, `services: []` included. See agents/README.md.");
  else
    for (const s of (front.services.match(/\[([^\]]*)\]/)?.[1] ?? "").split(",").map((v) => v.trim()).filter(Boolean))
      if (!SERVICES.includes(s)) fail(at, `services: names "${s}" — it must be one of ${SERVICES.join(" | ")}`);

  // `drive:` folders this department touches. Required even without the `drive`
  // capability. The OAuth scope is full `drive` (engine/google/auth.ts), so this
  // list is the only fence; an unknown token fails rather than being dropped.
  if (front.drive === undefined)
    fail(
      at,
      "missing drive: — every department declares which workspace folders it touches, " +
        "`drive: { write: [], read: [] }` included. See engine/google/WORKSPACE.md.",
    );
  else {
    const listed = (key: string) =>
      (new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`).exec(front.drive!)?.[1] ?? "")
        .split(",")
        .map((v) => v.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    if (!/write:/.test(front.drive) || !/read:/.test(front.drive))
      fail(at, "drive: needs both a write: and a read: list — an empty one, `[]`, is a real answer");
    for (const key of ["write", "read"])
      for (const folder of listed(key))
        if (!WORKSPACE_FOLDERS.includes(folder))
          fail(at, `drive.${key} names "${folder}" — it must be one of ${WORKSPACE_FOLDERS.join(" | ")}`);
    // Naming folders without the capability is a declaration nothing enforces.
    if ((listed("write").length || listed("read").length) && !/\bdrive\b/.test(front.google ?? ""))
      fail(
        at,
        "drive: names folders but google: does not include `drive` — " +
          "the department would be handed folders it has no tool to open",
      );
  }

  // artist.connections holds an OAuth refresh token and is absent from
  // ARTIST_TABLES, so declaring it would yield a tool that throws at runtime.
  if (/artist\.connections/.test(front.data ?? ""))
    fail(
      at,
      "data: names artist.connections, which no department may read — it holds an OAuth refresh token. " +
        "Declare `google:` instead and use the tools.",
    );

  const got = sections(body);
  const want = front.status === "draft" ? AGENT_SECTIONS.filter((s) => s !== "Tools") : AGENT_SECTIONS;
  const missing = want.filter((s) => !got.includes(s));
  if (missing.length) fail(at, `missing section(s): ${missing.map((s) => `## ${s}`).join(", ")}`);
  const ordered = got.filter((s) => want.includes(s));
  if (String(ordered) !== String(want.filter((s) => got.includes(s))))
    fail(at, `sections out of order — the contract order is ${want.join(" → ")}`);
  // Knowledge belongs in knowledge/, not as extra sections in AGENT.md.
  const extra = got.filter((s) => !AGENT_SECTIONS.includes(s));
  if (extra.length)
    fail(
      at,
      `extra section(s) ${extra.map((s) => `## ${s}`).join(", ")} — the contract has exactly ${AGENT_SECTIONS.join(" → ")}; ` +
        "a rule goes under Guidelines and rules, a fact goes in knowledge/",
    );
  if (leftover(body)) fail(at, "unsubstituted {{placeholder}} left in a shipped file");
  // No table names, commands or paths in artist-facing text. The rule lives in
  // agents/README.md, so each AGENT.md must carry it too.
  if (!/\*\*Speaks to the artist, never about the machine\.\*\*/.test(body))
    fail(
      at,
      "missing the guideline bullet `**Speaks to the artist, never about the machine.**` — " +
        "see agents/README.md → Every agent is talking to an artist",
    );
  for (const d of await deadLinks(body, join(AGENTS, dir, "AGENT.md")))
    fail(at, `link to ${d} resolves to nothing — the target moved or was deleted`);

  // `data:` must resolve; tables not built yet go under `proposed:`.
  const { real, proposed } = declaredTables(front.data);
  for (const t of real)
    if (!KNOWN_TABLES.has(t))
      fail(at, `data: names ${t}, which no schema in data/ creates — move it under proposed: until it exists`);
  for (const t of proposed)
    if (KNOWN_TABLES.has(t)) fail(at, `data: lists ${t} as proposed:, but data/ already creates it`);

  // A skill may only touch tables its AGENT.md declares (referenced -> declared).
  const declaredTbls = new Set([...real, ...proposed]);
  for (const skill of skills) {
    const sp2 = join(AGENTS, dir, "skills", skill, "SKILL.md");
    const txt = await Bun.file(sp2).text().catch(() => "");
    // `catalog.sqlite` is the shipped file, not a table; a path is not a declaration.
    for (const t of new Set([...txt.matchAll(/\b((?:catalog|artist)\.[a-z_]+)/g)].map((m) => m[1])))
      if (t !== "catalog.sqlite" && !declaredTbls.has(t))
        fail(
          `agents/${dir}/skills/${skill}/SKILL.md`,
          `reads ${t}, which AGENT.md's data: does not declare — add it, or under proposed: if data/ has not built it`,
        );
  }

  // Readers of a catalog table must be told about its lifecycle and provenance columns.
  const allDocs =
    body +
    (await Promise.all(
      (await readdir(join(AGENTS, dir, "knowledge")).catch(() => []))
        .filter((f) => f.endsWith(".md"))
        .map((f) => Bun.file(join(AGENTS, dir, "knowledge", f)).text()),
    ).then((a) => a.join("\n"))) +
    (await Promise.all(
      skills.map((s) => Bun.file(join(AGENTS, dir, "skills", s, "SKILL.md")).text().catch(() => "")),
    ).then((a) => a.join("\n")));
  if (real.some((t) => t.startsWith("catalog.")) && !/\blifecycle\b/.test(allDocs))
    fail(
      at,
      "reads a catalog table but never mentions lifecycle — say what the agent does with active / unconfirmed / retired rows, or it will pitch a retired one",
    );

  // Knowledge files: linked from AGENT.md, dated, sourced inline, and without the
  // padding sections listed below. Doctrine: agents/README.md → knowledge/.
  const BANNED_KNOWLEDGE_SECTIONS: Record<string, string> = {
    "Open questions": "a question is answered in the body or cut; if nobody publishes the answer, one sentence says so where the claim would stand",
    "Sources to answer them from": "there are no questions to answer later — research it now or drop the claim",
    "What the numbers say": "a number's source and date sit beside the number, not in a table that restates the body",
  };
  const kdir = join(AGENTS, dir, "knowledge");
  for (const k of (await readdir(kdir).catch(() => [])).filter((f) => f.endsWith(".md"))) {
    const kp = `agents/${dir}/knowledge/${k}`;
    const stem = k.replace(/\.md$/, "");
    const { front: kfront, body: kbody } = parse(await Bun.file(join(kdir, k)).text());
    if (!body.includes(`knowledge/${k}`)) fail(at, `knowledge/${k} exists but no ## Knowledge entry links it`);
    if (leftover(kbody)) fail(kp, "unsubstituted {{placeholder}} left in a shipped file");
    if (kfront.name !== stem) fail(kp, `name: "${kfront.name}" must equal the file name "${stem}"`);
    // A date is required; `never` and `n/a` are not accepted.
    if (!/last_verified:\s*\d{4}-\d{2}-\d{2}/.test(kfront.metadata ?? ""))
      fail(kp, "metadata: last_verified must be a YYYY-MM-DD date — the day these claims were read off their sources");
    const ksecs = sections(kbody);
    for (const [banned, why] of Object.entries(BANNED_KNOWLEDGE_SECTIONS))
      if (ksecs.some((s) => s.toLowerCase().startsWith(banned.toLowerCase())))
        fail(kp, `has a ## ${banned} section — ${why}`);
    if (/^\s*[-*]\s+\[ \]/m.test(kbody))
      fail(kp, "has unchecked `- [ ]` items — a to-do list is not knowledge; answer it or drop it");
    for (const d of await deadLinks(kbody, join(kdir, k)))
      fail(kp, `link to ${d} resolves to nothing — the target moved or was deleted`);
  }

  for (const skill of skills) {
    const sp = join(AGENTS, dir, "skills", skill, "SKILL.md");
    const sf = Bun.file(sp);
    const rel = `agents/${dir}/skills/${skill}`;
    if (!(await sf.exists())) {
      fail(`${rel}/`, "no SKILL.md — a skill directory without one is invisible to every tool");
      continue;
    }
    const { front: sfront, keys, body: sbody } = parse(await sf.text());

    if (sfront.name !== skill)
      fail(`${rel}/SKILL.md`, `name: "${sfront.name}" must equal the directory name "${skill}"`);
    if (slug && !skill.startsWith(`${slug}-`))
      fail(`${rel}/`, `skill directory must start with this agent's slug "${slug}-"`);
    if (slug && skill.startsWith(`${slug}-`)) {
      const tail = skill.slice(slug.length + 1).split("-");
      if (tail.includes(slug)) fail(`${rel}/`, `"${slug}" repeats on both sides of the name`);
    }
    const dupe = seen.get(skill);
    if (dupe) fail(`${rel}/`, `skill name collides with ${dupe} — names are global once synced`);
    seen.set(skill, rel);

    const illegal = keys.filter((k) => !SPEC_KEYS.has(k));
    if (illegal.length)
      fail(
        `${rel}/SKILL.md`,
        `frontmatter key(s) outside the Agent Skills spec: ${illegal.join(", ")} — ` +
          "nest them under metadata:, or packaging and claude.ai upload fail hard",
      );

    const sgot = sections(sbody);
    const smissing = SKILL_SECTIONS.filter((s) => !sgot.includes(s));
    if (smissing.length)
      fail(`${rel}/SKILL.md`, `missing section(s): ${smissing.map((s) => `## ${s}`).join(", ")}`);
    // Code spans are exempt from the placeholder check.
    if (leftover(sbody)) fail(`${rel}/SKILL.md`, "unsubstituted {{placeholder}} left in a shipped file");
    for (const d of await deadLinks(sbody, sp))
      fail(`${rel}/SKILL.md`, `link to ${d} resolves to nothing — the target moved or was deleted`);

    const declared = (front.skills ?? "").replace(/[[\]]/g, "").split(",").map((s) => s.trim());
    if (front.skills && !declared.includes(skill))
      fail(at, `skills: does not list "${skill}", which exists on disk`);
  }

  for (const d of (front.skills ?? "").replace(/[[\]]/g, "").split(",").map((s) => s.trim()).filter(Boolean))
    if (!skills.includes(d)) fail(at, `skills: lists "${d}", which has no directory under skills/`);

  const evalsPath = join(AGENTS, dir, "evals/evals.json");
  if (front.status !== "draft") {
    if (!(await Bun.file(evalsPath).exists())) {
      fail(`agents/${dir}/`, "no evals/evals.json — a developed agent needs cases that say whether it works");
    } else {
      const ev = (await Bun.file(evalsPath).json().catch(() => null)) as
        | { agent?: string; evals?: { skill?: string; assertions?: string[]; given?: unknown }[] }
        | null;
      if (!ev) fail(`agents/${dir}/evals/evals.json`, "not valid JSON");
      else {
        if (ev.agent !== slug) fail(`agents/${dir}/evals/evals.json`, `agent: "${ev.agent}" must equal slug: "${slug}"`);
        const cases = ev.evals ?? [];
        if (!cases.length) fail(`agents/${dir}/evals/evals.json`, "no cases — an empty suite passes by saying nothing");
        for (const [i, c] of cases.entries())
          if (!c.assertions?.length)
            fail(`agents/${dir}/evals/evals.json`, `case ${i + 1} has no assertions — it cannot pass or fail`);
        // Assertions grade the output; state they depend on belongs in `given`, or
        // they pass vacuously. Artist-state language only: seeded catalog rows always exist.
        const STATE_WORDS =
          /\b(already (captured|saved|registered|entered)|previously (saved|rejected|answered|pitched)|persists?\b|is saved|nothing is saved|does not (overwrite|change any)|reuses an? (existing|already)|existing artist|prior (state|answer|campaign|session))\b/i;
        for (const [i, c] of cases.entries())
          for (const a of c.assertions ?? [])
            if (STATE_WORDS.test(a) && !c.given)
              fail(
                `agents/${dir}/evals/evals.json`,
                `case ${i + 1} asserts prior state ("${a.slice(0, 60)}…") with no "given" — it passes vacuously against an empty database`,
              );

        const covered = new Set(cases.map((c) => c.skill));
        const uncovered = skills.filter((s) => !covered.has(s));
        if (uncovered.length)
          fail(`agents/${dir}/evals/evals.json`, `no case exercises: ${uncovered.join(", ")}`);
      }
    }
  }
}

// staff table mirrors the roster — row present, and its tables match `data:`
const readme = await Bun.file(join(AGENTS, "README.md")).text();
const rows = new Map(
  readme.split("\n").filter((l) => l.startsWith("|")).map((l) => [l.match(/\]\(\.\/([a-z-]+)\)/)?.[1] ?? "", l]),
);
for (const { dir, front } of depts) {
  const row = rows.get(dir);
  if (!row) {
    fail("agents/README.md", `staff table has no row for agents/${dir}/`);
    continue;
  }
  // Compare by cell, not substring: Status and Status_Frontend sit side by side,
  // so either cell could satisfy the other's check.
  const cells = row.split("|").map((c) => c.trim());
  for (const [i, key] of [
    [5, "status"],
    [6, "status_frontend"],
  ] as const) {
    const want = front[key] ?? "";
    if (cells[i] !== `${BADGE[want] ?? "❓"} ${want || "?"}`)
      fail("agents/README.md", `${dir} row disagrees with its ${key}: "${want}"`);
  }
  const { real } = declaredTables(front.data);
  const absent = real.filter((t) => !row.includes(t));
  if (absent.length)
    fail("agents/README.md", `${dir} row omits ${absent.join(", ")} — the "Data it touches" column must mirror data:`);
}
for (const dir of rows.keys())
  if (dir && !depts.some((d) => d.dir === dir))
    fail("agents/README.md", `staff table has a row for agents/${dir}/, which does not exist`);

if (problems.length) {
  console.error(`\n✗ ${problems.length} contract violation(s):\n`);
  for (const p of problems) console.error(`  ${p}\n`);
  console.error("  The contract is agents/README.md. Ask the Recruiting Agent: /recruit-audit\n");
  process.exit(1);
}
console.log(`✓ contract ok — ${depts.length} departments, ${seen.size} skills`);

// ── .claude/skills/ symlinks ───────────────────────────────────────────────
// Remove only our symlinks; recruit-agent runs this and a blanket rm would delete
// hand-written skills. The desired set is computed first so --check can compare.
const wantSkills = new Map<string, string>();
for (const { dir, skills } of depts)
  for (const skill of skills)
    wantSkills.set(skill, relative(SKILLS_OUT, join(AGENTS, dir, "skills", skill)));

if (CHECK) {
  // Only symlinks into agents/ are ours; anything else is hand-written.
  const have = new Map<string, string>();
  for (const e of await readdir(SKILLS_OUT, { withFileTypes: true }).catch(() => [])) {
    const p = join(SKILLS_OUT, e.name);
    if ((await lstat(p)).isSymbolicLink() && (await readlink(p)).includes("/agents/"))
      have.set(e.name, await readlink(p));
  }
  for (const [skill, target] of wantSkills)
    if (!have.has(skill)) stale.push(`.claude/skills/${skill} — missing`);
    else if (have.get(skill) !== target) stale.push(`.claude/skills/${skill} — points somewhere else`);
  for (const skill of have.keys())
    if (!wantSkills.has(skill)) stale.push(`.claude/skills/${skill} — no such skill under agents/`);
} else {
  await mkdir(SKILLS_OUT, { recursive: true });
  for (const e of await readdir(SKILLS_OUT, { withFileTypes: true }).catch(() => [])) {
    const p = join(SKILLS_OUT, e.name);
    if ((await lstat(p)).isSymbolicLink() && (await readlink(p)).includes("/agents/")) await rm(p);
    else if (!e.name.startsWith(".")) console.warn(`  ! .claude/skills/${e.name} is not ours — left alone`);
  }
  for (const [skill, target] of wantSkills) await symlink(target, join(SKILLS_OUT, skill));
}

// ── .claude/agents/ subagents ──────────────────────────────────────────────
// A department that stops for the artist mid-run cannot be a subagent (no channel
// back); `delegable: false` keeps it in the main session. Content is built first
// so --check can compare without writing.
const wantAgents = new Map<string, string>();
for (const { dir, front, body, skills } of depts) {
  if (front.delegable === "false") continue;
  const fm = [
    "---",
    `name: ${front.name}`,
    `description: ${front.description}`,
    `tools: ${front.tools ?? "Read, Grep, Glob"}`,
    `model: ${front.model ?? "inherit"}`,
    ...(skills.length ? [`skills: [${skills.join(", ")}]`] : []),
    "---",
    "",
    `<!-- Generated by \`bun run agents:sync\` from agents/${dir}/AGENT.md. Edit that file. -->`,
    "",
  ].join("\n");
  wantAgents.set(`${front.name}.md`, fm + body.trimStart());
}

if (CHECK) {
  for (const [name, want] of wantAgents) {
    const f = Bun.file(join(SUBAGENTS_OUT, name));
    if (!(await f.exists())) stale.push(`.claude/agents/${name} — missing`);
    else if ((await f.text()) !== want) stale.push(`.claude/agents/${name} — behind agents/*/AGENT.md`);
  }
  // A stale file that looks generated is drift; hand-written files are left alone.
  for (const e of await readdir(SUBAGENTS_OUT, { withFileTypes: true }).catch(() => []))
    if (e.isFile() && e.name.endsWith(".md") && !wantAgents.has(e.name)) {
      const text = await Bun.file(join(SUBAGENTS_OUT, e.name)).text();
      if (text.includes("Generated by `bun run agents:sync`"))
        stale.push(`.claude/agents/${e.name} — generated, but no department produces it any more`);
    }
} else {
  // Remove only files we generate. Hand-written agents (e.g. the copied
  // doc/templates/loop-verifier.agent.md) belong to no department and must survive.
  await mkdir(SUBAGENTS_OUT, { recursive: true });
  for (const e of await readdir(SUBAGENTS_OUT, { withFileTypes: true }).catch(() => []))
    if (e.isFile() && wantAgents.has(e.name)) await rm(join(SUBAGENTS_OUT, e.name), { force: true });
  for (const [name, text] of wantAgents) await Bun.write(join(SUBAGENTS_OUT, name), text);
}

const held = depts.filter((d) => d.front.delegable === "false").map((d) => d.dir);

if (CHECK) {
  if (stale.length) {
    console.error(`\n✗ ${stale.length} generated file(s) behind the source:\n`);
    for (const s of stale) console.error(`  ${s}`);
    console.error(`\n  Run \`bun run agents:sync\` and commit what it writes.\n`);
    process.exit(1);
  }
  console.log(`✓ generated output current — ${wantSkills.size} symlinks, ${wantAgents.size} subagents`);
  process.exit(0);
}

console.log(`✓ .claude/skills/    ${wantSkills.size} symlinks`);
console.log(`✓ .claude/agents/    ${wantAgents.size} subagents`);
if (held.length) console.log(`  ${held.join(", ")} — delegable: false, runs in the main session so its gates can stop`);
console.log("\n  Cursor reads .claude/skills/ too — nothing further to configure.");
