/**
 * Apply the artist's schemas (data/artist/*.sql) to the database.
 * Schema files are re-runnable. No seed: these tables ship empty.
 *
 * Run:  bun run artist:migrate        (needs DATABASE_URL — see doc/DEVELOPMENT.md)
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Explicit dependency order, not alphabetical: a file must come after every
 * table it references. Order bugs only show on a fresh database;
 * migrate-order.test.ts checks it.
 */
const FILES = [
  "profile.sql",
  // Early because label-project.sql ends with `update artist.memory`.
  "memory.sql",
  "songs-catalog.sql", // releases + songs — referenced by projects, digital-marketing and press
  "label-project.sql", // references artist.songs, artist.releases and artist.memory; referenced by digital-marketing
  "saved-distributors.sql",
  "release-checklist.sql", // references artist.releases
  "release-credits.sql",   // references artist.releases and artist.songs
  "platforms.sql",
  "registrations-infos.sql",
  "brand.sql",    // colours/type/logo — presskit reads it, the roster will
  "voice.sql",    // how the artist writes — every drafting department reads it through the brief
  "presskit.sql", // references artist.brand for the derived-palette fallback
  "marketing-campaign.sql", // references artist.releases and artist.projects
  "press-relation-campaign.sql",
  "contacts.sql", // people found for press and promotion — the artist's own Hunter lookups
  "promotion-targets.sql", // the promotion shortlist — references artist.releases
  "website.sql", // the artist site: reads presskit, releases and platforms; owns none of them
  "connections.sql", // linked outside accounts; deliberately outside ARTIST_TABLES
];

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("✗ Set DATABASE_URL (see doc/DEVELOPMENT.md).");
  process.exit(1);
}

const dir = dirname(fileURLToPath(import.meta.url));
// Silence the NOTICEs that re-runnable "if not exists" statements emit.
const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
for (const file of FILES) {
  await sql.unsafe(readFileSync(join(dir, file), "utf8"));
  console.log(`✓ applied artist/${file}`);
}
await sql.end();
console.log("Done.");
