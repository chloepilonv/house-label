-- Contacts: one row per person (journalist, music director), per email.
-- The catalog holds outlets; this holds the person behind one, found with the
-- artist's own Hunter key. Kept out of the catalog because Hunter's terms forbid
-- republishing results. `catalog_slug` points back to the outlet, no FK.
-- Private to the artist. Ships empty. Re-runnable.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists artist.contacts (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null,              -- press · radio · venue; checked below
  catalog_slug  text,                        -- → catalog.press_outlets / promotion_radio_stations .slug, no FK
  outlet        text,
  domain        text,
  region        text,                        -- copied from the catalog row it was found for
  name          text,
  position      text,
  email         text not null unique,
  confidence    smallint,                    -- Hunter's 0–100 score
  verification  text,                        -- Hunter's status: valid, accept_all, unknown…
  source        text not null default 'artist'
                  check (source in ('hunter','artist')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists contacts_catalog_slug_idx on artist.contacts(catalog_slug);
create index if not exists contacts_kind_idx         on artist.contacts(kind);

drop trigger if exists contacts_updated_at on artist.contacts;
create trigger contacts_updated_at
  before update on artist.contacts
  for each row execute function artist.update_updated_at();

-- Added after the table shipped, so idempotent ALTERs. Both are legal
-- requirements (agents/press/knowledge/outreach-legal.md):
--   source_url    where the address was published; proof of CASL implied
--                 consent (s. 10(9)(b)).
--   opted_out_at  when they said "stop"; never contact again (CASL s. 11(3),
--                 CAN-SPAM: 10 business days at most).
alter table artist.contacts add column if not exists source_url   text;
alter table artist.contacts add column if not exists opted_out_at timestamptz;

-- Venue bookers share the table so one opt-out list covers all outreach.
alter table artist.contacts drop constraint if exists contacts_kind_check;
alter table artist.contacts
  add constraint contacts_kind_check check (kind in ('press','radio','venue'));
