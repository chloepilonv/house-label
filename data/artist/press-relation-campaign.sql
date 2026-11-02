-- Press campaigns (agents/press).
--   press_campaigns  one PR push: the pitch, the release, the markets.
--   press_pitches    one row per contact per campaign. `contact_slug` points
--                    into catalog.press_outlets, no FK; null means the artist
--                    added the contact by hand.
-- Private to the artist. Ships empty. Re-runnable.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── press_campaigns ───────────────────────────────────────────────────────
create table if not exists artist.press_campaigns (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  release_id     uuid references artist.releases(id) on delete set null,

  -- A date, not a timestamptz: a timezone would shift the playbook's stage boundaries.
  release_date   date,
  listen_url     text,                                      -- private stream / smart link
  pitch          text not null default '',                  -- the master pitch, persisted
  target_markets text[] not null default '{}',              -- quebec, canada, united_states
  status         text not null default 'active'
                   check (status in ('active','archived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists press_campaigns_status_idx on artist.press_campaigns(status);

-- ── press_pitches ─────────────────────────────────────────────────────────
-- `follow_up_count` caps at two in the schema.
-- Nothing sets status `opened` (no open tracking); never report it as an open rate.
-- The unique constraint keeps nulls distinct: many hand-added contacts per
-- campaign, but a catalog contact only once.
create table if not exists artist.press_pitches (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references artist.press_campaigns(id) on delete cascade,
  contact_slug     text,                                    -- → catalog.press_outlets.slug, no FK

  pitch_type       text check (pitch_type in ('radio','press_review','interview',
                                              'exclusive_premiere','playlist','feature')),
  status           text not null default 'not_pitched'
                     check (status in ('not_pitched','pitched','opened','responded',
                                       'coverage','declined')),
  subject          text,
  body             text,
  sent_at          timestamptz,
  responded_at     timestamptz,
  coverage_url     text,
  follow_up_count  smallint not null default 0 check (follow_up_count between 0 and 2),
  last_follow_up_at timestamptz,
  notes            text,

  -- Frozen from catalog.press_outlets at pitch time, or typed in when contact_slug is null.
  saved_name       text,
  saved_outlet     text,
  saved_email      text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (campaign_id, contact_slug)
);
create index if not exists press_pitches_campaign_id_idx on artist.press_pitches(campaign_id);
create index if not exists press_pitches_status_idx      on artist.press_pitches(status);
create index if not exists press_pitches_contact_idx     on artist.press_pitches(contact_slug);

-- ── triggers (drop-then-create so the file is re-runnable) ────────────────
drop trigger if exists press_campaigns_updated_at on artist.press_campaigns;
create trigger press_campaigns_updated_at
  before update on artist.press_campaigns
  for each row execute function artist.update_updated_at();

drop trigger if exists press_pitches_updated_at on artist.press_pitches;
create trigger press_pitches_updated_at
  before update on artist.press_pitches
  for each row execute function artist.update_updated_at();
