/**
 * bun run website:build [--public] [--no-drive] [--out content/website] [--today YYYY-MM-DD]
 *
 * Reads the artist's tables, inlines the images, writes content/website/index.html.
 * A script, not a prompt, so the same rows always give the same page.
 *   preview (default)  every missing field is a labelled dashed box
 *   --public           missing fields render nothing; what deploy.ts ships
 * Prints the missing fields in page order, each with the command that fills it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openArtist } from "../../../../../data/artist/client";
import { collectSite, type SiteRows } from "./site";
import { renderDocument } from "./render";
import { drivePhotos, inlineImages } from "./images";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string, dflt: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1]! : dflt;
};

const mode = flag("--public") ? "public" : "preview";
const outDir = opt("--out", "content/website");
const today = opt("--today", new Date().toISOString().slice(0, 10));

const artist = await openArtist();
try {
  const [profile, presskit, brand, website] = await Promise.all([
    artist.one("profile"),
    artist.one("presskit", { id: 1 }),
    artist.one("brand", { id: 1 }),
    artist.one("website", { id: 1 }),
  ]);
  const version = presskit?.current_version
    ? await artist.one("presskit_versions", { version: Number(presskit.current_version) })
    : await artist.one("presskit_versions", {}, { orderBy: "version desc", limit: 1 });
  const rows: SiteRows = {
    profile,
    presskit,
    presskit_version: version,
    presskit_items: await artist.query("presskit_items", {}, { orderBy: "sort_order asc", limit: 500 }),
    releases: await artist.query("releases", {}, { orderBy: "release_date desc", limit: 200 }),
    platforms: await artist.query("platforms", {}, { limit: 50 }),
    brand,
    website,
    memory: (await artist.recall("digital-marketing")).map((m) => ({ key: m.key, value: m.value, language: m.language })),
  };

  // Photos: the artist's Drive first (their real photos), then the presskit's URLs.
  let extraPhotos: string[] = [];
  if (!flag("--no-drive")) {
    try {
      const found = await drivePhotos();
      extraPhotos = found ?? [];
      console.log(found ? `Drive: ${found.length} photo(s) in Artist/Photos` : "Drive: not connected — the presskit's photo URLs only (`houselabel connect google`)");
    } catch (e) {
      console.log(`Drive: skipped — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const site = collectSite(rows, { today, extraPhotos });

  console.log("Images:");
  const hero = site.photos[0] ? [site.photos[0]] : [];
  const rest = site.photos.slice(1, 4);
  const covers = site.releases.map((r) => r.cover).filter((c): c is string => !!c);
  const cache = join(".cache", "website");
  const images = {
    ...(await inlineImages(hero, { maxPx: 1600, cacheDir: cache, log: console.log })),
    ...(await inlineImages(rest, { maxPx: 900, cacheDir: cache, log: console.log })),
    ...(await inlineImages(covers, { maxPx: 520, quality: 68, cacheDir: cache, log: console.log })),
  };

  const html = renderDocument(site, { mode, images });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html);
  writeFileSync(join(outDir, "site.json"), JSON.stringify({ ...site, photos: site.photos.length }, null, 2));
  await artist.upsert("website", { id: 1, last_built_at: new Date().toISOString() }, ["id"]);

  console.log(`\n✓ ${join(outDir, "index.html")} — ${Math.round(html.length / 1024)} KB, ${mode}`);
  console.log(`  open it:  open ${join(outDir, "index.html")}`);
  if (site.missing.length) {
    console.log(`\nMissing (${site.missing.length}) — each line names what fills it:`);
    for (const m of site.missing.slice(0, 12)) console.log(`  · ${m.id}  →  ${m.fix}`);
    if (site.missing.length > 12) console.log(`  … ${site.missing.length - 12} more in ${join(outDir, "site.json")}`);
  } else {
    console.log("\nNothing missing. `bun run website:deploy` when the artist has seen it.");
  }
} finally {
  await artist.close();
}
