-- Crawl machinery: operational tables, never read by agents or shipped.
--   crawl_sources (where we look), crawl_runs (when), crawl_observations
--   (what we saw, append-only), crawl_snapshots (what we published),
--   crawl_pages (raw fetched pages). Re-runnable.

create schema if not exists catalog;

create or replace function catalog.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── crawl_sources: where to look ──────────────────────────────────────────
-- Rows, not code, so the crawler can insert discovered sources (pending_review)
-- and the topic list is a query. `kind`: an `index` page discovers entities,
-- a `detail` page verifies one; the missing-row recheck depends on that split.
create table if not exists catalog.crawl_sources (
  id                   text primary key,               -- 'factor-programs'
  topic                text not null,                  -- 'distribution' | 'press' …
  url                  text not null,
  kind                 text not null default 'index'
                         check (kind in ('index','detail','api','feed')),

  -- e.g. {"funder_id":"factor","country":"CA"}. jsonb: scope differs per topic.
  scope                jsonb not null default '{}',
  -- Extraction config (engine, tinyfishQuery, hints), as data so a fix needs no deploy.
  extraction           jsonb not null default '{}',

  status               text not null default 'active'
                         check (status in ('active','pending_review','paused','dead')),
  discovered_by        text not null default 'seed'
                         check (discovered_by in ('seed','crawl','manual')),
  discovered_at        timestamptz not null default now(),

  -- Operational health.
  last_run_at          timestamptz,
  last_ok_at           timestamptz,
  last_error           text,
  consecutive_failures smallint not null default 0,
  rows_last_run        integer,
  trust                smallint not null default 2 check (trust between 1 and 3),

  -- Days between re-reads; the weekly job skips sources not due. Never a second cron.
  cadence_days         smallint not null default 7 check (cadence_days between 1 and 365),

  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (topic, url)
);
create index if not exists crawl_sources_topic_idx  on catalog.crawl_sources(topic, status);
create index if not exists crawl_sources_health_idx on catalog.crawl_sources(consecutive_failures desc)
  where status = 'active';

-- A new column needs an idempotent ALTER here, not just an edit to the CREATE:
-- `create table if not exists` does nothing to an existing table.
alter table catalog.crawl_sources
  add column if not exists cadence_days smallint not null default 7;
do $$ begin
  alter table catalog.crawl_sources
    add constraint crawl_sources_cadence_days_check check (cadence_days between 1 and 365);
exception when duplicate_object then null; end $$;

create index if not exists crawl_sources_due_idx on catalog.crawl_sources(topic, last_ok_at)
  where status = 'active';

-- ── crawl_runs: when we looked ────────────────────────────────────────────
-- One row per execution. `git_sha` answers "did the site change, or did we?".
-- `est_cost_usd` makes a runaway billed crawl visible.
create table if not exists catalog.crawl_runs (
  id             uuid primary key default gen_random_uuid(),
  topic          text not null,
  trigger        text not null default 'schedule'
                   check (trigger in ('schedule','manual','recheck')),
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  ok             boolean,

  sources_ok     integer not null default 0,
  sources_failed integer not null default 0,
  rows_seen      integer not null default 0,
  rows_new       integer not null default 0,
  rows_changed   integer not null default 0,
  rows_missing   integer not null default 0,

  est_cost_usd   numeric(10,4),
  git_sha        text,
  summary        jsonb not null default '{}',
  error          text
);
create index if not exists crawl_runs_topic_idx on catalog.crawl_runs(topic, started_at desc);

-- ── crawl_observations: what we saw, every time ───────────────────────────
-- Append-only, one row per entity per run, including seen = false. Shows
-- flapping (an extractor breaking intermittently) and which sources each
-- entity depends on, which the catalog row's single columns cannot.
create table if not exists catalog.crawl_observations (
  id           bigserial primary key,
  run_id       uuid not null references catalog.crawl_runs(id) on delete cascade,
  topic        text not null,
  entity_slug  text not null,                          -- 'factor:juried-sound-recording'
  source_id    text references catalog.crawl_sources(id) on delete set null,
  seen         boolean not null,
  content_hash text,
  changed      jsonb,                                  -- {"deadlines":["2026-02-01","2026-03-15"]}
  observed_at  timestamptz not null default now()
);
create index if not exists crawl_obs_entity_idx on catalog.crawl_observations(topic, entity_slug, observed_at desc);
create index if not exists crawl_obs_run_idx    on catalog.crawl_observations(run_id);

