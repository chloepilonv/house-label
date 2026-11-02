-- ── catalog.promotion_* ───────────────────────────────────────────────────
-- Who will play an independent artist's record, and what reaching them costs.
-- Read by agents/promotion. Stations are targets; radio and pitch services are
-- bills, kept in separate tables (priced per format vs per credit).
-- Station identity comes from licence databases; the submission route from each
-- station's own site, so a row with no route is normal (see `route_known`).
-- No Spotify-derived data: its terms forbid redistributing it.

-- Re-declared: each schema file must stand alone on a fresh database.
create or replace function catalog.update_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- ── stations ──────────────────────────────────────────────────────────────
-- Renamed from promotion_stations. Idempotent.
alter table if exists catalog.promotion_stations rename to promotion_radio_stations;
alter index if exists catalog.promotion_stations_slug_idx      rename to promotion_radio_stations_slug_idx;
alter index if exists catalog.promotion_stations_country_idx   rename to promotion_radio_stations_country_idx;
alter index if exists catalog.promotion_stations_type_idx      rename to promotion_radio_stations_type_idx;
alter index if exists catalog.promotion_stations_lifecycle_idx rename to promotion_radio_stations_lifecycle_idx;
alter index if exists catalog.promotion_stations_genre_idx     rename to promotion_radio_stations_genre_idx;
alter index if exists catalog.promotion_stations_lang_idx      rename to promotion_radio_stations_lang_idx;
alter index if exists catalog.promotion_stations_reachable_idx rename to promotion_radio_stations_reachable_idx;

create table if not exists catalog.promotion_radio_stations (
  id            text primary key,                     -- 'us-fcc-KRUA', 'ca-ncra-cism'
  call_sign     text not null,                        -- CISM, KRUA — the identity on air
  name          text,                                 -- 'CISM 89,3' where the station brands itself
  slug          text generated always as (
                  btrim(regexp_replace(
                    translate(
                      replace(replace(lower(coalesce(name, call_sign)), 'œ', 'oe'), 'æ', 'ae'),
                      'àâäáãåçèéêëìíîïñòóôöõùúûüýÿ',
                      'aaaaaaceeeeiiiinooooouuuuyy'),
                    '[^a-z0-9]+', '-', 'g'), '-')
                ) stored,

  -- ── where it is ───────────────────────────────────────────────────────
  country       text not null check (country in ('CA','US')),
  region        text,                                 -- province or state, two letters
  city          text,

  -- ── what it is ────────────────────────────────────────────────────────
  -- The tier drives ranking (campus/community answer unsigned artists), so it is
  -- a column, never inferred from the licensee.
  station_type  text not null default 'unknown'
                  check (station_type in ('campus','community','public','commercial','unknown')),
  band          text check (band in ('fm','am','internet')),
  frequency     numeric(6,2),                         -- 89.30
  licensee      text,                                 -- FCC licence holder / NCRA member org
  facility_id   text,                                 -- FCC facility id; null in Canada
  website       text,
  languages     text[] not null default '{}',         -- {'fr'}, {'en','fr'}
  genre_fit     text[] not null default '{}',

  -- ── how you actually reach it ─────────────────────────────────────────
  -- Same vocabulary as the playlists' submission_route.
  submission_route text not null default 'unknown'
                     check (submission_route in
                       ('direct_email','form','physical','earshot','dmds','none','unknown')),
  submission_url   text,
  submission_email text,
  -- Quoted from the station's own page, never paraphrased: rules differ per station.
  stated_rules     text,
  accepts_singles  boolean,                           -- null = not stated
  accepts_physical boolean,
  accepts_digital  boolean,

  -- Derived, so the agent can say how many are reachable rather than present a
  -- licence database as a contact list.
  route_known   boolean generated always as (
                  submission_route not in ('none','unknown')
                  or submission_email is not null
                  or submission_url is not null
                ) stored,

  -- ── charts ────────────────────────────────────────────────────────────
  reports_to    text[] not null default '{}',         -- {'earshot'} {'nacc'}
  on_earshot    boolean,                              -- reachable through !earshot Distro (CA)

  notes         text,

  -- ── provenance & lifecycle (identical on every shared catalog table) ────
  source        text not null default 'seed'
                  check (source in ('seed','crawl_fetch','crawl_tinyfish','crawl_puppeteer','manual')),
  source_url    text,
  protected     boolean not null default false,
  content_hash  text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  -- Campus music directors rotate each semester; lets the agent say how old a route is.
  last_verified timestamptz,
  missing_since timestamptz,
  missing_runs  smallint not null default 0,
  lifecycle     text not null default 'active'
                  check (lifecycle in ('active','unconfirmed','retired')),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (country, call_sign)                          -- natural key for crawler upserts
);
create unique index if not exists promotion_radio_stations_slug_idx    on catalog.promotion_radio_stations(slug);
create index if not exists promotion_radio_stations_country_idx        on catalog.promotion_radio_stations(country, region);
create index if not exists promotion_radio_stations_type_idx           on catalog.promotion_radio_stations(station_type);
create index if not exists promotion_radio_stations_lifecycle_idx      on catalog.promotion_radio_stations(lifecycle);
create index if not exists promotion_radio_stations_genre_idx          on catalog.promotion_radio_stations using gin(genre_fit);
create index if not exists promotion_radio_stations_lang_idx           on catalog.promotion_radio_stations using gin(languages);
-- The default query: stations reachable today.

