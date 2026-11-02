/**
 * The artist's read/write seam. Every agent reaches artist.* through here.
 * Unlike data/catalog/client.ts it has one backend: the artist's own Postgres.
 * That is the privacy promise; do not add a second backend without changing it.
 *
 * Usage:
 *   import { openArtist } from "./client";
 *   const artist  = await openArtist();
 *   const profile = await artist.one("profile");
 *   const recent  = await artist.query("releases", {}, { orderBy: "release_date desc", limit: 5 });
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import postgres from "postgres";
import { readConfig } from "../../engine/config";

/**
 * Allowlist of every artist.* table and view. `query` interpolates the name
 * into SQL, so this guards against injection; `bun test data/artist` fails
 * when a schema table is missing here.
 *
 * `artist.connections` is omitted on purpose: it holds OAuth refresh tokens,
 * and this list feeds `artist_get`, whose output goes into model context.
 * engine/google/store.ts reads it directly. A test asserts the omission.
 */
export const ARTIST_TABLES = [
  "profile",
  "releases",
  "release_links",
  "songs",
  "song_writers",
  "song_splits",
  "song_share_totals", // view
  "saved_distributors",
  "release_checklist",
  "release_credits",
  "song_samples",
  "platforms",
  "platform_stats",
  "platform_latest", // view
  "registrations",
  "brand",
  "voice",
  "presskit",
  "presskit_items",
  "presskit_versions",
  "website",
  "marketing_campaigns",
  "marketing_tasks",
  "marketing_ideas",
  "press_campaigns",
  "press_pitches",
  "contacts",
  "promotion_targets",
  "projects",
  "project_phases",
  "project_deliverables",
  "project_handoffs",
  "project_milestones",
  "memory",
] as const;


/**
 * Tables the artist owns outright. Departments read them and never write them,
 * because every other department's output derives from them. Only the CLI
 * command in OWNER_COMMAND writes each one. Any hand-maintained table belongs here.
 */
export const ARTIST_OWNED_TABLES = ["profile", "voice"] as const;

const OWNED = new Set<string>(ARTIST_OWNED_TABLES);

/** The one command that writes each owned table — what a refusal points at. */
export const OWNER_COMMAND: Record<(typeof ARTIST_OWNED_TABLES)[number], string> = {
  profile: "houselabel profile",
  voice: "houselabel voice",
};

/** True when no agent may write `table`, only the artist through the CLI. */
export const isArtistOwned = (table: string): boolean => OWNED.has(table);

/** Everything a department is allowed to write. */
export const AGENT_WRITABLE_TABLES = ARTIST_TABLES.filter((t) => !OWNED.has(t));

const KNOWN = new Set<string>(ARTIST_TABLES);

/** Exact matches only. Null means "column is null". */
export interface Filter {
  [column: string]: string | number | boolean | null | undefined;
}

export interface QueryOpts {
  /** `"release_date desc"` — one column, optional direction. Validated. */
  orderBy?: string;
  limit?: number;
}

export interface Artist {
  query<T = Record<string, unknown>>(table: string, filter?: Filter, opts?: QueryOpts): Promise<T[]>;
  /** First row, or null. For the single-row tables (profile, presskit). */
  one<T = Record<string, unknown>>(table: string, filter?: Filter, opts?: QueryOpts): Promise<T | null>;
  /**
   * Insert a row, or update it on conflict. `conflict` names the natural key;
   * an empty array means a plain insert (for uuid-keyed tables).
   */
  upsert(table: string, row: Record<string, unknown>, conflict?: string[]): Promise<Record<string, unknown>>;
  /**
   * Patch only the columns in `patch` on rows matching `filter`. Returns rows changed.
   * Use this, not a partial `upsert`, which inserts a new row when nothing conflicts.
   * Refuses an empty filter.
   */
  update(table: string, filter: Filter, patch: Record<string, unknown>): Promise<number>;
  /** Delete the rows matching `filter`. Refuses an empty filter. */
  remove(table: string, filter: Filter): Promise<number>;
  /** Write one fact to artist.memory. Bumps use_count when it already exists. */
  remember(agent: string, key: string, value: string, opts?: RememberOpts): Promise<void>;
  /** Everything one agent has learned, plus the cross-agent 'shared' rows. */
  recall(agent: string, language?: string): Promise<MemoryRow[]>;
  close(): Promise<void>;
}

