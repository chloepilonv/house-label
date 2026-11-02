-- Odile Ray, an invented artist: three records, awards, press, a tour.
-- The opposite fixture to indie-persona — a department that only works against
-- an empty file will fail here, and one written for a beginner will condescend.
truncate artist.profile, artist.brand, artist.presskit, artist.presskit_items, artist.presskit_versions,
         artist.releases, artist.songs, artist.platforms, artist.platform_stats,
         artist.marketing_campaigns, artist.marketing_ideas, artist.marketing_tasks,
         artist.press_campaigns, artist.press_pitches, artist.registrations,
         artist.saved_distributors,
         artist.release_checklist, artist.release_credits, artist.song_samples,
         artist.projects, artist.memory cascade;

insert into artist.profile
  (id, artist_name, city, region, country, citizenship, timezone, target_markets,
   genres, disciplines, career_stage, project_description, languages, preferred_locale)
values
  (1, 'Odile Ray', 'Montréal', 'QC', 'CA', '{CA}', 'America/Toronto', '{QC,CA,US}',
   '{"folk acoustique"}', '{songwriter,performer}', 'mid-career',
   'Autrice-compositrice-interprète folk. Deux EP autoproduits, un album, 120+ concerts au Québec et dans le nord-est américain.',
   '{fr,en}', 'en');

insert into artist.presskit (id, short_bio, moodboard_notes, visual_identity) values
  (1,
   'Odile Ray est une autrice-compositrice-interprète folk établie à Montréal. Des chansons courtes, sans ornement, qui tiennent debout seules avec une guitare.',
   'Sépia et crème, photographie noir et blanc, nature et fenêtres. « Une écriture qui ne demande jamais la permission. »',
   '{"primary":"#B5651D","background":"#F5F0E8"}');

insert into artist.releases (title, release_type, release_date) values
  ('Les fenêtres ouvertes', 'album', '2026-03-01'),
  ('Charlevoix Sessions',   'ep',    '2024-05-01'),
  ('Premier hiver',         'ep',    '2021-09-01');

insert into artist.platforms (platform, url, is_primary) values
  ('bandcamp',  'https://odile-ray.bandcamp.com', false),
  ('instagram', 'https://instagram.com/odileray', true),
  ('youtube',   'https://youtube.com/@odileray',  false),
  ('spotify',   'https://open.spotify.com/artist/odileray', false);

insert into artist.platform_stats (platform, date, monthly_listeners, total_streams, source) values
  ('spotify', '2026-09-02', 18400, 1200000, 'manual');

insert into artist.presskit_items (kind, dedupe_key, data) values
  ('award','gamiq-2024',  '{"title":"EP folk de l''année","organization":"GAMIQ","year":"2024"}'),
  ('award','felix-2025',  '{"title":"Prix Félix-Leclerc, finaliste","organization":"Prix Félix-Leclerc","year":"2025"}'),
  ('award','factor-2026', '{"title":"Juried Sound Recording","organization":"FACTOR","year":"2026"}'),
  ('quote','voir',        '{"text":"Elle écrit comme si chaque mot coûtait quelque chose.","source":"VOIR"}'),
  ('quote','devoir',      '{"text":"Le folk québécois a trouvé sa nouvelle plume","source":"Le Devoir"}'),
  ('show','ministere',    '{"venue":"Le Ministère","city":"Montréal","date":"2026-10-14"}'),
  ('show','cercle',       '{"venue":"Le Cercle","city":"Québec","date":"2026-10-18"}'),
  ('show','burdock',      '{"venue":"The Burdock","city":"Toronto","date":"2026-11-02"}'),
  ('show','passim',       '{"venue":"Club Passim","city":"Cambridge MA","date":"2026-11-09"}'),
  ('show','rockwood',     '{"venue":"Rockwood Music Hall","city":"New York NY","date":"2026-11-15"}');
