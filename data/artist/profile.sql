-- Profile: who the artist is, one row. Only `houselabel profile` writes it;
-- departments read it. Enforced in engine/tools.ts (artist_set) and
-- data/artist/brief/cli.ts (artist:set), since every other answer derives from it.
-- Private to the artist. Ships empty. Re-runnable.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── profile ───────────────────────────────────────────────────────────────
create table if not exists artist.profile (
  id                  integer primary key default 1 check (id = 1),  -- single row

  -- Identity
  artist_name         text,
  legal_name          text,
  artist_type         text check (artist_type in ('solo','duo','band','collective')),
  -- jsonb, not a table: members are only read and written as a list.
  members             jsonb not null default '[]',           -- [{"name":"Ali","role":"drums"}]
  email               text,

  -- Where they are. Drives PRO choice, radio quotas, distributor pricing.
  city                text,
  region              text,                                 -- province or state
  country             text check (country in ('CA','US')),
  citizenship         text[] not null default '{}',         -- 'CA','US' — funders gate on this
  timezone            text,                                 -- IANA, e.g. 'America/Toronto'

  -- Where they sell, which differs from where they live. 'QC' sits inside
  -- 'CA' on purpose: these are markets, not countries.
  target_markets      text[] not null default '{}',         -- 'QC','CA','US'

  -- What they make
  genres              text[] not null default '{}',
  disciplines         text[] not null default '{}',         -- composer, performer, songwriter,
                                                            -- producer, bandleader, sound_artist
  career_stage        text check (career_stage in ('emerging','mid-career','established')),
  project_description text,

  -- `preferred_locale` is the language to write in; `languages` is what the
  -- artist works in (it splits FACTOR from Musicaction).
  languages           text[] not null default '{}',         -- 'en','fr'
  preferred_locale    text not null default 'en' check (preferred_locale in ('en','fr')),

  -- Positioning, used by press pitches and campaign briefs
  comparable_artists  text[] not null default '{}',         -- RIYL
  brand_keywords      text[] not null default '{}',
  target_audience     text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── columns added after the first release ─────────────────────────────────
-- A new column needs an idempotent ALTER: `create table if not exists` does
-- nothing to an existing table.
alter table artist.profile add column if not exists members        jsonb  not null default '[]';
alter table artist.profile add column if not exists target_markets text[] not null default '{}';

-- Dropped: rights identifiers are issued during registration, which the rights
-- department handles and it cannot write here. They belong in the rights schema.
alter table artist.profile drop column if exists ipi_number;
alter table artist.profile drop column if exists isni;

-- ── triggers (drop-then-create so the file is re-runnable) ────────────────
drop trigger if exists profile_updated_at on artist.profile;
create trigger profile_updated_at
  before update on artist.profile
  for each row execute function artist.update_updated_at();