export interface RememberOpts {
  kind?: "answer" | "fact" | "history";
  language?: "en" | "fr";
  source?: string;
}

export interface MemoryRow {
  agent: string;
  key: string;
  value: string;
  kind: string;
  language: string;
  source: string | null;
  use_count: number;
  updated_at: Date;
}

const table = (name: string): string => {
  if (!KNOWN.has(name))
    throw new Error(
      `unknown artist table '${name}'.\n` +
        `  Known: ${ARTIST_TABLES.join(", ")}\n` +
        `  A table that exists in data/artist/*.sql but not in ARTIST_TABLES is a bug in client.ts.`,
    );
  return name;
};

/**
 * `orderBy` is interpolated, so it is parsed rather than trusted. One
 * identifier, an optional direction, nothing else — no expressions, no commas.
 */
const ORDER_BY = /^([a-z_][a-z0-9_]*)(?:\s+(asc|desc))?$/i;

function order(clause: string | undefined): { column: string; dir: "asc" | "desc" } | null {
  if (!clause) return null;
  const m = ORDER_BY.exec(clause.trim());
  if (!m) throw new Error(`orderBy must be "column" or "column asc|desc", got: ${clause}`);
  return { column: m[1]!, dir: (m[2]?.toLowerCase() as "asc" | "desc") ?? "asc" };
}

/**
 * Open the artist's database.
 *
 * CATALOG_DATABASE_URL is not a fallback: it has no artist.* schema, so a
 * missing env var would become a silently empty result.
 */
