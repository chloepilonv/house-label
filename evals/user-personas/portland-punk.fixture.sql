-- Lamprey Season: an invented punk trio from Portland, Oregon. The US fixture —
-- country US, three members, no label, a 7-inch and a cassette behind them.
-- A department that assumes Canada (SOCAN, CanCon, FACTOR) or one writer per
-- song fails here and nowhere else.
truncate artist.profile, artist.brand, artist.presskit, artist.presskit_items, artist.presskit_versions,
         artist.releases, artist.songs, artist.platforms, artist.platform_stats,
         artist.marketing_campaigns, artist.marketing_ideas, artist.marketing_tasks,
         artist.press_campaigns, artist.press_pitches, artist.registrations,
         artist.saved_distributors,
         artist.release_checklist, artist.release_credits, artist.song_samples,
         artist.projects, artist.memory cascade;

insert into artist.profile
  (id, artist_name, artist_type, members, city, region, country, citizenship, timezone,
   target_markets, genres, disciplines, career_stage, project_description, languages, preferred_locale)
values
  (1, 'Lamprey Season', 'band',
   '[{"name":"Jo Kessler","role":"vocals, guitar"},{"name":"Dev Okafor","role":"bass"},{"name":"Marin Tsai","role":"drums"}]',
   'Portland', 'OR', 'US', '{US}', 'America/Los_Angeles', '{US}',
   '{"punk","garage punk"}', '{songwriter,performer}', 'emerging',
   'Three-piece punk band from Portland, Oregon. Self-released: a cassette demo (2024) and a 7-inch (2025). Debut LP recorded, mixing now, 300 copies of vinyl ordered. Every song written by all three.',
   '{en}', 'en');

insert into artist.presskit (id, short_bio, moodboard_notes, visual_identity) values
  (1,
   'Lamprey Season are a punk trio from Portland, Oregon: two-minute songs, three voices, one van.',
   'Photocopy black and white, red spray paint, flyers stapled over flyers.',
   '{"primary":"#D62828","background":"#111111"}');

insert into artist.releases (title, release_type, release_date, label, distributor) values
  ('Sick Day', 'single', '2025-05-09', 'self-released', 'self'),
  ('Demo',     'ep',     '2024-03-15', 'self-released', 'self');

insert into artist.platforms (platform, url, is_primary) values
  ('bandcamp',  'https://lampreyseason.bandcamp.com',                 true),
  ('instagram', 'https://instagram.com/example-lampreyseason',        false),
  ('spotify',   'https://open.spotify.com/artist/example-lampreyseason', false);

insert into artist.platform_stats (platform, date, monthly_listeners, followers, source) values
  ('spotify',  '2026-09-01', 2300, null, 'manual'),
  ('bandcamp', '2026-09-01', null, 640,  'manual');

insert into artist.presskit_items (kind, dedupe_key, data) values
  ('quote','weekly',      '{"text":"The best two minutes you''ll spend this week.","source":"a Portland weekly"}'),
  ('show', 'mississippi', '{"venue":"Mississippi Studios","city":"Portland OR","date":"2026-06-12"}'),
  ('show', 'polaris',     '{"venue":"Polaris Hall","city":"Portland OR","date":"2026-03-20"}');
