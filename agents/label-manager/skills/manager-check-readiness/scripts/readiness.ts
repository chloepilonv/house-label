/**
 * What is still missing before the project can ship, as a gate rather than a list.
 *
 *   bun run agents/label-manager/skills/manager-check-readiness/scripts/readiness.ts
 *   bun run .../readiness.ts --json
 *
 * Code, not prose, so counting, omitting present items, naming the producing
 * department, and `?` vs `✗` are applied the same way every run. The required
 * set comes from the project's own branches. Untracked is not missing: items
 * with nowhere in the schema to be recorded print `?`.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import postgres from "postgres";
import { OWNER_LABEL, type Lang } from "../../manager-plan-release/scripts/milestones";

const JSON_OUT = process.argv.includes("--json");
/** Persist the checklist. Off by default: a read must stay a read. */
const SAVE = process.argv.includes("--save");
/** The artist answering a `?` once, so untracked items stop being asked. */
const CONFIRM = process.argv.find((a) => a.startsWith("--confirm="))?.split("=").slice(1).join("=");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "✗ DATABASE_URL is not set — that, and only that, means no artist data.\n" +
      "  A missing .env file does not: .env.local is gitignored and a hosted\n" +
      "  deployment has none. Do not report the catalog as empty.",
  );
  process.exit(1);
}

type Line = {
  gate: string;
  item: string;
  state: "missing" | "partial" | "untracked";
  detail: string;
  department: string | null;
};

