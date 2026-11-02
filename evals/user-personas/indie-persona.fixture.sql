-- Sam Reyes, as the label's database sees them: a profile and nothing else.
-- No releases, no presskit, no platforms, no memory. That emptiness IS the
-- fixture — a first-time artist is exactly the case where every department
-- has to work with nothing, and seeding them richly would test the wrong thing.
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
  (1, 'Sam Reyes', 'Montreal', 'QC', 'CA', '{CA}', 'America/Toronto', '{QC,CA,US}',
   '{"indie electronic"}', '{songwriter,performer,producer}', 'emerging',
   'Electric guitar over electronic production, with vocals. First album, self-recorded at home. Nothing released yet.',
   '{en}', 'en');