create index if not exists promotion_radio_stations_reachable_idx      on catalog.promotion_radio_stations(country, station_type)
  where route_known and lifecycle = 'active';

-- ── radio services ────────────────────────────────────────────────────────
create table if not exists catalog.promotion_radio_services (
  id            text primary key,                     -- 'earshot-distro', 'yangaroo-dmds'
  name          text not null,
  url           text not null,
  description   text,
  country       text check (country in ('CA','US')),  -- null = serves both

  -- What you are buying. Delivery is not airplay.
  kind          text not null default 'delivery'
                  check (kind in ('delivery','tracking','promoter')),

  -- ── price ─────────────────────────────────────────────────────────────
  -- As the page states it, plus a numeric floor. Unpublished price: price_published = false,
  -- never a third-party number.
  currency        text,
  price_from      numeric(10,2),                      -- lowest real entry price
  price_unit      text,                               -- 'per song' | 'per format' | 'per month'
  price_tiers     jsonb not null default '[]'::jsonb, -- [{raw:'Canada CHR/Top 40 $495'}]
  price_published boolean not null default false,     -- false = login-walled, e.g. DMDS
  free_tier       boolean,

  -- ── reach ─────────────────────────────────────────────────────────────
  -- The vendor's own claim, as text: vendors state different figures on different pages.
  reach_claimed   text,
  station_count   integer,                            -- only when a single figure is published
  buys_airplay    boolean not null default false,     -- always false so far, and it must be stated
  how_to_use      text,                               -- the actual steps, from the vendor's own page

  notes         text,

  -- ── provenance & lifecycle (identical on every shared catalog table) ────
  source        text not null default 'seed'
                  check (source in ('seed','crawl_fetch','crawl_tinyfish','crawl_puppeteer','manual')),
  source_url    text,
  protected     boolean not null default false,
  content_hash  text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  last_verified timestamptz,
  missing_since timestamptz,
  missing_runs  smallint not null default 0,
  lifecycle     text not null default 'active'
                  check (lifecycle in ('active','unconfirmed','retired')),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists promotion_radio_services_kind_idx   on catalog.promotion_radio_services(kind);
create index if not exists promotion_radio_services_country_idx on catalog.promotion_radio_services(country);

-- ── playlist pitch services ───────────────────────────────────────────────
create table if not exists catalog.promotion_pitch_services (
  id            text primary key,                     -- 'groover', 'submithub'
  name          text not null,
  url           text not null,
  description   text,

  -- ── price ─────────────────────────────────────────────────────────────
  currency          text,
  price_per_credit  numeric(10,2),
  credits_per_pitch text,                             -- '2; 4 or 6 for top curators'
  smallest_pack     numeric(10,2),
  price_published   boolean not null default false,   -- SubmitHub is false: JS app, /pricing 404s
  free_tier         boolean,

  -- ── what it promises ──────────────────────────────────────────────────
  -- response_guarantee is what a paid submission buys. It is not an acceptance
  -- rate; vendor percentages are usually reply rates.
  response_guarantee text,                            -- '7 days or credits refunded'
  answer_rate_pct    numeric(5,2),                    -- reply rate, vendor self-reported
  acceptance_rate_pct numeric(5,2),                   -- almost always null, and that is the finding
  curator_count      integer,
  francophone_curators boolean,                       -- null = not published

  -- A guaranteed add is bought with artificial streams; the penalty lands on the artist.
  sells_placement    boolean not null default false,
  risk_notes         text,
  how_to_use         text,

  notes         text,

  -- ── provenance & lifecycle (identical on every shared catalog table) ────
  source        text not null default 'seed'
                  check (source in ('seed','crawl_fetch','crawl_tinyfish','crawl_puppeteer','manual')),
  source_url    text,
  protected     boolean not null default false,
  content_hash  text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  last_verified timestamptz,
  missing_since timestamptz,
  missing_runs  smallint not null default 0,
  lifecycle     text not null default 'active'
                  check (lifecycle in ('active','unconfirmed','retired')),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- The agent never recommends placement sellers by default.
create index if not exists promotion_pitch_services_safe_idx on catalog.promotion_pitch_services(sells_placement)
  where sells_placement = false;

-- ── triggers (drop-then-create so the file is re-runnable) ────────────────
drop trigger if exists promotion_radio_stations_updated_at on catalog.promotion_radio_stations;
create trigger promotion_radio_stations_updated_at
  before update on catalog.promotion_radio_stations
  for each row execute function catalog.update_updated_at();

drop trigger if exists promotion_radio_services_updated_at on catalog.promotion_radio_services;
create trigger promotion_radio_services_updated_at
  before update on catalog.promotion_radio_services
  for each row execute function catalog.update_updated_at();

drop trigger if exists promotion_pitch_services_updated_at on catalog.promotion_pitch_services;
create trigger promotion_pitch_services_updated_at
  before update on catalog.promotion_pitch_services
  for each row execute function catalog.update_updated_at();

-- ── promotion_playlists: playlists an artist can pitch, and how ──
create table if not exists catalog.promotion_playlists (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  platform        text not null
                    check (platform in ('spotify','apple_music','deezer','youtube',
                                        'amazon','tidal','bandcamp','other')),
  slug            text generated always as (
                    platform || ':' || btrim(regexp_replace(
                      translate(replace(replace(lower(name), 'œ', 'oe'), 'æ', 'ae'),
                        'àâäáãåçèéêëìíîïñòóôöõùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'),
                      '[^a-z0-9]+', '-', 'g'), '-')
                  ) stored,

  -- Editorial: pitched only through Spotify for Artists, one track per release.
  -- Algorithmic: never pitchable; listed so the agent can explain that.
  curator_type    text not null default 'independent'
                    check (curator_type in ('editorial','independent','algorithmic','brand')),
  curator_name    text,
  curator_contact text,                                    -- handle, email, or form URL
  playlist_url    text,

  -- Follower counts move weekly, so they carry their own timestamp.
  follower_count      integer,
  follower_checked_at timestamptz,

  genre_fit       text[] not null default '{}',
  language        text check (language in ('fr','en','bilingual')),
  region          text,
  country         text check (country in ('CA','US')),     -- null = global

  -- How you actually get in. 'spotify_for_artists' and 'distributor' are forms,
  -- not addresses; groover/submithub are promotion_pitch_services rows.
  submission_route text not null default 'none'
                     check (submission_route in ('spotify_for_artists','distributor',
                       'direct_email','direct_dm','form','groover','submithub','none')),
  submission_url   text,
  -- Spotify editorial wants the track before release (≥7 days); independent
  -- curators need a live link.
  accepts_prerelease boolean,
  lead_time_days     integer,

  -- Paying per submission is fine; paying for guaranteed placement gets the artist flagged.
  pay_to_submit    boolean not null default false,
  submission_cost  text,                                   -- '~$3/submission (verify)'
  sells_placement  boolean not null default false,
  risk_notes       text,

  notes            text,

  -- ── provenance & lifecycle (identical on every shared catalog table) ────
  source        text not null default 'seed'
                  check (source in ('seed','crawl_fetch','crawl_tinyfish','crawl_puppeteer','manual')),
  source_url    text,
  protected     boolean not null default false,
  content_hash  text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  last_verified timestamptz,
  missing_since timestamptz,
  missing_runs  smallint not null default 0,
  lifecycle     text not null default 'active'
                  check (lifecycle in ('active','unconfirmed','retired')),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (platform, name)                                  -- natural key for seed upserts
);
