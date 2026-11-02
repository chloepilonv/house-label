-- Marketing campaigns (agents/digital-marketing).
--
--   marketing_campaigns  — the brief: project, target date, budget, plan.
--   marketing_tasks      — the calendar: dated, platform-scoped to-dos.
--
-- Private to the artist. Ships empty. Re-runnable.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── marketing_campaigns ───────────────────────────────────────────────────
create table if not exists artist.marketing_campaigns (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  -- Releases only: v1 scopes campaigns to the release path.
  project_type         text not null
                         check (project_type in ('single_release','ep_release','album_release')),
  status               text not null default 'draft'
                         check (status in ('draft','qa','generating','active','paused',
                                           'completed','archived')),

  -- `target_date` is the anchor tasks offset from; start/end come from the
  -- earliest and latest task.
  target_date          date,
  start_date           date,
  end_date             date,

  platforms            text[] not null default '{}',        -- bounds every task in the plan
  release_id           uuid references artist.releases(id) on delete set null,

  -- The scoped project this promotes. The intake offers its title, date, budget
  -- and lead single instead of asking again. Nullable; the two project_type
  -- vocabularies are mapped, not assigned.
  project_id           uuid references artist.projects(id) on delete set null,

  -- `primary_goal` is ordered, not exclusive: the first element leads the spend
  -- split. `budget` caps the sum of task costs. NULL budget is not zero: zero
  -- means all-organic, NULL means not asked.
  primary_goal         text[] not null default '{}'
                         check (primary_goal <@ array['streams','video_views','followers']),
  budget               numeric(10,2) check (budget is null or budget >= 0),

  -- The SMART goal. A column, not a `brief` key, because the day-28 read compares against it.
  success_target       text,

  -- The generated plan
  summary              text,
  key_messages         text[] not null default '{}',
  content_pillars      text[] not null default '{}',
  total_estimated_cost numeric(10,2),


  -- Intake answers. Free-shaped; nothing queries into it.
  brief                jsonb not null default '{}',

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists marketing_campaigns_status_idx     on artist.marketing_campaigns(status);
create index if not exists marketing_campaigns_release_id_idx on artist.marketing_campaigns(release_id);

-- ── marketing_tasks ───────────────────────────────────────────────────────
-- `unique (campaign_id, sort_order)` lets regeneration upsert, keeping status,
-- captions and calendar ids. `due_date` is computed in artist.profile.timezone;
-- UTC gives off-by-one dates.
create table if not exists artist.marketing_tasks (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references artist.marketing_campaigns(id) on delete cascade,

  title          text not null,
  description    text,
  task_type      text not null default 'action'
                   check (task_type in ('create','post','outreach','action','milestone')),
  phase          text,                                      -- the plan phase this belongs to
  platforms      text[] not null default '{}',

  content_brief  text,
  captions       jsonb not null default '{}',               -- platform → caption text
  ad_copies      jsonb not null default '[]',               -- [{framework, hook, body, cta, …}]
  content_url    text,                                      -- what the artist actually made

  due_date       date not null,
  posting_time   time,
  estimated_cost numeric(10,2) not null default 0,          -- 0 = organic
  status         text not null default 'pending'
                   check (status in ('pending','in_progress','done','skipped')),
  sort_order     integer not null,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (campaign_id, sort_order)
);
create index if not exists marketing_tasks_campaign_id_idx on artist.marketing_tasks(campaign_id);
create index if not exists marketing_tasks_due_date_idx    on artist.marketing_tasks(due_date);
create index if not exists marketing_tasks_status_idx      on artist.marketing_tasks(status);

-- task_type 'publish' renamed to 'post'. Drop the constraint first (the UPDATE
-- would violate it), rewrite rows, re-add it.
alter table artist.marketing_tasks drop constraint if exists marketing_tasks_task_type_check;
update artist.marketing_tasks set task_type = 'post' where task_type = 'publish';
alter table artist.marketing_tasks
  add constraint marketing_tasks_task_type_check
  check (task_type in ('create','post','outreach','action','milestone'));

-- ── added after the first release ────────────────────────────────────────
-- Every column added after the table shipped needs an idempotent ALTER here.
alter table artist.marketing_campaigns add column if not exists project_id       uuid references artist.projects(id) on delete set null;
alter table artist.marketing_campaigns add column if not exists budget           numeric(10,2);
alter table artist.marketing_campaigns add column if not exists success_target   text;

-- Performance-read columns removed with their skill; they held no data.
alter table artist.marketing_campaigns drop column if exists analyzed_on;
alter table artist.marketing_campaigns drop column if exists analysis_summary;
alter table artist.marketing_campaigns drop column if exists what_worked;
alter table artist.marketing_campaigns drop column if exists adjustments;
alter table artist.marketing_campaigns drop column if exists next_30_days;

-- Constraints are dropped and re-added, since editing the CREATE does not reach
-- existing tables. primary_goal changed from text to an array; it held no data,
-- so it is recreated rather than migrated.
alter table artist.marketing_campaigns drop constraint if exists marketing_campaigns_primary_goal_check;
do $$ begin
  if exists (select 1 from information_schema.columns
              where table_schema='artist' and table_name='marketing_campaigns'
                and column_name='primary_goal' and data_type <> 'ARRAY') then
    alter table artist.marketing_campaigns drop column primary_goal;
  end if;
end $$;
alter table artist.marketing_campaigns
  add column if not exists primary_goal text[] not null default '{}';
do $$ begin
  alter table artist.marketing_campaigns
    add constraint marketing_campaigns_primary_goal_check
    check (primary_goal <@ array['streams','video_views','followers']);
exception when duplicate_object then null; end $$;

alter table artist.marketing_campaigns drop constraint if exists marketing_campaigns_project_type_check;
alter table artist.marketing_campaigns
  add constraint marketing_campaigns_project_type_check
  check (project_type in ('single_release','ep_release','album_release'));

-- Must come after the ALTER: on an existing table the column does not exist
-- until then, and the index would fail.
create index if not exists marketing_campaigns_project_id_idx on artist.marketing_campaigns(project_id);

do $$ begin
  alter table artist.marketing_campaigns
    add constraint marketing_campaigns_budget_check
    check (budget is null or budget >= 0);
exception when duplicate_object then null; end $$;

-- ── marketing_ideas ───────────────────────────────────────────────────────
-- The content menu: proposed ideas and which ones the artist picked. A table,
-- not jsonb, because the plan is built from the selected rows, each becoming a
-- create/post task pair.
create table if not exists artist.marketing_ideas (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references artist.marketing_campaigns(id) on delete cascade,

  n            integer not null,                          -- what the artist types to pick it
  title        text not null,
  hook         text,                                      -- the actual first line the audience sees
  cta          text,
  format       text,                                      -- reel · short · post · carousel · story · video · live · thread
  category     text                                       -- the eight in knowledge/content.md
                 check (category is null or category in ('behind_the_scenes','storytelling',
                        'fan_engagement','visual','milestone','collaboration','educational','promotional')),
  effort       text not null default 'normal'
                 check (effort in ('low','normal','shoot')),  -- `low` = no filming; caps against weekly capacity

  -- Nothing is planned from a `suggested` row; only the artist selects.
  status       text not null default 'suggested'
                 check (status in ('suggested','selected','rejected','planned')),
  proposed_by  text not null default 'agent' check (proposed_by in ('agent','artist')),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (campaign_id, n)
);
create index if not exists marketing_ideas_campaign_idx on artist.marketing_ideas(campaign_id);
create index if not exists marketing_ideas_status_idx   on artist.marketing_ideas(status);

drop trigger if exists marketing_ideas_updated_at on artist.marketing_ideas;
create trigger marketing_ideas_updated_at
  before update on artist.marketing_ideas
  for each row execute function artist.update_updated_at();

-- ── triggers (drop-then-create so the file is re-runnable) ────────────────
drop trigger if exists marketing_campaigns_updated_at on artist.marketing_campaigns;
create trigger marketing_campaigns_updated_at
  before update on artist.marketing_campaigns
  for each row execute function artist.update_updated_at();

drop trigger if exists marketing_tasks_updated_at on artist.marketing_tasks;
create trigger marketing_tasks_updated_at
  before update on artist.marketing_tasks
  for each row execute function artist.update_updated_at();

-- ── the Drive workspace ───────────────────────────────────────────────────
-- The Drive folder for this task's content, under `digital-contents/`
-- (engine/google/WORKSPACE.md). Only `create` tasks get one. Separate from
-- `content_url` (what was made), or every task would look delivered.
alter table artist.marketing_tasks add column if not exists drive_folder_url text;
