-- Platforms: the artist's public footprint (owned by agents/platforms).
--   platforms        identity on each platform, one mutable row each. No numbers.
--   platform_stats   numbers, one append-only row per platform per day.
--   platform_latest  view: each platform with its newest stats row.
-- Stats are append-only because platforms do not give back past numbers, and
-- trends need history. Private to the artist. Ships empty. Re-runnable.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── platforms ─────────────────────────────────────────────────────────────
create table if not exists artist.platforms (
  id                 uuid primary key default gen_random_uuid(),
  platform           text not null unique
                       check (platform in ('spotify','apple_music','youtube','instagram',
                                           'tiktok','soundcloud','bandcamp','facebook',
                                           'x','deezer','linktree','website')),
  handle             text,                                  -- '@leonie'
  url                text not null,                         -- the public profile page
  platform_artist_id text,                                  -- Spotify artist id, YouTube channel…
  display_name       text,
  is_primary         boolean not null default false,        -- the artist's strongest platform
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── platform_stats ────────────────────────────────────────────────────────
-- Append-only, so no updated_at. A same-day refresh overwrites that day's row.
-- Typed columns so deltas are plain SQL. Null means "not reported", never zero.
create table if not exists artist.platform_stats (
  id                uuid primary key default gen_random_uuid(),
  platform          text not null,
  date              date not null default current_date,

  followers         integer,                                -- instagram, tiktok, x, facebook
  subscribers       integer,                                -- youtube
  monthly_listeners integer,                                -- spotify
  total_views       integer,                                -- youtube
  total_plays       integer,                                -- soundcloud, bandcamp
  total_streams     integer,

  extra             jsonb not null default '{}',            -- top_tracks, top_videos, per-platform
  source            text not null default 'scrape'
                      check (source in ('api','scrape','manual')),
  fetched_at        timestamptz not null default now(),
  created_at        timestamptz not null default now(),

  unique (platform, date)                                   -- natural key for the daily upsert
);
create index if not exists platform_stats_platform_date_idx
  on artist.platform_stats(platform, date desc);

-- ── platform_latest ───────────────────────────────────────────────────────
-- Left join: a platform never fetched still shows, with null numbers.
create or replace view artist.platform_latest as
  select p.platform,
         p.handle,
         p.url,
         p.display_name,
         p.is_primary,
         s.date as stats_date,
         s.followers,
         s.subscribers,
         s.monthly_listeners,
         s.total_views,
         s.total_plays,
         s.total_streams,
         s.extra,
         s.source,
         s.fetched_at
  from artist.platforms p
  left join lateral (
    select * from artist.platform_stats s
    where s.platform = p.platform
    order by s.date desc
    limit 1
  ) s on true;

-- ── triggers (drop-then-create so the file is re-runnable) ────────────────
drop trigger if exists platforms_updated_at on artist.platforms;
create trigger platforms_updated_at
  before update on artist.platforms
  for each row execute function artist.update_updated_at();
