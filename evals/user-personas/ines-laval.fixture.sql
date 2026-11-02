-- Inés Laval, an invented artist:
-- three records, a label, a booking agency. Invented. The
-- scenario — $5,000 of her own, the Mexico/US launch of Marea alta in March 2027 — lives in the
-- persona, not here. No follower or stream counts: none are public, and a
-- fixture must not invent them; the persona says "regarde mon Spotify for
-- Artists" when asked.
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
  (1, 'Inés Laval', 'Montréal', 'QC', 'CA', '{CA}', 'America/Toronto', '{QC,CA,US}',
   '{"indie pop","latin pop"}', '{songwriter,performer}', 'mid-career',
   'Indie-pop aux racines latines, chantée en espagnol et en français. Un album (Marea alta, 2026) et deux EP. Signée chez Disques Lucarne; représentée par l''agence Agence Boréale pour les spectacles. Lancement de Marea alta au Mexique et aux États-Unis prévu le 12 mars 2027, avec un nouveau single radio, « Otra vez », le 22 janvier.',
   '{es,fr,en}', 'fr');

insert into artist.presskit (id, short_bio, moodboard_notes, visual_identity) values
  (1,
   'Née à Sherbrooke d''un père mexicain et d''une mère québécoise, Inés Laval fusionne les langues et les cultures dans une pop indie aux influences latines — boléro, cumbia et synthés modernes portés par une voix éthérée.',
   'Lumière dorée de fin de journée, grain de pellicule, terracotta et vert profond.',
   '{"primary":"#C2603F","background":"#1E2B23"}');

insert into artist.releases (title, release_type, release_date, label, distributor) values
  ('Marea alta',          'album',  '2026-10-02', 'Disques Lucarne', 'label-handled'),
  ('Luz de agosto',       'single', '2026-08-27', 'Disques Lucarne', 'label-handled'),
  ('Cartas al norte',   'ep',     '2024-10-04', 'Disques Lucarne', 'label-handled'),
  ('Les nuits courtes', 'single', '2024-01-19', 'Disques Lucarne', 'label-handled'),
  ('Sola',                 'ep',     '2022-10-14', 'self-released',    'self');

insert into artist.platforms (platform, url, is_primary) values
  ('instagram', 'https://instagram.com/ineslaval', true),
  ('bandcamp',  'https://ineslaval.bandcamp.com',    false),
  ('youtube',   'https://youtube.com/@ineslaval', false),
  ('facebook',  'https://www.facebook.com/ineslaval/', false);

insert into artist.presskit_items (kind, dedupe_key, data) values
  ('award','francouvertes-2024', '{"title":"Demi-finaliste","organization":"Francouvertes","year":"2024"}'),
  ('award','gamiq-2025',         '{"title":"Nomination — EP de l''année, sonorités du monde","organization":"GAMIQ","year":"2025"}'),
  ('show','feq-2025',           '{"venue":"Festival d''été de Québec","city":"Québec","date":"2025-07-10"}'),
  ('quote','lucarne-review',    '{"text":"Une voix qui passe d''une langue à l''autre sans jamais se traduire.","source":"Lucarne"}');
