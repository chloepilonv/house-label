/**
 * The release's "Useful links" sheet and one lyrics Doc per song, built from
 * the artist database. Both are add-only: the artist edits them by hand.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { listFolder, uploadAsGoogleDoc } from "./drive";
import { appendRows, ensureSpreadsheet, readTab } from "./sheets";

export type Lang = "en" | "fr";

const WORDS = {
  en: {
    sheet: "Useful links", tab: "Links", headers: ["Category", "What", "Link"],
    smart: "Smart link", listen: "Listen", video: "Video", press: "Press", other: "Other",
    platforms: "Platforms", socials: "Socials", codes: "Codes", lyrics: "lyrics",
  },
  fr: {
    sheet: "Liens utiles", tab: "Liens", headers: ["Catégorie", "Quoi", "Lien"],
    smart: "Smart link", listen: "Écoute", video: "Vidéo", press: "Presse", other: "Autre",
    platforms: "Plateformes", socials: "Réseaux", codes: "Identifiants", lyrics: "paroles",
  },
} as const;

/** Profile pages that are streaming stores; everything else is a social. */
const STORES = new Set(["spotify", "apple_music", "deezer", "bandcamp", "soundcloud"]);
const PLATFORM_NAME: Record<string, string> = {
  spotify: "Spotify", apple_music: "Apple Music", deezer: "Deezer", bandcamp: "Bandcamp",
  soundcloud: "SoundCloud", youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok",
  facebook: "Facebook", x: "X", linktree: "Linktree", website: "Website",
};

export interface LinksInput {
  release: { title: string; smart_link_url?: string | null; upc?: string | null };
  links: { category: string; label: string; url: string }[];
  platforms: { platform: string; url: string }[];
  songs: { title: string; isrc?: string | null }[];
}

export const linksSheetName = (title: string, lang: Lang) => `${WORDS[lang].sheet} — ${title}`;
export const lyricsDocName = (song: string, lang: Lang) => `${song} — ${WORDS[lang].lyrics}`;

/** The sheet's rows, in reading order: release first, then where the artist lives, then the codes. Pure. */
export function linkRows(i: LinksInput, lang: Lang): string[][] {
  const w = WORDS[lang];
  const rows: string[][] = [];
  if (i.release.smart_link_url) rows.push([w.smart, i.release.title, i.release.smart_link_url]);
  for (const l of i.links)
    rows.push([w[l.category as "listen" | "video" | "press" | "other"] ?? w.other, l.label, l.url]);
  const plat = [...i.platforms].sort((a, b) => Number(STORES.has(b.platform)) - Number(STORES.has(a.platform)));
  for (const p of plat)
    rows.push([STORES.has(p.platform) ? w.platforms : w.socials, PLATFORM_NAME[p.platform] ?? p.platform, p.url]);
  if (i.release.upc) rows.push([w.codes, `UPC — ${i.release.title}`, i.release.upc]);
  for (const s of i.songs) if (s.isrc) rows.push([w.codes, `ISRC — ${s.title}`, s.isrc]);
  return rows;
}

/** Rows whose link is not already in the sheet. Pure. */
export function newRows(existing: string[][], rows: string[][]): string[][] {
  const have = new Set(existing.slice(1).map((r) => (r[2] ?? "").trim()));
  return rows.filter((r) => !have.has(r[2]!.trim()));
}

export async function ensureLinksSheet(
  releaseFolderId: string,
  input: LinksInput,
  lang: Lang,
): Promise<{ url: string; added: number }> {
  const w = WORDS[lang];
  const rows = linkRows(input, lang);
  const sheet = await ensureSpreadsheet({
    folderId: releaseFolderId,
    name: linksSheetName(input.release.title, lang),
    tabs: [{ title: w.tab, headers: [...w.headers], rows }],
  });
  if (sheet.created) return { url: sheet.url, added: rows.length };
  const add = newRows(await readTab(sheet.id, w.tab), rows);
  await appendRows(sheet.id, w.tab, add);
  return { url: sheet.url, added: add.length };
}

/** One Google Doc per song that has lyrics, created when absent, never replaced. */
export async function ensureLyricsDocs(
  lyricsFolderId: string,
  songs: { title: string; lyrics?: string | null }[],
  lang: Lang,
): Promise<number> {
  const withWords = songs.filter((s) => s.lyrics?.trim());
  if (!withWords.length) return 0;
  const have = new Set((await listFolder(lyricsFolderId)).map((f) => f.name));
  let made = 0;
  for (const s of withWords) {
    const name = lyricsDocName(s.title, lang);
    if (have.has(name)) continue;
    await uploadAsGoogleDoc({
      name,
      body: `${s.title}\n\n${s.lyrics!.trim()}\n`,
      sourceMime: "text/plain",
      folderId: lyricsFolderId,
      share: false,
    });
    made++;
  }
  return made;
}
