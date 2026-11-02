-- Label projects (agents/label-manager): the whole release, funding through
-- post-release, as phases each owned by a department. Not marketing_campaigns,
-- which holds marketing tasks a few weeks out.
-- Private to the artist. Ships empty. Re-runnable.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── projects ──────────────────────────────────────────────────────────────
-- `street_date` is the anchor: phase windows are offsets from it, so moving it
-- moves the plan. `scope` holds manager-scope-project's answers, free-shaped so
-- the question set can grow without a migration; queried fields are lifted out.
create table if not exists artist.projects (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  project_type     text not null
                     check (project_type in ('single','ep','album','tour')),
  status           text not null default 'scoping'
                     check (status in ('scoping','planned','active','released',
                                       'abandoned')),

  -- Null means not yet dated; manager-plan-release then gives no absolute dates.
  street_date      date,
  date_is_target   boolean not null default true,   -- a month aimed at, not a date fixed

  -- Lifted out of `scope` because the plan branches on them.
  physical         text not null default 'none'
                     check (physical in ('none','vinyl','cd','both')),
  recording_status text not null default 'not_started'
                     check (recording_status in ('not_started','tracking','mixing',
                                                 'mastered','delivered')),
  markets          text[] not null default '{}',    -- quebec | canada | usa
  budget_amount    numeric(10,2),
  budget_currency  text check (budget_currency in ('CAD','USD')),

  -- One editorial pitch per release, none after a track is live, so the lead
  -- single is decided at scoping.
  lead_single_id   uuid references artist.songs(id) on delete set null,
  lead_single_date date,                            -- the single's own street date

  -- No studio publishes a turnaround, so the artist is asked. Null means
  -- unknown: the milestone keeps its deadline but has no estimate.
  masters_ready_on date,

  release_id       uuid references artist.releases(id) on delete set null,
  scope            jsonb not null default '{}',
  notes            text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- Added after the table shipped, so idempotent ALTERs.
alter table artist.projects add column if not exists lead_single_date date;
alter table artist.projects add column if not exists masters_ready_on date;

create index if not exists projects_status_idx      on artist.projects(status);
create index if not exists projects_street_date_idx on artist.projects(street_date);
create index if not exists projects_release_id_idx  on artist.projects(release_id);

-- ── project_phases ────────────────────────────────────────────────────────
-- Windows are signed week offsets from street_date (negative before release),
-- never absolute dates; dates are computed at read time.
-- `owner` null is a real state: no department owns that phase (e.g. merch).
-- Gotcha: regenerating a plan reassigns sort_order, so a phase's status can end
-- up attached to different work.
create table if not exists artist.project_phases (
  id             uuid not null default gen_random_uuid() primary key,
  project_id     uuid not null references artist.projects(id) on delete cascade,

  title          text not null,
  sort_order     integer not null,

  starts_week    integer,                            -- weeks from street date, signed
  ends_week      integer,
  owner          text,                               -- department slug, or null
  gap_reason     text,                               -- why owner is null, when it is

  status         text not null default 'pending'
                   check (status in ('pending','in_progress','done','skipped','blocked')),

  -- Set by manager-check-readiness; a blocker with no gate is not recorded.
  blockers       text[] not null default '{}',

  -- True when no lead time could be sourced, rather than inventing one.
  unestimated    boolean not null default false,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (project_id, sort_order)
);
create index if not exists project_phases_project_id_idx on artist.project_phases(project_id);
create index if not exists project_phases_owner_idx      on artist.project_phases(owner);
create index if not exists project_phases_status_idx     on artist.project_phases(status);

-- ── project_deliverables ──────────────────────────────────────────────────
-- Readiness checklist, one row per deliverable, upserted by
-- manager-check-readiness each run. For `untracked` items the schema cannot see
-- (cover art, masters), the artist confirms once via `confirmed_by_artist`;
-- upserts touch only derived columns and never overwrite that.
create table if not exists artist.project_deliverables (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references artist.projects(id) on delete cascade,
  phase_id     uuid references artist.project_phases(id) on delete set null,

  item         text not null,                       -- 'ISRC', 'long bio', 'cover art'
  department   text,                                -- null = nobody; the artist
  state        text not null default 'missing'
                 check (state in ('missing','partial','present',
                                  'untracked','confirmed')),
  detail       text,                                -- '1 of 3 assigned'

  -- Survives every re-run.
  confirmed_by_artist boolean not null default false,
  confirmed_at        date,
  notes               text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (project_id, item)
);
create index if not exists project_deliverables_project_id_idx on artist.project_deliverables(project_id);
create index if not exists project_deliverables_state_idx      on artist.project_deliverables(state);

-- ── project_handoffs ──────────────────────────────────────────────────────
-- One brief as handed to a department; the row is the work item the department
-- marks delivered. `deadline` is the only absolute date stored: it records what
-- was said, and comparing it to the live street date reveals a stale brief.
-- No unique constraint: a phase briefed twice is two events.
create table if not exists artist.project_handoffs (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references artist.projects(id) on delete cascade,
  phase_id     uuid not null references artist.project_phases(id) on delete cascade,

  department   text not null,                       -- 'presskit'
  skill        text,                                -- 'presskit-build'
  body         text not null,                       -- the brief as handed over
  blockers     text[] not null default '{}',
  deadline     date not null,                       -- frozen at brief time

  status       text not null default 'briefed'
                 check (status in ('briefed','in_progress','delivered','declined')),
  briefed_at   timestamptz not null default now(),
  delivered_at timestamptz,
  notes        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists project_handoffs_project_id_idx on artist.project_handoffs(project_id);
create index if not exists project_handoffs_phase_id_idx   on artist.project_handoffs(phase_id);
create index if not exists project_handoffs_status_idx     on artist.project_handoffs(status);

-- ── triggers (drop-then-create so the file is re-runnable) ────────────────
drop trigger if exists projects_updated_at on artist.projects;
create trigger projects_updated_at
  before update on artist.projects
  for each row execute function artist.update_updated_at();

drop trigger if exists project_phases_updated_at on artist.project_phases;
create trigger project_phases_updated_at
  before update on artist.project_phases
  for each row execute function artist.update_updated_at();

-- ── project_milestones ────────────────────────────────────────────────────
-- Dated deliverables inside a phase, each with an owner (not tasks; the owning
-- department makes tasks). `offset_days` from street date, in days because many
-- lead times are sourced in days. `milestone_key` is the identity, not
-- sort_order, so regeneration cannot move a `done` mark onto other work.
-- `sourced = false` means a derived date; it prints with ≈.
create table if not exists artist.project_milestones (
  id             uuid not null default gen_random_uuid() primary key,
  project_id     uuid not null references artist.projects(id) on delete cascade,
  phase_id       uuid references artist.project_phases(id) on delete set null,

  milestone_key  text not null,                      -- stable id from the catalog
  title          text not null,
  detail         text,
  owner          text,                               -- department slug, or null = the artist
  gap_reason     text,                               -- why owner is null, when it is

  offset_days    integer,                            -- signed days from street date; null = no date yet
  -- The far end of the window, when the source gives a range.
  latest_offset_days integer,
  -- Keys into SOURCES in manager-plan-release/scripts/milestones.ts.
  sources        text[] not null default '{}',
  -- A department the label lacks yet. Unlike gap_reason, this is a hiring
  -- decision the recruiting agent can act on.
  proposed_owner text,
  no_date_reason text,                               -- why offset_days is null, when it is
  sourced        boolean not null default false,     -- true = the day comes from a cited lead time
  basis          text,                               -- the citation or the derivation, verbatim

  -- Cost at three levels (floor, aim, full), in the vendor's own currencies,
  -- e.g. [{"amount":300,"currency":"CAD"}], since there is no exchange rate.
  -- `local` = the artist's account currency. Empty = no price; see no_price_reason.
  -- Numbers and sources: manager-plan-release/scripts/costs.ts.
  cost_floor     jsonb not null default '[]',
  cost_aim       jsonb not null default '[]',
  cost_full      jsonb not null default '[]',
  cost_basis     text,
  cost_sourced   boolean,                            -- null = no cost line at all
  no_price_reason text,

  status         text not null default 'pending'
                   check (status in ('pending','done','skipped','blocked')),
  sort_order     integer not null default 0,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (project_id, milestone_key)
);
-- Added after the table shipped, so idempotent ALTERs.
alter table artist.project_milestones add column if not exists latest_offset_days integer;
alter table artist.project_milestones add column if not exists sources text[] not null default '{}';
alter table artist.project_milestones add column if not exists proposed_owner text;
alter table artist.project_milestones add column if not exists cost_floor      jsonb not null default '[]';
alter table artist.project_milestones add column if not exists cost_aim        jsonb not null default '[]';
alter table artist.project_milestones add column if not exists cost_full       jsonb not null default '[]';
alter table artist.project_milestones add column if not exists cost_basis      text;
alter table artist.project_milestones add column if not exists cost_sourced    boolean;
alter table artist.project_milestones add column if not exists no_price_reason text;

create index if not exists project_milestones_project_id_idx on artist.project_milestones(project_id);
create index if not exists project_milestones_phase_id_idx   on artist.project_milestones(phase_id);
create index if not exists project_milestones_owner_idx      on artist.project_milestones(owner);

drop trigger if exists project_milestones_updated_at on artist.project_milestones;
create trigger project_milestones_updated_at
  before update on artist.project_milestones
  for each row execute function artist.update_updated_at();

drop trigger if exists project_deliverables_updated_at on artist.project_deliverables;
create trigger project_deliverables_updated_at
  before update on artist.project_deliverables
  for each row execute function artist.update_updated_at();

drop trigger if exists project_handoffs_updated_at on artist.project_handoffs;
create trigger project_handoffs_updated_at
  before update on artist.project_handoffs
  for each row execute function artist.update_updated_at();

-- ── rename: `royalties` department is now `rights` ────────────────────────
-- Artist rows outlive the old name, so migrate them. Idempotent.
update artist.project_milestones   set owner      = 'rights' where owner      = 'royalties';
update artist.project_phases       set owner      = 'rights' where owner      = 'royalties';
update artist.project_deliverables set department = 'rights' where department = 'royalties';
update artist.project_handoffs     set department = 'rights' where department = 'royalties';
update artist.memory               set agent      = 'rights' where agent      = 'royalties';

-- ── the Drive workspace ───────────────────────────────────────────────────
-- The release folder in the artist's Drive (engine/google/WORKSPACE.md).
-- Stored by id, not found by name: the folder is renamed when the street date
-- moves, and a lookup by old name would create a duplicate. Null if Google is
-- not connected.
alter table artist.projects add column if not exists drive_folder_id text;
