-- Promotion shortlist: stations, curators and playlists the artist chose to
-- reach for a release, and where each stands. One row per target per release;
-- a pitched target is excluded from the next ranking.
-- Author: Chloe Bibiane Pilon Vaillancourt

create table if not exists artist.promotion_targets (
  id          uuid primary key default gen_random_uuid(),
  target_id   text not null,                       -- catalog slug: 'cism-893', 'spotify-editorial', a Groover curator id
  kind        text not null check (kind in ('radio','playlist','curator','service')),
  name        text,                                -- as the artist hears it
  release_id  uuid references artist.releases(id) on delete set null,
  status      text not null default 'shortlisted'
                check (status in ('shortlisted','drafted','pitched','followed_up','added','declined','dropped')),
  route       text,                                -- how it is reached: 'email', 'form', 'groover', 'submithub', 'yangaroo'
  cost        text,                                -- what that route cost, as quoted
  pitched_at  date,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (target_id, release_id)
);

create index if not exists promotion_targets_release_idx on artist.promotion_targets(release_id);

drop trigger if exists promotion_targets_updated_at on artist.promotion_targets;
create trigger promotion_targets_updated_at
  before update on artist.promotion_targets
  for each row execute function artist.update_updated_at();
