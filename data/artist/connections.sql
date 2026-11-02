-- Connections: outside accounts linked to the label, one row per provider.
-- Deliberately not in ARTIST_TABLES (data/artist/client.ts): an agent must never
-- read the tokens. engine/google/store.ts opens its own connection; departments
-- get tools that use the token. Tokens are encrypted at rest (engine/google/crypto.ts).
-- Private to the artist. Ships empty. Re-runnable.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists artist.connections (
  provider      text primary key check (provider in ('google', 'buffer', 'hunter')),

  -- Which Google account this is, shown by `houselabel connect --status`. Not a secret.
  account_email text,

  -- The scopes actually granted, space-separated, as Google returned them.
  -- Not the ones requested: the user can untick a box on the consent screen.
  scopes        text not null default '',

  -- AES-256-GCM, base64 (iv + tag + ciphertext). Never logged, never printed,
  -- never returned by a tool.
  access_token  text not null,
  refresh_token text not null,

  -- Expiry of the access token. The refresh token lasts until revoked.
  expires_at    timestamptz not null,

  -- Per-provider preferences that are not credentials (calendar, Drive folder).
  -- jsonb so a new preference needs no migration.
  settings      jsonb not null default '{}',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists connections_updated_at on artist.connections;
create trigger connections_updated_at
  before update on artist.connections
  for each row execute function artist.update_updated_at();

-- Buffer and Hunter were added after the table shipped, so the widening is an
-- idempotent ALTER. They use an API key (stored in access_token) with no refresh
-- token or expiry; Google rows always carry both.
alter table artist.connections drop constraint if exists connections_provider_check;
alter table artist.connections
  add constraint connections_provider_check check (provider in ('google', 'buffer', 'hunter'));
alter table artist.connections alter column refresh_token drop not null;
alter table artist.connections alter column expires_at drop not null;
