-- tools: a hand-picked directory of third-party artist tools (Canva, Songtrust…).
-- Read by several departments, so no <service>_ prefix. Not crawled. Re-runnable.

create schema if not exists catalog;

create or replace function catalog.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── tools ─────────────────────────────────────────────────────────────────
create table if not exists catalog.tools (
  id             text primary key,                     -- stable slug, e.g. 'canva'
  name           text not null,
  description    text not null,
  description_fr text not null,                         -- French copy
  url            text not null,
  -- No 'distribution': distributors live in catalog.distribution_services.
  category       text not null check (category in (
                   'design','social','analytics','marketing',
                   'collaboration','rights','website','promotion')),
  -- Presentational; belong in the frontend keyed by `id`. Kept so readers don't break.
  icon           text not null,                         -- 2-letter monogram, e.g. 'CV'
  color          text not null,                         -- Tailwind class, e.g. 'bg-violet-600'

  -- ── provenance & lifecycle (identical on every shared catalog table) ────
  source        text not null default 'seed'
                  check (source in ('seed','crawl_tinyfish','crawl_puppeteer','manual')),
  source_url    text,
  protected     boolean not null default false,
  content_hash  text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  last_verified timestamptz,
  missing_since timestamptz,
  missing_runs  smallint not null default 0,
  lifecycle     text not null default 'active'
                  check (lifecycle in ('active','unconfirmed','retired')),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists tools_category_idx  on catalog.tools(category);
create index if not exists tools_lifecycle_idx on catalog.tools(lifecycle);

-- Removes 'distribution' from older databases. Delete rows first, or the new
-- CHECK cannot validate.

delete from catalog.tools where category = 'distribution';
do $$ begin
  alter table catalog.tools drop constraint tools_category_check;
exception when undefined_object then null; end $$;
alter table catalog.tools add constraint tools_category_check
  check (category in ('design','social','analytics','marketing',
                      'collaboration','rights','website','promotion'));

-- ── triggers (drop-then-create so the file is re-runnable) ────────────────
drop trigger if exists tools_updated_at on catalog.tools;
create trigger tools_updated_at
  before update on catalog.tools
  for each row execute function catalog.update_updated_at();
