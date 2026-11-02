-- ── catalog.distribution_* ────────────────────────────────────────────────
-- Distributors that serve artists in Canada and the US (not only those based
-- there): terms, fees, delivery specs. Read by agents/distribution.
-- No store-coverage join table: no vendor publishes a reliable store list.

-- Re-declared because each schema file must stand alone on a fresh database.
create or replace function catalog.update_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create table if not exists catalog.distribution_services (
  id             text primary key,                      -- stable slug, e.g. 'cd-baby'
  name           text not null,
  slug           text generated always as (
                   btrim(regexp_replace(
                     translate(
                       replace(replace(lower(name), 'œ', 'oe'), 'æ', 'ae'),
                       'àâäáãåçèéêëìíîïñòóôöõùúûüýÿ',
                       'aaaaaaceeeeiiiinooooouuuuyy'),
                     '[^a-z0-9]+', '-', 'g'), '-')
                 ) stored,
  url            text not null,
  description    text,                                  -- who they are, in the artist's terms

  -- ── identity ──────────────────────────────────────────────────────────
  -- `layer` keeps artist-facing, label-facing and platform companies from being
  -- ranked against each other on price.
  layer          text not null default 'artist_facing'
                   check (layer in ('artist_facing','label_facing','platform')),
  hq_country     text,                                  -- ISO-ish: 'CA','US','UK','SE'…
  hq_city        text,
  founded_year   smallint,
  parent_company text,                                  -- 'Universal Music Group', or null when independent
  nonprofit      boolean not null default false,        -- Distribution Amplitude is the only one so far
  -- Decided by page content, never HTTP status (parked domains return 200).
  operating_status text not null default 'active'
                   check (operating_status in ('active','ceased','merged','unknown')),
  tech_platform  text,                                  -- what it runs ON, e.g. 'AudioSalad'

  -- ── access ────────────────────────────────────────────────────────────
  submission_policy text not null default 'unknown'
                   check (submission_policy in ('open','application','referral','closed','unknown')),
  signup_url     text,                                  -- discovered from the page's own links, never guessed:
  apply_url      text,                                  --   AWAL is apply.awal.com, Stem is apply.stem.is
  contact_email  text,
  -- Help centre root (one article is spec_url): the authority for anything with
  -- no column here. Curated in help-centres.ts, discovered by enrich.ts.
  help_center_url text,
  traction_required boolean,                            -- the selective tier gates on existing numbers
  free_trial_days smallint,
  docs_required  text[] not null default '{}',

  -- ── money ─────────────────────────────────────────────────────────────
  -- Nullable with no default: a USD default would mislabel CAD prices, and
  -- cad_pricing derives from it.
  currency       text,
  fee_model      text not null default 'unknown'
                   check (fee_model in ('subscription','per_release','per_track',
                                        'revenue_share','hybrid','negotiated','unknown')),
  -- [{plan, amount, period, artists, tracks, cut_pct}]. The cut can vary by tier.
  price_tiers    jsonb not null default '[]',
  -- ── add-ons ──
  -- Paid extras sold beside the deal, named and priced (the booleans below only
  -- say a service exists).
  -- [{name, does, price, price_unit, cut_pct, included_in, excludes, url}];
  -- `price` is a verbatim string. [] means nobody looked; "sells none" is
  -- 'addons' in not_stated.
  addons         jsonb not null default '[]',
  cut_streaming_pct numeric(5,2),                       -- % of RECORDING royalties only
  cut_social_pct    numeric(5,2),                       -- TikTok/Meta/YouTube — often a different, higher rate
  cut_downloads_pct numeric(5,2),
  payout_frequency  text,
  payout_minimum    text,
  payout_methods    text[] not null default '{}',
  advances_offered  boolean,

  -- ── exit ──
  -- What happens to live releases when a subscription lapses. Rarely published.
  lapse_behavior      text,
  takedown_policy     text,
  catalog_transfer_in boolean,

  -- ── reach ─────────────────────────────────────────────────────────────
  -- The vendor's marketing claim, never coverage.
  store_count_claimed  text,
  territories          text[] not null default '{}',    -- usually just {global}; kept because the exceptions matter
  bandcamp_delivery    boolean,                         -- no standard distributor does this
  soundcloud_delivery  boolean,
  youtube_music_delivery boolean,
  content_id           boolean,

  -- ── timing ────────────────────────────────────────────────────────────
  -- Stacks on top of each store's own pitch deadline.
  delivery_lead_time_days smallint,
  fastest_delivery_days   smallint,
  expedited_cost          text,

  -- ── delivery: what this distributor's upload form accepts ──
  -- Narrower than the store baseline in knowledge/delivery-requirements.md.
  -- Null means the baseline applies as far as we know, not that they are silent.
  spec_url        text,                                 -- their own requirements page, so the
                                                        -- artist can read the authority themselves
  artwork_formats text[] not null default '{}',         -- {jpg} | {jpg,png,tiff}
  artwork_min_px  smallint,                             -- their stated minimum, not the recommendation
  -- A hard cap that rejects files; varies by distributor.
  artwork_max_px  smallint,
  audio_formats   text[] not null default '{}',         -- {wav} | {wav,flac}

  -- ── rights ────────────────────────────────────────────────────────────
  isrc_provided       boolean,
  upc_provided        boolean,
  masters_retained    boolean,
  exclusivity_required boolean,
  term_length         text,
  publishing_admin    boolean,                          -- a SECOND product, never the distribution deal
  neighbouring_rights boolean,
  sync_offered        boolean,
  max_tracks          integer,
  max_artists         text,                             -- '1', '2', '1-100', '7+' — not always a number

  -- ── Canada — properties of a row, never a separate market section ──────
  cad_pricing          boolean not null default false,
  canadian_office      text,
  -- The distributor's own claim, unverified against the funders' rules.
  grant_eligibility_ca text[] not null default '{}',
  french_support       boolean,

  -- ── accreditation ─────────────────────────────────────────────────────
  spotify_directory_tier    text,                       -- 'preferred' | null
  spotify_directory_section text,                       -- 'artist' | 'label'
  merlin_member             boolean,
  ddex_version              text,

  -- ── honesty ───────────────────────────────────────────────────────────
  -- null means nobody looked. not_stated means the field is genuinely absent;
  -- only then may the agent say "they don't publish it".
  not_stated    text[] not null default '{}',

  -- ── provenance & lifecycle (identical on every shared catalog table) ────
  source        text,
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
  -- Not unique(name): extracted names vary between runs.
  unique (id)
);

