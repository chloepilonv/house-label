-- Registrations (agents/rights): one row per collecting society or agency,
-- plus the distributor. The IPI is used at every org, so it is not here.
-- `org_slug` points into catalog.rights_orgs, no FK.
-- Private to the artist. Ships empty. Re-runnable.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── registrations ─────────────────────────────────────────────────────────
create table if not exists artist.registrations (
  id                uuid primary key default gen_random_uuid(),
  org_slug          text not null unique,                   -- → catalog.rights_orgs.id, no FK

  status            text not null default 'not_started'
                      check (status in ('not_started','in_progress','registered')),
  member_id         text,                                   -- the SOCAN / ASCAP / … number
  account_email     text,
  registered_at     date,
  notes             text,

  -- Tax paperwork: W-8BEN for Canadians registering with US orgs.
  tax_form_filed    boolean not null default false,
  tax_form_filed_at date,

  -- Org-specific fields, keyed by catalog.rights_orgs.user_fields.
  org_details       jsonb not null default '{}',

  -- Frozen so the row stays readable if the registry entry goes away.
  saved_org_name    text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists registrations_status_idx on artist.registrations(status);

-- ── triggers (drop-then-create so the file is re-runnable) ────────────────
drop trigger if exists registrations_updated_at on artist.registrations;
create trigger registrations_updated_at
  before update on artist.registrations
  for each row execute function artist.update_updated_at();
