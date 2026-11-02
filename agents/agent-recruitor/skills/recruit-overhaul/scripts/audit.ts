/**
 * Step 2 of the overhaul: prints what a department is, read off disk and the databases.
 * Facts only, no opinions. Lines starting with `#` are for the agent.
 *
 *   bun run agents/agent-recruitor/skills/recruit-overhaul/scripts/audit.ts press
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import postgres from "postgres";
import { join } from "node:path";
import { loadDepartment, ROOT } from "../../../../../engine/agent";
import { readRungs } from "../../../../../engine/modes";

const dept = process.argv[2];
if (!dept) {
  console.error("✗ Which department? e.g. `audit.ts press`");
  process.exit(1);
}

const d = await loadDepartment(dept).catch((e: Error) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});

const pad = (s: string, n: number) => s.padEnd(n);
const row = (k: string, v: string) => console.log(`  ${pad(k, 14)} ${v}`);

console.log(`\n${d.staffMember} · ${d.department} · \`${d.name}\`\n`);

// ── staff-table row ───────────────────────────────────────────────────────
const readme = await Bun.file(join(ROOT, "agents/README.md")).text();
const line = readme.split("\n").find((l) => l.startsWith(`| [\`${d.name}/\`]`));
if (line) {
  const [, desc, input, output] = line.split(" | ");
  console.log("STAFF-TABLE ROW — the three hand-written columns, gate 2\n");
  row("Description", desc?.trim() ?? "—");
  row("Input", input?.trim() ?? "—");
  row("Output", output?.trim() ?? "—");
} else {
  console.log(`STAFF-TABLE ROW    ✗ no row in agents/README.md`);
}

// ── rung: claimed vs earned ───────────────────────────────────────────────
const rung = (await readRungs()).find((r) => r.name === d.name);
console.log(`\nRUNG               claims ${rung?.claimed ?? "?"} · earned ${rung?.earned ?? "?"}`);
console.log(`STATUS_FRONTEND    ${rung?.frontend ?? "?"} — hand-set, no gate`);
for (const b of rung?.blockers ?? []) console.log(`  ✗ ${b}`);

// ── skills ────────────────────────────────────────────────────────────────
console.log(`\nSKILLS             ${d.skills.length}`);
for (const s of rung?.skills ?? []) {
  const flags = [
    s.mode ? `mode:${s.mode}` : "mode:—",
    s.hasQuestions ? "questions ✓" : "questions ✗",
    s.hasScripts ? "scripts ✓" : "scripts ✗",
    s.hasEval ? "eval ✓" : "eval ✗",
  ];
  console.log(`  ${pad(s.name, 34)} ${flags.join("  ")}`);
}

// ── knowledge freshness ───────────────────────────────────────────────────
console.log(`\nKNOWLEDGE          ${d.knowledge.length}`);
for (const k of d.knowledge) {
  const text = await Bun.file(join(ROOT, "agents", d.name, "knowledge", k.file)).text();
      // Only `last_verified:` counts; other dates in the file are content.
  const verified = text.match(/last_verified:\s*(20\d\d-\d\d-\d\d)/)?.[1] ?? null;
  const age = verified ? Math.floor((Date.now() - Date.parse(verified)) / 86_400_000) : null;
  const urls = (text.match(/https?:\/\//g) ?? []).length;
  console.log(
    `  ${pad(k.file, 34)} ${pad(urls ? `${urls} sources` : "NO SOURCES", 12)} ` +
      (age === null ? "NO last_verified" : `verified ${verified} · ${age}d old`),
  );
}

// ── data: declared vs counted ─────────────────────────────────────────────
// The catalog is counted in catalog.sqlite, the file that ships.
console.log(`\nDATA               declared in AGENT.md, counted live`);
if (d.tables.catalog.length) {
  const { Database } = await import("bun:sqlite");
  const { CATALOG_FILE } = await import("../../../../../data/catalog/client");
  const db = new Database(CATALOG_FILE, { readonly: true });
  for (const t of d.tables.catalog) {
    const r = (() => { try { return db.query(`select count(*) n from ${t}`).get() as { n: number }; } catch { return null; } })();
    console.log(`  ${pad(`catalog.${t}`, 34)} ${r ? `${r.n} rows` : "✗ not in catalog.sqlite"}`);
  }
  db.close();
}
for (const [half, tables, envVar] of [
  ["artist", d.tables.artist, "DATABASE_URL"],
] as const) {
  if (!tables.length) continue;
  const url = process.env.DATABASE_URL;
  if (!url) {
    for (const t of tables) console.log(`  ${pad(`${half}.${t}`, 34)} ${envVar} unset — not counted`);
    continue;
  }
  const sql = postgres(url, {
    max: 1,
    onnotice: () => {},
  });
  try {
    for (const t of tables) {
      const [r] = await sql`select count(*)::int as n from ${sql(half)}.${sql(t)}`.catch(() => [null]);
      console.log(`  ${pad(`${half}.${t}`, 34)} ${r ? `${r.n} rows` : "✗ table missing"}`);
    }
  } finally {
    await sql.end();
  }
}

// ── prior art: paths only ─────────────────────────────────────────────────
const PRIOR: Record<string, string[]> = {
  "digital-marketing": ["lib/marketing", "api/campaigns", "components/strategy", "public/knowledge/marketing_strategist"],
  distribution: ["lib/distribution", "(app)/distribution", "api/user-distributors"],
  "label-manager": ["(app)/release", "(app)/manage"],
  platforms: ["lib/platforms", "(app)/platforms", "api/spotify"],
  press: ["lib/press-relations", "api/press-relations", "(app)/press-relations", "(app)/radio"],
  presskit: ["lib/presskit", "lib/epk", "lib/presenton", "api/presskit", "api/draft-bio"],
  rights: ["lib/royalties", "api/royalties", "(app)/registrations", "(app)/earnings", "(app)/track"],
};
const prior = PRIOR[d.name];
console.log(`\nPRIOR ART          the first House Label (private; skip if you have no access)`);
if (!prior) console.log("  none — this department did not exist there");
else for (const path of prior) console.log(`  src/${path}`);

console.log(`\n# read the prior art above before gate 3, and report BOTH directions`);
console.log(`# next: gate 2 — put the three hand-written columns to the artist`);