-- Applied after the table first shipped: create table if not exists does
-- nothing to an existing table.
alter table catalog.distribution_services alter column currency drop not null;
alter table catalog.distribution_services alter column currency drop default;
-- Payout-pass bookkeeping: enrich.ts stops
-- after MAX_ATTEMPTS and records the rest in not_stated.
alter table catalog.distribution_services add column if not exists enriched_at     timestamptz;
alter table catalog.distribution_services add column if not exists enrich_attempts smallint not null default 0;
-- The delivery pass has its own attempt budget, so exhausting payout reads
-- never marks delivery specs not_stated.
alter table catalog.distribution_services add column if not exists spec_url        text;
alter table catalog.distribution_services add column if not exists artwork_formats text[] not null default '{}';
alter table catalog.distribution_services add column if not exists artwork_min_px  smallint;
alter table catalog.distribution_services add column if not exists artwork_max_px  smallint;
alter table catalog.distribution_services add column if not exists audio_formats   text[] not null default '{}';
alter table catalog.distribution_services add column if not exists delivery_enriched_at timestamptz;
alter table catalog.distribution_services add column if not exists delivery_attempts    smallint not null default 0;
-- The add-ons pass has its own attempt budget, for the same reason.
alter table catalog.distribution_services add column if not exists addons             jsonb not null default '[]';
alter table catalog.distribution_services add column if not exists addons_enriched_at timestamptz;
alter table catalog.distribution_services add column if not exists addons_attempts    smallint not null default 0;

-- Help centre root; see the column comment in the CREATE above.
alter table catalog.distribution_services add column if not exists help_center_url text;
do $$ begin
  alter table catalog.distribution_services drop constraint distribution_services_name_key;
exception when undefined_object then null; end $$;

create unique index if not exists distribution_services_slug_idx on catalog.distribution_services(slug);
create index if not exists distribution_services_layer_idx on catalog.distribution_services(layer, submission_policy);
create index if not exists distribution_services_lifecycle_idx on catalog.distribution_services(lifecycle);
create index if not exists distribution_services_ca_idx on catalog.distribution_services(cad_pricing)
  where cad_pricing;

-- ── distribution_stores ───────────────────────────────────────────────────
-- Reference list of stores. Seeded, not crawled.
create table if not exists catalog.distribution_stores (
  id             text primary key,                      -- 'spotify', 'bandcamp'
  name           text not null,
  url            text,
  type           text not null default 'streaming'
                   check (type in ('streaming','download','social','video','radio','direct')),
  -- Stores the artist uploads to directly, which distributors do not deliver to.
  direct_upload_possible boolean not null default false,
  -- Spotify = 7, verified. Others unverified.
  pitch_deadline_days smallint,
  pitch_channel  text,                                  -- 'Spotify for Artists', 'via distributor'…
  regions        text[] not null default '{global}',
  notes          text,
  source_url     text,
  last_verified  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists distribution_stores_type_idx on catalog.distribution_stores(type);

drop trigger if exists distribution_services_updated_at on catalog.distribution_services;
create trigger distribution_services_updated_at before update on catalog.distribution_services
  for each row execute function catalog.update_updated_at();
drop trigger if exists distribution_stores_updated_at on catalog.distribution_stores;
create trigger distribution_stores_updated_at before update on catalog.distribution_stores
  for each row execute function catalog.update_updated_at();
