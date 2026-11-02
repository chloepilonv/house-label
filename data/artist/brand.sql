-- Brand: the artist's visual identity (colours, type, logo).
-- Its own table, not part of artist.presskit, because every department reads it.
-- Every column is nullable; null means "derive it" (moodboard palette, then default).
-- Private to the artist. Ships empty. Re-runnable.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists artist.brand (
  id             integer primary key default 1 check (id = 1),  -- single row

  -- ── Colour ──────────────────────────────────────────────────────────────
  -- Hex with the leading #, or null to derive. These replace the moodboard
  -- palette rather than merge with it.
  primary_color    text check (primary_color    ~ '^#[0-9a-fA-F]{6}$'),
  background_color text check (background_color ~ '^#[0-9a-fA-F]{6}$'),
  text_color       text check (text_color       ~ '^#[0-9a-fA-F]{6}$'),
  accent_color     text check (accent_color     ~ '^#[0-9a-fA-F]{6}$'),

  -- ── Type ────────────────────────────────────────────────────────────────
  -- Family names as written on the slide (`fontFace`), e.g. "Playfair Display".
  font_display   text,
  font_body      text,

  -- A font file the artist owns; pptxgenjs-plus can embed it. Google Slides
  -- substitutes fonts on import, so `font_source` records whether it is a
  -- `google` font, which needs no file.
  font_file_url  text,
  font_source    text check (font_source in ('derived','google','uploaded')),
  -- Embedding a licensed font is the artist's call. Null means unanswered;
  -- the generator will not embed on null.
  font_embed_ok  boolean,

  -- ── Mark ────────────────────────────────────────────────────────────────
  logo_url       text,
  -- Whether the logo can sit on a dark cover. Recorded, not guessed from
  -- pixels, which fails on logos with their own backdrop.
  logo_on_dark   boolean,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists brand_updated_at on artist.brand;
create trigger brand_updated_at
  before update on artist.brand
  for each row execute function artist.update_updated_at();