-- ── crawl_snapshots: what we published ────────────────────────────────────
-- `published` gates a bad crawl from reaching artists: build always, promote
-- deliberately. `completeness` decides whether an agent may say "all".
create table if not exists catalog.crawl_snapshots (
  version      text primary key,                       -- '2026-08-10'
  built_at     timestamptz not null default now(),
  object_key   text not null,                          -- 'catalog/2026-08-10/catalog.duckdb'
  bytes        bigint not null,
  sha256       text not null,
  row_counts   jsonb not null default '{}',            -- {"press_outlets":235,"distribution_services":39}
  completeness jsonb not null default '{}',            -- {"rights_orgs":"complete", …}
  diff_summary jsonb,                                  -- {"added":14,"changed":3,"retired":1}
  tier         text not null default 'public'
                 check (tier in ('public','full')),    -- public omits contact emails
  published    boolean not null default false,
  published_at timestamptz
);
create index if not exists crawl_snapshots_built_idx on catalog.crawl_snapshots(built_at desc);

-- ── crawl_pages: the raw layer ────────────────────────────────────────────
-- What we fetched, before interpretation, so extraction can be re-derived,
-- audited and tested offline. `catalog:fetch` writes it, `catalog:derive`
-- reads it. One row per URL, overwritten on change; etag/last_modified make
-- an unchanged page cost no model call. Never shipped.

create table if not exists catalog.crawl_pages (
  url           text primary key,                  -- normalized: lowercase, no trailing slash, no fragment
  final_url     text,                              -- where it landed after redirects
  source_id     text references catalog.crawl_sources(id) on delete set null,
  topic         text,
  kind          text not null default 'detail'
                  check (kind in ('index','detail')),

  markdown      text,
  links         text[] not null default '{}',
  content_hash  text,                              -- sha256 of markdown; unchanged hash ⇒ skip derivation
  bytes         integer,

  -- Conditional-request validators, so the next fetch can be a no-op.
  etag          text,
  last_modified text,

  status        text not null default 'ok'
                  check (status in ('ok','empty','error','not_modified')),
  error         text,
  fetched_at    timestamptz not null default now(),
  derived_at    timestamptz,                       -- last time a model read this content
  -- Which model read it: model ids are moving aliases, so record it. Pin with CRAWL_EXTRACT_MODEL.
  derived_model text,
  created_at    timestamptz not null default now()
);
create index if not exists crawl_pages_source_idx on catalog.crawl_pages(source_id);
create index if not exists crawl_pages_topic_idx  on catalog.crawl_pages(topic, kind);
-- "what changed since we last derived from it" — the query the cron runs
create index if not exists crawl_pages_stale_idx  on catalog.crawl_pages(derived_at nulls first, fetched_at desc);

-- Idempotent ALTER for a column added after the table shipped.
alter table catalog.crawl_pages add column if not exists derived_model text;

-- ── per-topic source views ────────────────────────────────────────────────
-- One physical table; a named view per department.
drop view if exists catalog.grants_sources;
drop view if exists catalog.booking_sources;
create or replace view catalog.press_sources as
  select * from catalog.crawl_sources where topic = 'press';
create or replace view catalog.rights_sources as
  select * from catalog.crawl_sources where topic = 'rights';
create or replace view catalog.tools_sources as
  select * from catalog.crawl_sources where topic = 'tools';

-- ── rename of the `royalties` topic to `rights` ───────────────────────────
-- Drops the old view and migrates old rows. Idempotent.

drop view if exists catalog.royalties_sources;
update catalog.crawl_sources      set topic = 'rights' where topic = 'royalties';
update catalog.crawl_runs         set topic = 'rights' where topic = 'royalties';
update catalog.crawl_observations set topic = 'rights' where topic = 'royalties';
update catalog.crawl_pages        set topic = 'rights' where topic = 'royalties';

-- ── triggers (drop-then-create so the file is re-runnable) ────────────────
drop trigger if exists crawl_sources_updated_at on catalog.crawl_sources;
create trigger crawl_sources_updated_at
  before update on catalog.crawl_sources
  for each row execute function catalog.update_updated_at();
