-- Songs catalog — the artist's own music (agents/rights owns this).
--
--   releases      — singles, EPs, albums. UPCs, label, distributor, dates.
--   songs         — the works themselves. ISRC, ISWC, duration, language.
--   song_writers  — the COMPOSITION side: who wrote it, their IPI and share.
--   song_splits   — the MASTER side: who owns the recording and their share.
--
-- Filled by hand or by import, merged without overwriting
-- (agents/rights/skills/rights-import-catalog/SKILL.md).
--
-- Private to the artist. Ships empty. Re-runnable.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── releases ──────────────────────────────────────────────────────────────
create table if not exists artist.releases (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  artist_name  text,                                        -- billing name, may differ from profile
  release_type text not null default 'album'
                 check (release_type in ('single','ep','album','compilation')),
  upc          text,
  label        text,
  distributor  text,
  release_date date,
  cover_art_url text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- Adds `mixtape`. A new check value needs its own idempotent statement;
-- re-running the CREATE does nothing to an existing table.
do $$ begin
  alter table artist.releases drop constraint if exists releases_release_type_check;
  alter table artist.releases add constraint releases_release_type_check
    check (release_type in ('single','ep','album','mixtape','compilation'));
end $$;

create index if not exists releases_release_date_idx on artist.releases(release_date desc);

-- Smart link (Feature.fm, Linkfire, lnk.to): one URL for every store. A column,
-- not a platforms row, because it is per release.
alter table artist.releases add column if not exists smart_link_url text;

-- ── songs ─────────────────────────────────────────────────────────────────
-- songs.release_id is the only link; no `song_ids` array on releases.
create table if not exists artist.songs (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  artists          text[] not null default '{}',
  isrc             text,                                    -- recording id, CCXXXYYNNNNN
  iswc             text,                                    -- composition id, T-123456789-0
  duration_seconds integer,
  genre            text,
  language         text,
  recording_date   date,
  release_id       uuid references artist.releases(id) on delete set null,
  registered_with  text[] not null default '{}',            -- catalog.rights_orgs slugs
  source_label     text,                                    -- which import file this came from
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists songs_isrc_idx       on artist.songs(isrc) where isrc is not null;
create index if not exists songs_release_id_idx on artist.songs(release_id);
create index if not exists songs_title_idx      on artist.songs(lower(title));

-- ── song_writers (composition side) ───────────────────────────────────────
-- A child table, not a jsonb array, so shares can be summed and writers queried.
create table if not exists artist.song_writers (
  id            uuid primary key default gen_random_uuid(),
  song_id       uuid not null references artist.songs(id) on delete cascade,
  name          text not null,
  role          text check (role in ('composer','lyricist','composer_lyricist','arranger')),
  ipi           text,
  share_percent numeric(5,2) check (share_percent between 0 and 100),
  publisher     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists song_writers_song_id_idx on artist.song_writers(song_id);
create index if not exists song_writers_name_idx    on artist.song_writers(lower(name));

-- ── song_splits (master side) ─────────────────────────────────────────────
create table if not exists artist.song_splits (
  id            uuid primary key default gen_random_uuid(),
  song_id       uuid not null references artist.songs(id) on delete cascade,
  name          text not null,
  role          text check (role in ('artist','featured_artist','producer',
                                     'label','engineer','other')),
  share_percent numeric(5,2) check (share_percent between 0 and 100),
  payout_email  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists song_splits_song_id_idx on artist.song_splits(song_id);

-- Shares not totalling 100 are a warning, not a constraint: imports are often
-- incomplete. The hygiene check reads this view.
create or replace view artist.song_share_totals as
  select s.id as song_id,
         s.title,
         coalesce((select sum(w.share_percent) from artist.song_writers w
                    where w.song_id = s.id), 0) as writer_total,
         coalesce((select sum(m.share_percent) from artist.song_splits m
                    where m.song_id = s.id), 0) as master_total
  from artist.songs s;

-- ── triggers (drop-then-create so the file is re-runnable) ────────────────
drop trigger if exists releases_updated_at on artist.releases;
create trigger releases_updated_at
  before update on artist.releases
  for each row execute function artist.update_updated_at();

drop trigger if exists songs_updated_at on artist.songs;
create trigger songs_updated_at
  before update on artist.songs
  for each row execute function artist.update_updated_at();

drop trigger if exists song_writers_updated_at on artist.song_writers;
create trigger song_writers_updated_at
  before update on artist.song_writers
  for each row execute function artist.update_updated_at();

drop trigger if exists song_splits_updated_at on artist.song_splits;
create trigger song_splits_updated_at
  before update on artist.song_splits
  for each row execute function artist.update_updated_at();

-- ── lyrics and release links (the Drive template) ─────────────────────────
-- Lyrics, rendered to a Google Doc per song by the label manager's template.
-- Idempotent ALTER, since the table already exists.
alter table artist.songs add column if not exists lyrics text;

-- Per-release links that are not a platform profile (track pages, visualizer,
-- private stream). Feeds the "Useful links" sheet. One row per URL per release.
create table if not exists artist.release_links (
  id          uuid primary key default gen_random_uuid(),
  release_id  uuid not null references artist.releases(id) on delete cascade,
  category    text not null default 'other'
                check (category in ('listen','video','press','other')),
  label       text not null,                               -- "nuit blanche — Spotify (track)"
  url         text not null,
  created_at  timestamptz not null default now(),
  unique (release_id, url)
);
