/**
 * catalog.crawl_sources staging CLI, the deterministic half of the
 * recruit-dataset skill. Sources go pending_review → active only on a human's word.
 *
 *   bun run catalog:sources list [topic] [--status <s>]
 *   bun run catalog:sources propose <file.json>     stage rows as pending_review
 *   bun run catalog:sources approve <id ...>        pending_review → active
 *   bun run catalog:sources reject  <id ...>        → dead (kept for provenance)
 *   bun run catalog:sources pause   <id ...>        → paused
 *   bun run catalog:sources engine  <fetch|agent> <id ...>   which engine reads it
 *
 * propose's file is a JSON array of rows shaped like catalog.crawl_sources:
 *   { "id", "topic", "url", "kind"?, "scope"?, "extraction"?, "trust"?, "notes"? }
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 * Run:  needs CATALOG_DATABASE_URL — see doc/DEVELOPMENT.md
 */
import postgres from "postgres";

const dbUrl = process.env.CATALOG_DATABASE_URL;
if (!dbUrl) {
  console.error("✗ Set CATALOG_DATABASE_URL (see doc/DEVELOPMENT.md).");
  process.exit(1);
}
const sql = postgres(dbUrl);

const [cmd, ...args] = process.argv.slice(2);
const commands: Record<string, () => Promise<boolean>> = {
  list,
  propose,
  approve,
  reject,
  pause,
  engine,
};
const run = commands[cmd ?? ""];
if (!run) {
  console.error("usage: catalog:sources list|propose|approve|reject|pause|engine …");
  await sql.end();
  process.exit(1);
}
const ok = await run();
await sql.end();
if (!ok) process.exit(1);

async function list() {
  const topic = args.find((a) => !a.startsWith("--")) ?? null;
  const status = args.includes("--status")
    ? (args[args.indexOf("--status") + 1] ?? null)
    : null;
  const rows = await sql`
    select id, topic, kind, status, trust, rows_last_run, url
    from catalog.crawl_sources
    where (${topic}::text is null or topic = ${topic})
      and (${status}::text is null or status = ${status})
    order by status, topic, id`;
  for (const r of rows)
    console.log(
      `${r.status.padEnd(14)} t${r.trust} ${r.topic.padEnd(9)} ${r.kind.padEnd(6)} ` +
        `${String(r.rows_last_run ?? "-").padStart(4)} rows  ${r.id.padEnd(30)} ${r.url}`,
    );
  console.log(`= ${rows.length} source(s)`);
  return true;
}

async function propose() {
  const file = args[0];
  if (!file) {
    console.error("✗ catalog:sources propose <file.json>");
    return false;
  }
  let rows: Array<Record<string, unknown>>;
  try {
    rows = await Bun.file(file).json();
  } catch {
    console.error(`✗ cannot read ${file} — does it exist, and is it valid JSON?`);
    return false;
  }
  if (!Array.isArray(rows)) {
    console.error(`✗ ${file} must be a JSON array of source rows`);
    return false;
  }
  let staged = 0;
  for (const r of rows) {
    for (const key of ["id", "topic", "url"])
      if (!r[key]) {
        console.error(`✗ row missing ${key}: ${JSON.stringify(r)}`);
        return false;
      }
    const row = {
      id: r.id,
      topic: r.topic,
      url: r.url,
      kind: r.kind ?? "index",
      scope: sql.json(r.scope ?? {}),
      extraction: sql.json(r.extraction ?? {}),
      trust: r.trust ?? 2,
      notes: r.notes ?? null,
      status: "pending_review",
      discovered_by: "manual",
    };
    // Never clobber a source that already exists — re-proposing is a no-op.
    const res = await sql`insert into catalog.crawl_sources ${sql(row)}
                          on conflict (topic, url) do nothing`;
    if (res.count > 0) staged++;
    else console.log(`  = ${r.id} already known (topic+url), left as is`);
  }
  console.log(`✓ staged ${staged}/${rows.length} as pending_review`);
  console.log("  next: bun run catalog:sources approve <id …>");
  return true;
}

async function approve() {
  return setStatus("active", "pending_review");
}
async function reject() {
  return setStatus("dead");
}
async function pause() {
  return setStatus("paused");
}

/**
 * Set which engine reads a source (`propose` cannot: it never overwrites).
 * Merged into `extraction`, which also carries tinyfishQuery, followLinks, maxPages, model.
 */

async function engine() {
  const ENGINES = ["fetch", "agent"];
  const [to, ...ids] = args;
  if (!to || !ENGINES.includes(to)) {
    console.error(`✗ catalog:sources engine <${ENGINES.join("|")}> <id ...>`);
    return false;
  }
  if (ids.length === 0) {
    console.error("✗ give at least one source id");
    return false;
  }
  const moved = await sql`
    update catalog.crawl_sources
    set extraction = coalesce(extraction, '{}'::jsonb) || jsonb_build_object('engine', ${to}::text)
    where id = any(${ids})
    returning id, extraction`;
  for (const r of moved) console.log(`✓ ${r.id} → engine=${to}`);
  for (const id of ids.filter((a) => !moved.some((m) => m.id === a)))
    console.log(`✗ ${id} not updated (unknown id)`);
  if (to === "agent")
    console.log("  note: the agent engine bills the TinyFish wallet on every run.");
  return true;
}

async function setStatus(to: string, requiredFrom?: string) {
  if (args.length === 0) {
    console.error("✗ give at least one source id");
    return false;
  }
  const from = requiredFrom ?? null;
  const moved = await sql`
    update catalog.crawl_sources set status = ${to}
    where id = any(${args})
      and (${from}::text is null or status = ${from})
    returning id`;
  for (const r of moved) console.log(`✓ ${r.id} → ${to}`);
  for (const id of args.filter((a) => !moved.some((m) => m.id === a)))
    console.log(
      `✗ ${id} not moved (unknown id${requiredFrom ? `, or not ${requiredFrom}` : ""})`,
    );
  return true;
}
