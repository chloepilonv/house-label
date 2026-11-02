-- artist.release_credits: the non-rights-bearing liner credits (mix, master,
-- cover, studio, session players). Rights-bearing ones live in artist.song_writers
-- (composition) and artist.song_splits (master). Session players matter: they are
-- paid by their performer society. Owned by label-manager (CREDITS document).
-- Author: Chloe Bibiane Pilon Vaillancourt

create schema if not exists artist;

create table if not exists artist.release_credits (
  id           uuid primary key default gen_random_uuid(),
  release_id   uuid not null references artist.releases(id) on delete cascade,
  -- NULL means a release-level credit (cover artwork, funder line).
  song_id      uuid references artist.songs(id) on delete cascade,
  name         text not null,
  role         text not null check (role in (
                 -- performance
                 'main_artist','featured_artist','performer','background_vocalist',
                 'conductor','orchestra','choir',
                 -- production
                 'producer','co_producer','additional_production','vocal_producer',
                 'recording_engineer','assistant_engineer','mixing_engineer',
                 'mastering_engineer','programmer','editor',
                 -- visual
                 'cover_artwork','photography','art_direction','design','layout',
                 -- business
                 'executive_producer','a_and_r','funder')),
  instrument   text,                      -- performers only: "drums", "lead vocals"
  -- Performers only. FALSE means a session player, paid by their performer
  -- society, not the master split. NULL means unknown, not FALSE.
  featured     boolean,
  studio       text,
  city         text,
  ipn          text,                      -- performer id, the IPI's performer-side twin
  isni         text,
  sort_order   integer not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists release_credits_release_idx on artist.release_credits(release_id);
create index if not exists release_credits_song_idx    on artist.release_credits(song_id);

-- artist.song_samples: samples and interpolations. A null `cleared_on` is a
-- delivery blocker (an uncleared sample means a takedown).
create table if not exists artist.song_samples (
  id            uuid primary key default gen_random_uuid(),
  song_id       uuid not null references artist.songs(id) on delete cascade,
  source_work   text not null,            -- "Nightcall — Kavinsky"
  rights_holder text,
  kind          text not null default 'sample' check (kind in ('sample','interpolation')),
  cleared_on    date,                     -- null = NOT cleared, which blocks delivery
  terms         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists song_samples_song_idx on artist.song_samples(song_id);

-- Columns on artist.releases: idempotent ALTERs, since the table already exists.
alter table artist.releases add column if not exists credits_url text;   -- the Drive link
-- ℗ is the sound recording, © the composition: two owners, stores want both.
alter table artist.releases add column if not exists p_year  integer;
alter table artist.releases add column if not exists p_owner text;
alter table artist.releases add column if not exists c_year  integer;
alter table artist.releases add column if not exists c_owner text;

drop trigger if exists release_credits_updated_at on artist.release_credits;
create trigger release_credits_updated_at
  before update on artist.release_credits
  for each row execute function artist.update_updated_at();

drop trigger if exists song_samples_updated_at on artist.song_samples;
create trigger song_samples_updated_at
  before update on artist.song_samples
  for each row execute function artist.update_updated_at();
