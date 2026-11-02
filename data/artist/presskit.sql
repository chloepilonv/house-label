-- Presskit — the artist's press materials (agents/presskit owns this).
--
--   presskit        — one row: the bios, the look, the generated deck.
--   presskit_items  — everything that comes in lists: quotes, clippings,
--                     awards, notable shows, team, videos, photos.
--
-- Not stored here, because they live elsewhere and copies drift:
--   · social links      → artist.platforms
--   · discography       → artist.releases
--   · streaming metrics → artist.platform_latest
--
-- Private to the artist. Ships empty. Re-runnable.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── presskit ──────────────────────────────────────────────────────────────
create table if not exists artist.presskit (
  id               integer primary key default 1 check (id = 1),  -- single row

  short_bio        text,
  long_bio         text,

  -- Printed contacts, separate from artist.profile.email.
  contact_email    text,
  booking_email    text,

  -- Moodboard notes append across turns, never overwrite. visual_identity
  -- holds the extracted palette, a 2-4 word mood and a font style.
  moodboard_notes  text,
  visual_identity  jsonb not null default '{}',

  -- Generated deck
  presentation_url text,
  pdf_url          text,
  generated_at     timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── presskit_items ────────────────────────────────────────────────────────
-- One keyed table, not seven jsonb arrays, so "merge, never replace" is a
-- unique constraint. Dedupe key per kind:
--
--   quote     text-prefix + source        show   venue + date
--   clipping  url, else title             team   name + role
--   award     title + year                video  url
--                                         photo  url
--
-- Insert with `on conflict (kind, dedupe_key) do update`.
create table if not exists artist.presskit_items (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('quote','clipping','award','show',
                                           'team','video','photo')),
  dedupe_key text not null,                                 -- normalized, per the table above
  data       jsonb not null default '{}',                   -- the item's own fields
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (kind, dedupe_key)
);
create index if not exists presskit_items_kind_idx on artist.presskit_items(kind);

-- ── triggers (drop-then-create so the file is re-runnable) ────────────────
drop trigger if exists presskit_updated_at on artist.presskit;
create trigger presskit_updated_at
  before update on artist.presskit
  for each row execute function artist.update_updated_at();

drop trigger if exists presskit_items_updated_at on artist.presskit_items;
create trigger presskit_items_updated_at
  before update on artist.presskit_items
  for each row execute function artist.update_updated_at();

-- ── presskit_versions ─────────────────────────────────────────────────────
-- Every generation is kept. This table owns the deck URLs; they were dropped
-- from `presskit` below, and `presskit.current_version` points here.
create table if not exists artist.presskit_versions (
  id               serial primary key,

  -- 1, 2, 3…, so the artist can say "go back to version 2".
  version          integer not null unique,

  presentation_url text,          -- the Google Slides edit URL
  pdf_url          text,          -- the Drive PDF
  drive_file_id    text,          -- so a re-share or re-publish needs no search

  -- What this deck was built from, frozen; artist.brand changes later.
  visual_identity  jsonb not null default '{}',
  locale           text check (locale in ('en','fr')),
  slide_count      integer,

  -- Why this version exists: 'initial', 'edit', 'refresh', 'republish'.
  reason           text,
  -- What changed, in one line.
  note             text,

  generated_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index if not exists presskit_versions_version_idx
  on artist.presskit_versions(version desc);

-- ── idempotent ALTERs ─────────────────────────────────────────────────────
-- `create table if not exists` does nothing to an existing table, so every
-- change to a shipped table goes here.

-- Which version is the current one. Null until the first generation.
alter table artist.presskit
  add column if not exists current_version integer references artist.presskit_versions(version);

-- Deck URLs now live in presskit_versions. Dropped so a failed run cannot show
-- a stale deck as the new one.
alter table artist.presskit drop column if exists presentation_url;
alter table artist.presskit drop column if exists pdf_url;
alter table artist.presskit drop column if exists generated_at;

-- Where a photo goes on the deck. A column, not a key in `data`, because the
-- generator selects on it.
alter table artist.presskit_items
  add column if not exists slot text
  check (slot is null or slot in ('hero','secondary','gallery'));
create index if not exists presskit_items_slot_idx
  on artist.presskit_items(kind, slot);

-- Anything the agent found itself lands as 'suggested' and stays out of the
-- deck until the artist confirms. Existing rows default to 'confirmed'.
alter table artist.presskit_items
  add column if not exists status text not null default 'confirmed'
  check (status in ('suggested','confirmed','rejected'));

-- Where the item came from.
alter table artist.presskit_items
  add column if not exists source text;

create index if not exists presskit_items_status_idx
  on artist.presskit_items(kind, status);
