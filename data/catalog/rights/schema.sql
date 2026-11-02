-- rights_orgs: the complete, hand-maintained registry of collecting societies
-- (SOCAN, CMRRA, ASCAP, The MLC…) agents/rights builds its checklist from.
-- Complete, so agents may say "all". Seeded rows are protected: never retired.
-- Re-runnable.

create schema if not exists catalog;

create or replace function catalog.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── rename from royalties_orgs ────────────────────────────────────────────
-- Idempotent. Postgres renames neither indexes nor constraints with a table.
do $$ begin
  if to_regclass('catalog.royalties_orgs') is not null
     and to_regclass('catalog.rights_orgs') is null then
    alter table catalog.royalties_orgs rename to rights_orgs;
    alter table catalog.rights_orgs rename constraint royalties_orgs_pkey to rights_orgs_pkey;
    alter index catalog.royalties_orgs_country_idx  rename to rights_orgs_country_idx;
    alter index catalog.royalties_orgs_type_idx     rename to rights_orgs_type_idx;
    alter index catalog.royalties_orgs_priority_idx rename to rights_orgs_priority_idx;
  end if;
end $$;
-- The trigger keeps its old name through a rename and would fire twice.

drop trigger if exists royalties_orgs_updated_at on catalog.rights_orgs;

-- ── rights_orgs ──────────────────────────────────────────────────────────
create table if not exists catalog.rights_orgs (
  id                        text primary key,               -- stable slug, e.g. 'socan'
  acronym                   text not null,
  full_name                 text not null,
  type                      text not null
                              check (type in ('pro','mechanical','neighbouring_performer',
                                              'neighbouring_label','digital_performance',
                                              'private_copying','distributor')),
  type_label                text not null,                  -- human-readable royalty type
  royalty_types             text[] not null default '{}',
  for_whom                  text[] not null default '{}',   -- songwriter|performer|label|publisher
  country                   text not null check (country in ('CA','US')),
  quebec_only               boolean not null default false, -- Quebec-specific org
  english_canada_only       boolean not null default false, -- English Canada (vs Quebec equivalent)
  signup_url                text,                           -- nullable (distributor has none)
  website                   text not null,
  cost                      text not null,
  registration_requirements text[] not null default '{}',
  notes                     text not null default '',
  tax_form_url              text,                           -- e.g. W-8BEN for non-US artists
  tax_form_label            text,
  priority                  smallint not null,              -- checklist order (lower = do first)
  side                      text not null
                              check (side in ('composition','master')),
  royalty_category          text not null
                              check (royalty_category in ('performance','mechanical','sync',
                                                          'streaming_sales','neighbouring_rights',
                                                          'digital_performance')),
  user_fields               jsonb not null default '[]',    -- OrgUserField[]: key, bilingual label, placeholder, required

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

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists rights_orgs_country_idx  on catalog.rights_orgs(country);
create index if not exists rights_orgs_type_idx     on catalog.rights_orgs(type);
create index if not exists rights_orgs_priority_idx on catalog.rights_orgs(priority);

-- ── triggers (drop-then-create so the file is re-runnable) ────────────────
drop trigger if exists rights_orgs_updated_at on catalog.rights_orgs;
create trigger rights_orgs_updated_at
  before update on catalog.rights_orgs
  for each row execute function catalog.update_updated_at();