export async function openArtist(opts: { url?: string } = {}): Promise<Artist> {
  // Scripts launched by Claude Code or launchd have no .env.local; they find
  // the database in ~/.houselabel/config.json, written by `houselabel init`.
  const url = opts.url ?? process.env.DATABASE_URL ?? (await readConfig())?.databaseUrl;
  if (!url)
    throw new Error(
      "DATABASE_URL is unset — that is the ARTIST's database (see doc/DEVELOPMENT.md).\n" +
        "  Local: `bun run dev:up` then `bun run artist:migrate`.\n" +
        "  Not CATALOG_DATABASE_URL: the catalog holds no artist.* tables.",
    );

  // Silence notices from re-runnable schemas; they would leak into agent context.
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  const where = (filter: Filter) => {
    let q = sql`where true`;
    for (const [col, val] of Object.entries(filter)) {
      if (val === undefined) continue;
      q = val === null ? sql`${q} and ${sql(col)} is null` : sql`${q} and ${sql(col)} = ${val}`;
    }
    return q;
  };

  const api: Artist = {
    async query(name, filter = {}, opts = {}) {
      const t = table(name);
      const ord = order(opts.orderBy);
      // Nulls last even on desc: Postgres defaults to nulls-first, which would
      // rank an undated draft above every dated release.
      const rows = ord
        ? await sql`
            select * from ${sql("artist")}.${sql(t)} ${where(filter)}
            order by ${sql(ord.column)} ${ord.dir === "desc" ? sql`desc nulls last` : sql`asc nulls last`}
            limit ${Number(opts.limit ?? 500)}`
        : await sql`
            select * from ${sql("artist")}.${sql(t)} ${where(filter)}
            limit ${Number(opts.limit ?? 500)}`;
      return rows as never;
    },

    async one(name, filter = {}, opts = {}) {
      const rows = await api.query(name, filter, { ...opts, limit: 1 });
      return (rows[0] ?? null) as never;
    },

    async upsert(name, row, conflict = []) {
      const t = table(name);
      if (!Object.keys(row).length) throw new Error(`upsert into ${t} with no columns`);

      // An omitted conflict column means NULL, written explicitly so ON CONFLICT
      // matches `nulls not distinct` keys (e.g. saved_venues without show_date).
      // Except `id`: with no id given on a uuid-keyed table, insert a new row.
      const keyless = conflict.length === 1 && conflict[0] === "id" && row.id == null;
      const full = { ...row };
      if (!keyless) for (const c of conflict) if (!(c in full)) full[c] = null;
      const cols = Object.keys(full);
      row = full;

      // No key given, or an `id` the database will generate: a plain insert.
      if (!conflict.length || keyless) {
        const [inserted] = await sql`
          insert into ${sql("artist")}.${sql(t)} ${sql(row, cols)}
          returning *`;
        return (inserted ?? {}) as Record<string, unknown>;
      }

      // Key columns are not re-assigned in DO UPDATE; they already match.
      const updatable = cols.filter((c) => !conflict.includes(c));

      // An existing row gets a plain UPDATE. INSERT … ON CONFLICT checks NOT NULL
      // on the insert half first, so a partial row like {id, upc} would fail.
      if (updatable.length) {
        const key = Object.fromEntries(conflict.map((c) => [c, row[c]]));
        const [existing] = await sql`
          select * from ${sql("artist")}.${sql(t)} ${where(key)} limit 1`;
        if (existing) {
          const [updated] = await sql`
            update ${sql("artist")}.${sql(t)}
               set ${sql(Object.fromEntries(updatable.map((c) => [c, row[c]])), updatable)}
             ${where(key)}
            returning *`;
          return (updated ?? {}) as Record<string, unknown>;
        }
      }
      const [out] = updatable.length
        ? await sql`
            insert into ${sql("artist")}.${sql(t)} ${sql(row, cols)}
            on conflict (${sql(conflict)}) do update set ${sql(
              Object.fromEntries(updatable.map((c) => [c, row[c]])),
              updatable,
            )}
            returning *`
        : await sql`
            insert into ${sql("artist")}.${sql(t)} ${sql(row, cols)}
            on conflict (${sql(conflict)}) do nothing
            returning *`;
      return (out ?? {}) as Record<string, unknown>;
    },

    async update(name, filter, patch) {
      const t = table(name);
      if (!Object.keys(filter).length) throw new Error(`update ${t} with no filter`);
      if (!Object.keys(patch).length) throw new Error(`update ${t} with no columns`);
      const cols = Object.keys(patch);
      const rows = await sql`
        update ${sql("artist")}.${sql(t)} set ${sql(patch, cols)} ${where(filter)} returning 1`;
      return rows.length;
    },

    async remove(name, filter) {
      const t = table(name);
      if (!Object.keys(filter).length) throw new Error(`remove from ${t} with no filter`);
      const rows = await sql`delete from ${sql("artist")}.${sql(t)} ${where(filter)} returning 1`;
      return rows.length;
    },

    async remember(agent, key, value, opts = {}) {
      const language = opts.language ?? "en";
      // Hand-written so re-saving a fact bumps use_count instead of resetting it.
      await sql`
        insert into artist.memory (agent, key, value, kind, language, source)
        values (${agent}, ${key}, ${value}, ${opts.kind ?? "fact"}, ${language}, ${opts.source ?? null})
        on conflict (agent, key, language) do update set
          value           = excluded.value,
          kind            = excluded.kind,
          source          = coalesce(excluded.source, artist.memory.source),
          use_count       = artist.memory.use_count + 1,
          last_revised_at = now()`;
    },

    async recall(agent, language) {
      // 'shared' rows are cross-agent facts, returned for every agent.
      return (await sql`
        select agent, key, value, kind, language, source, use_count, updated_at
        from artist.memory
        where agent in (${agent}, 'shared')
          ${language ? sql`and language = ${language}` : sql``}
        order by use_count desc, updated_at desc`) as never;
    },

    async close() {
      await sql.end();
    },
  };

  return api;
}