const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  const [project] = await sql`
    select id, title, project_type, street_date, physical, recording_status,
           markets, lead_single_id, release_id, scope
      from artist.projects order by created_at desc limit 1
  `;
  if (!project) {
    console.error(
      "✗ No project in artist.projects.\n" +
        "  The required set is derived from a scoped project's branches, so there\n" +
        "  is nothing to check against. Run manager-scope-project first — a generic\n" +
        "  checklist here would be invented, which rule #2 forbids.",
    );
    process.exit(1);
  }

  // Gates are matched by `milestone_key`, not by title: titles are in the
  // artist's language. The key also carries the gate's day.
  const gates = await sql`
    select milestone_key, title, offset_days, phase_id
      from artist.project_milestones where project_id = ${project.id}
  `;
  const [songs] = await sql`
    select count(*)::int as total,
           count(isrc)::int as with_isrc
      from artist.songs
  `;
  const [splits] = await sql`
    select count(distinct song_id)::int as songs_with_splits from artist.song_splits
  `;
  const [writers] = await sql`
    select count(distinct song_id)::int as songs_with_writers from artist.song_writers
  `;
  const [release] = await sql`
    select upc, distributor from artist.releases order by release_date desc nulls last limit 1
  `;
  const [presskit] = await sql`select short_bio, long_bio from artist.presskit limit 1`;
  const [photos] = await sql`
    select count(*)::int as n from artist.presskit_items where kind = 'photo'
  `;
  const [regs] = await sql`
    select count(*)::int as n from artist.registrations where status = 'registered'
  `;

  const lang: Lang = (project.scope?.locale as Lang) ?? "en";
  /** Departments are named the way the artist hears them, never by slug. */
  const label = (d: string | null) => OWNER_LABEL[d ?? "you"]?.[lang] ?? d ?? "you";

  const street = project.street_date ? new Date(project.street_date) : null;
  const dayOf = (offset: number | null | undefined) =>
    street && offset != null
      ? new Date(street.getTime() + offset * 86400000).toISOString().slice(0, 10)
      : null;
  /** A gate is one milestone: its own title, and the day it falls on. */
  const gateFor = (key: string, fallback: string) => {
    const m = gates.find((g: any) => g.milestone_key === key);
    return { title: m?.title ?? fallback, due: dayOf(m?.offset_days) };
  };
  /** The phase a gate belongs to, so a persisted deliverable hangs off it. */
  const phaseOf = (title: string) =>
    gates.find((g: any) => g.title === title)?.phase_id ?? null;
  const deliverGate = gateFor("delivered", "Deliver to the distributor");
  const storyGate = gateFor("presskit_ready", "Build the story");
  const deliver = deliverGate.title;
  const story = storyGate.title;
  const dueOf = (title: string) =>
    title === deliver ? deliverGate.due : title === story ? storyGate.due : null;

  const lines: Line[] = [];
  const add = (l: Line) => lines.push(l);

  // ── the delivery gate ───────────────────────────────────────────────────
  if (songs.total === 0) {
    add({ gate: deliver, item: "songs", state: "missing",
          detail: "nothing catalogued yet", department: "rights" });
  } else if (songs.with_isrc < songs.total) {
    add({ gate: deliver, item: "ISRC", state: "partial",
          detail: `${songs.with_isrc} of ${songs.total} assigned`, department: "rights" });
  }
  if (!release?.upc) {
    add({ gate: deliver, item: "UPC", state: "missing",
          detail: release ? "not assigned" : "the release itself isn't catalogued", department: "rights" });
  }
  if (songs.total && splits.songs_with_splits < songs.total) {
    add({ gate: deliver, item: "master splits", state: "partial",
          detail: `${splits.songs_with_splits} of ${songs.total} songs`, department: "rights" });
  }
  if (songs.total && writers.songs_with_writers < songs.total) {
    add({ gate: deliver, item: "writer splits", state: "partial",
          detail: `${writers.songs_with_writers} of ${songs.total} songs`, department: "rights" });
  }
  if (!regs.n) {
    add({ gate: deliver, item: "collection society", state: "missing",
          detail: "no org registered", department: "rights" });
  }
  // The lead single may be named in scope before it exists as a song row.
  const namedSingle = project.lead_single_id ?? (project.scope?.lead_single ?? null);
  if ((!namedSingle || namedSingle === "unknown") && project.project_type !== "single") {
    add({ gate: deliver, item: "lead single", state: "missing",
          detail: "undecided — one pitch, none once live",
          department: null });
  }
  if (!release?.distributor) {
    add({ gate: deliver, item: "distributor", state: "missing",
          detail: "not chosen", department: "distribution" });
  }

  // ── the story gate ──────────────────────────────────────────────────────
  if (!presskit?.long_bio) {
    add({ gate: story, item: "long bio", state: "missing", detail: "missing",
          department: "presskit" });
  }
  if (!photos.n) {
    add({ gate: story, item: "press photo", state: "missing", detail: "none",
          department: "presskit" });
  }

  // ── nowhere to record these ─────────────────────────────────────────────
  const UNTRACKED: [string, string][] = [
    ["master files", "nothing in your data records that the masters landed"],
    ["cover art", "nothing in your data records it"],
  ];
  if (project.physical !== "none") {
    UNTRACKED.push(["test pressing", "nothing records the approval; the plant names the day"]);
  }
  for (const [item, detail] of UNTRACKED) {
    add({ gate: deliver, item, state: "untracked", detail, department: null });
  }

  // ── the artist answering a "?" ──────────────────────────────────────────
  if (CONFIRM) {
    const [row] = await sql`
      insert into artist.project_deliverables
        (project_id, item, state, detail, confirmed_by_artist, confirmed_at)
      values (${project.id}, ${CONFIRM}, 'confirmed', 'confirmed by you', true, current_date)
      on conflict (project_id, item) do update set
        state = 'confirmed', detail = 'confirmed by you',
        confirmed_by_artist = true, confirmed_at = current_date
      returning item
    `;
    console.log(`✓ ${row.item} — noted. You will not be asked about it again.`);
    await sql.end();
    process.exit(0);
  }

  // ── persist ─────────────────────────────────────────────────────────────
  // Upsert on (project_id, item), writing only derived columns, so an
  // artist's confirmation is never overwritten by re-deriving.
  let saved = 0;
  if (SAVE) {
    for (const l of lines) {
      await sql`
        insert into artist.project_deliverables
          (project_id, phase_id, item, department, state, detail)
        values (${project.id}, ${phaseOf(l.gate)}, ${l.item}, ${l.department},
                ${l.state}, ${l.detail})
        on conflict (project_id, item) do update set
          phase_id = excluded.phase_id,
          department = excluded.department,
          -- A confirmation is the artist's answer about something the schema
          -- cannot see, so re-deriving must not walk over it. Without this the
          -- next run flips 'confirmed' back to 'untracked' and asks about the
          -- cover art again, forever — the exact nagging this table ends.
          state = case when artist.project_deliverables.confirmed_by_artist
                       then artist.project_deliverables.state
                       else excluded.state end,
          detail = case when artist.project_deliverables.confirmed_by_artist
                        then artist.project_deliverables.detail
                        else excluded.detail end
      `;
      saved++;
    }
    // Clear items that were open and no longer are; the loop only writes open ones.
    const open = lines.map((l) => l.item);
    await sql`
      update artist.project_deliverables
         set state = 'present', detail = 'resolved'
       where project_id = ${project.id}
         and state in ('missing','partial')
         and not (item = any(${open}))
    `;
    // The phase remembers what blocked it; the checklist itself does not.
    for (const phaseId of [...new Set(lines.map((l) => phaseOf(l.gate)).filter(Boolean))]) {
      const blockers = lines
        .filter((l) => phaseOf(l.gate) === phaseId && l.state !== "untracked")
        .map((l) => l.item);
      if (!blockers.length) continue;
      await sql`
        update artist.project_phases
           set status = 'blocked', blockers = ${blockers}
         where id = ${phaseId}
      `;
    }
  }

  // Items the artist already confirmed drop out of the report.
  const confirmed = new Set(
    (await sql`
      select item from artist.project_deliverables
       where project_id = ${project.id} and confirmed_by_artist
    `).map((r: any) => r.item),
  );
  const report = lines.filter((l) => !confirmed.has(l.item));

  if (JSON_OUT) {
    console.log(JSON.stringify({ project: project.title, lines: report, confirmed: [...confirmed], saved }, null, 2));
  } else {
    const weeks = project.street_date
      ? Math.round((new Date(project.street_date).getTime() - Date.now()) / (7 * 86400000))
      : null;
    console.log(`READINESS · ${project.project_type}` +
                (weeks != null ? ` · ${weeks} weeks out` : " · no street date"));
    const blocking = report.filter((l) => l.state !== "untracked");
    // Earliest gate first — it has the least time left.
    const order = [...new Set(blocking.map((l) => l.gate))]
      .sort((a, b) => (dueOf(a) ?? "9999").localeCompare(dueOf(b) ?? "9999"));
    for (const gate of order) {
      const due = dueOf(gate);
      // A date, never `W-2`. The artist reads this; the offset is storage.
      console.log(`\nBLOCKED  ${gate}` + (due ? `  — due ${due}` : ""));
      for (const l of blocking.filter((x) => x.gate === gate)) {
        console.log(`  ✗ ${l.item.padEnd(20)} ${l.detail.padEnd(34)} ${label(l.department)}`);
      }
    }
    console.log();
    for (const l of report.filter((x) => x.state === "untracked")) {
      console.log(`  ? ${l.item.padEnd(20)} ${l.detail}`);
    }
    const firstOpen = report.find((l) => l.state === "untracked");
    if (firstOpen) {
      // The way out of the "?" loop, naming an item that is actually still open.
      console.log(`# to answer one: bun run .../readiness.ts --confirm="${firstOpen.item}"`);
    }
    console.log("\n? = nothing in your data records it, not that it is absent.");
    console.log("Tell me once and it stops being asked. Present items are omitted on purpose.");
    if (saved) console.log(`Checklist kept · ${saved} items.`);
  }
} finally {
  await sql.end();
}
