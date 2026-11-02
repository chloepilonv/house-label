-- The artist's website (digital-marketing-build-website), one row.
-- Page content is read from the tables that own it (presskit, releases,
-- presskit_items, platforms, brand). This holds only hosting and link-outs;
-- never copy another table's column here, copies drift.

create schema if not exists artist;

create or replace function artist.update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists artist.website (
  id                 integer primary key default 1 check (id = 1),

  -- ── Where it lives ─────────────────────────────────────────────────────
  domain             text,                    -- 'odile-ray.com', the artist's own
  vercel_project_id  text,                    -- set by the first deploy, reused after
  vercel_url         text,                    -- the last production URL Vercel returned
  default_locale     text check (default_locale in ('en','fr')),  -- null = artist.profile.preferred_locale

  -- ── Link-outs that are not a platform profile ──────────────────────────
  -- Linked out, not hosted. Null renders as a labelled placeholder, never an
  -- invented link.
  shop_url           text,                    -- Bandcamp merch, Shopify, lnk.to store
  newsletter_url     text,                    -- Mailchimp / Substack / Laylo signup
  sms_url            text,                    -- Community, WhatsApp, Laylo
  bandsintown_artist text,                    -- the widget's artist name or id; null = no upcoming-shows widget
  presave_url        text,                    -- the next release's pre-save link, while it has no smart link yet

  -- ── Sections the artist switched off ───────────────────────────────────
  -- {"store": false, "press": false}. Absent = on. Read only by the build script.
  sections           jsonb not null default '{}',

  last_built_at      timestamptz,
  last_deployed_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists website_updated_at on artist.website;
create trigger website_updated_at
  before update on artist.website
  for each row execute function artist.update_updated_at();
