-- Memory: what each agent has learned (reusable answers, facts, history),
-- keyed by agent and language. Holds what an agent learned; artist.profile
-- holds what the artist filled in.
-- Private to the artist. Ships empty. Re-runnable.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── memory ────────────────────────────────────────────────────────────────
-- `language` is part of the key: the English and French texts are separate
-- answers, not revisions of each other.
create table if not exists artist.memory (
  id              uuid primary key default gen_random_uuid(),
  agent           text not null,                            -- 'distribution', 'publicist',
                                                            -- 'shared' for cross-agent facts
  key             text not null,                            -- 'artist_statement', 'pro_membership'
  value           text not null,
  kind            text not null default 'fact'
                    check (kind in ('answer','fact','history')),
  language        text not null default 'en'
                    check (language in ('en','fr')),

  source          text,                                     -- where it was first captured
  use_count       integer not null default 1,               -- ranks which answer to reuse
  last_revised_at timestamptz not null default now(),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (agent, key, language)
);
create index if not exists memory_agent_idx on artist.memory(agent);
create index if not exists memory_kind_idx  on artist.memory(kind);

-- ── triggers (drop-then-create so the file is re-runnable) ────────────────
drop trigger if exists memory_updated_at on artist.memory;
create trigger memory_updated_at
  before update on artist.memory
  for each row execute function artist.update_updated_at();
