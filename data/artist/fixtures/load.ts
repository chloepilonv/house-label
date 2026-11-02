/**
 * Load a test artist into a database.
 *
 *   bun run artist:fixture                 odile-ray, into $DATABASE_URL
 *   bun run artist:fixture --list          which fixtures exist
 *   bun run artist:fixture odile-ray --force   overwrite a profile that is there
 *
 * Refuses to overwrite an existing profile without --force, so a mistyped
 * DATABASE_URL cannot destroy an artist's row.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { openArtist } from "../client";
import { FIXTURES } from "./odile-ray";

const argv = process.argv.slice(2);
const force = argv.includes("--force");
const name = argv.find((a) => !a.startsWith("--")) ?? "odile-ray";

const die = (msg: string): never => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

if (argv.includes("--list")) {
  for (const [key, f] of Object.entries(FIXTURES))
    console.log(`  ${key.padEnd(14)} ${f.profile.artist_name} — suggested database: ${f.slug}`);
  process.exit(0);
}

const fixture = FIXTURES[name] ?? die(`no fixture '${name}'. Try: ${Object.keys(FIXTURES).join(", ")}`);
if (!process.env.DATABASE_URL) die("Set DATABASE_URL — the database to load into (see doc/DEVELOPMENT.md).");

const artist = await openArtist();
try {
  const existing = await artist.one<{ artist_name: string }>("profile", { id: 1 });
  if (existing && !force)
    die(
      `${process.env.DATABASE_URL!.split("/").pop()} already holds a profile for ` +
        `${existing.artist_name ?? "someone"}.\n` +
        `  Loading a fixture would replace it. Pass --force if that is what you meant.`,
    );

  await artist.upsert("profile", fixture.profile, ["id"]);
  for (const p of fixture.platforms) await artist.upsert("platforms", p, ["platform"]);
  console.log(`✓ loaded ${name} into ${process.env.DATABASE_URL!.split("/").pop()}`);
} catch (err) {
  const e = err as { code?: string; message?: string };
  if (e.code === "42P01" || /does not exist/i.test(e.message ?? ""))
    die("that database has no tables yet. Run `bun run artist:migrate` against it first.");
  throw err;
} finally {
  await artist.close();
}
