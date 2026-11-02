-- Saved distributors (agents/distribution): the one chosen and the ones ruled out.
-- `service_slug` points into catalog.distribution_services, no FK. `saved_*`
-- columns are frozen terms, so the row reads without the catalog and price changes show.
-- `ruled_out_reason` is a column because every comparison reads it.
-- Private to the artist. Ships empty. Re-runnable.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── saved_distributors ────────────────────────────────────────────────────
create table if not exists artist.saved_distributors (
  id                uuid primary key default gen_random_uuid(),
  service_slug      text not null unique,                 -- → catalog.distribution_services.slug, no FK

  status            text not null default 'shortlisted'
                      check (status in ('shortlisted','chosen','signed_up','left','ruled_out')),
  -- At most one row; enforced by the partial unique index below.
  is_current        boolean not null default false,

  -- What the artist agreed to, not always the published tier.
  plan_name         text,
  annual_cost       numeric(10,2),
  currency          text,                                 -- 'CAD' | 'USD' — never defaulted, see the catalog schema
  cut_streaming_pct numeric(5,2),
  since             date,
  left_at           date,
  account_email     text,

  -- Both read on every comparison.
  match_reasons     text[] not null default '{}',
  ruled_out_reason  text,
  notes             text,

  -- Frozen from catalog.distribution_services when the artist decided
  saved_name        text,
  saved_fee_model   text,
  saved_price_tiers jsonb,
  saved_cut_streaming_pct numeric(5,2),
  saved_lapse_behavior    text,
  saved_signup_url  text,
  saved_at          timestamptz not null default now(),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists saved_distributors_status_idx on artist.saved_distributors(status);
-- At most one current distributor.
create unique index if not exists saved_distributors_one_current
  on artist.saved_distributors((is_current)) where is_current;

-- ── triggers (drop-then-create so the file is re-runnable) ────────────────
drop trigger if exists saved_distributors_updated_at on artist.saved_distributors;
create trigger saved_distributors_updated_at
  before update on artist.saved_distributors
  for each row execute function artist.update_updated_at();
