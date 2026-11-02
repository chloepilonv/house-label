-- Release checklist (agents/distribution): one row per item per release, so
-- progress persists and items can be filtered (blocking, optional, stale).
-- Optional items (e.g. lyrics) are listed with required = false.
-- `whose_rule` says whether a limit is the store's or the distributor's; the fix
-- differs (resize vs switch). Precedence: knowledge/delivery-requirements.md.
-- Private to the artist. Ships empty. Re-runnable.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── release_checklist ─────────────────────────────────────────────────────
create table if not exists artist.release_checklist (
  id           uuid primary key default gen_random_uuid(),
  release_id   uuid not null references artist.releases(id) on delete cascade,

  -- Stable across runs so a re-check updates the row: 'artwork_size', 'isrc'…
  item         text not null,
  -- Display label, e.g. "Cover art resolution".
  label        text not null,

  status       text not null default 'unknown'
                 check (status in ('ready','missing','unknown','not_applicable')),
  -- False for optional items (lyrics, a Canvas): shown, never blocking.
  required     boolean not null default true,

  -- The problem, e.g. "1200px, needs 1400".
  detail       text,
  -- What clears it, e.g. "re-export at 1400x1400 or larger".
  fix          text,
  -- 'store' | 'distributor' | 'unknown' — see the file header.
  whose_rule   text not null default 'unknown'
                 check (whose_rule in ('store','distributor','unknown')),
  -- Which distributor's rule, when whose_rule = 'distributor'.
  source       text,

  -- Specs change, so checks go stale. Null means never checked.
  checked_at   timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Makes a re-check an update.
  unique (release_id, item)
);

create index if not exists release_checklist_release_idx on artist.release_checklist(release_id);
-- What is still blocking this release.
create index if not exists release_checklist_blocking_idx
  on artist.release_checklist(release_id) where required and status <> 'ready';

-- ── triggers (drop-then-create so the file is re-runnable) ────────────────
drop trigger if exists release_checklist_updated_at on artist.release_checklist;
create trigger release_checklist_updated_at
  before update on artist.release_checklist
  for each row execute function artist.update_updated_at();
