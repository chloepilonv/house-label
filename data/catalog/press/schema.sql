-- Press outlets, read by agents/press. One row per media, never a person:
-- a public catalog of journalists' addresses cannot be un-published, so people
-- live in the artist's own artist.contacts (found with their Hunter key).
-- artist.press_pitches points here by slug. Re-runnable.

create schema if not exists catalog;

create or replace function catalog.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── press_outlets ─────────────────────────────────────────────────────────
create table if not exists catalog.press_outlets (
  id                uuid primary key default gen_random_uuid(),
  outlet            text not null unique,                   -- the media's name, as it writes it
  -- Stable identity from the name (accents folded); artist rows point at this, not the uuid.
  slug              text generated always as (
                      btrim(regexp_replace(
                        translate(replace(replace(lower(outlet), 'œ', 'oe'), 'æ', 'ae'),
                          'àâäáãåçèéêëìíîïñòóôöõùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'),
                        '[^a-z0-9]+', '-', 'g'), '-')
                    ) stored,
  outlet_type       text not null
                      check (outlet_type in ('newspaper','magazine','blog','webzine','tv')),
  -- A national title has no city.
  market            text not null check (market in ('quebec','canada','us')),
  country           text not null check (country in ('CA','US')),
  city              text,
  language          text not null default 'en' check (language in ('fr','en','bilingual')),
  website           text,
  submission_url    text,                                  -- the page that says how to send music
  -- A role address printed on the site (info@, tips@), never a person's. Often null.
  desk_email        text,
  submission_method text,                                  -- in the outlet's own words
  genre_fit         text[] not null default '{}',          -- '{all}', '{indie_rock,pop}'
  tier              smallint not null default 2 check (tier between 1 and 3),  -- 1 national reach … 3 niche
  notes             text,

  -- ── provenance & lifecycle (identical on every shared catalog table) ────
  source        text not null default 'seed'
                  check (source in ('seed','crawl_fetch','crawl_tinyfish','crawl_puppeteer','manual')),
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

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists press_outlets_slug_idx      on catalog.press_outlets(slug);
create index if not exists press_outlets_market_idx           on catalog.press_outlets(market, outlet_type);
create index if not exists press_outlets_language_idx         on catalog.press_outlets(language);
create index if not exists press_outlets_genre_idx            on catalog.press_outlets using gin(genre_fit);
create index if not exists press_outlets_lifecycle_idx        on catalog.press_outlets(lifecycle);

drop trigger if exists press_outlets_updated_at on catalog.press_outlets;
create trigger press_outlets_updated_at
  before update on catalog.press_outlets
  for each row execute function catalog.update_updated_at();

-- ── retired tables ────────────────────────────────────────────────────────
-- Replaced by press_outlets and the promotion_* tables.

drop table if exists catalog.press_contacts cascade;
drop table if exists catalog.press_playlists cascade;
