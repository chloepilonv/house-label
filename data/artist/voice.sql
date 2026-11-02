-- Voice: how the artist writes, one row. A markdown guide plus verbatim samples
-- of sent emails (models copy examples better than adjectives). Every department
-- reads it via the brief (data/artist/brief/rules.ts, voiceSection).
-- Artist-owned: only `houselabel voice` writes it (ARTIST_OWNED_TABLES in client.ts).
-- Private to the artist. Ships empty. Re-runnable.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists artist.voice (
  id          integer primary key default 1 check (id = 1),  -- single row

  -- Markdown, ten to twenty lines.
  guide       text not null,

  -- Verbatim excerpts: [{ "lang": "fr", "context": "to a booker", "text": "..." }]
  samples     jsonb not null default '[]'::jsonb check (jsonb_typeof(samples) = 'array'),

  -- Where the guide came from, e.g. "38 sent emails, 2025-01 to 2026-09".
  source      text,
  sampled_at  date,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists voice_updated_at on artist.voice;
create trigger voice_updated_at
  before update on artist.voice
  for each row execute function artist.update_updated_at();
