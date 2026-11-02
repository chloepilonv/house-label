/**
 * The presskit as a printed document: A4 portrait, editorial, one PDF.
 *
 * HTML and CSS printed by Chrome, because slides (`deck.ts`) cannot hold long
 * bios and show lists. Every sentence comes from the artist's rows. Text is
 * never shrunk below 9.5pt: overflow splits onto continuation pages, and the
 * run fails if anything still overflows.
 *
 *   bun run agents/presskit/skills/presskit-build/scripts/print.ts            # the artist's language, to ./content/presskit
 *   bun run agents/presskit/skills/presskit-build/scripts/print.ts --both     # fr + en
 *   bun run agents/presskit/skills/presskit-build/scripts/print.ts --lang fr
 *   bun run agents/presskit/skills/presskit-build/scripts/print.ts --upload --no-push  # links in, nothing replaced
 *   bun run agents/presskit/skills/presskit-build/scripts/print.ts --upload   # + Drive: Artist/Photos link, PDFs replaced in place
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer";
import { openArtist } from "../../../../../data/artist/client";

export type Lang = "fr" | "en";
type Row = Record<string, any>;

const L = {
  fr: {
    kit: "Dossier de presse", tbc: "À compléter", news: "Nouvelle sortie", bio: "Biographie", disco: "Discographie",
    clips: "Clips", awards: "Prix et mentions", tour: "Tournée", press: "Dans la presse", inPress: (name: string) => `${name} dans la presse`,
    photos: "Photos", contact: "Contact", cont: "suite", single: "Single", ep: "EP", album: "Album", mixtape: "Mixtape",
    tracks: (n: number) => `${n} titres`, out: "Sortie le", wasOut: "Paru le", listen: "Écoute privée", listenAll: "Écouter",
    shortFilm: "Court-métrage", battles: "Rap battles", alsoIn: "Également dans", hd: "Télécharger les photos en haute résolution",
    folder: "Dossier de presse complet (Drive)", links: "Liens", allClips: "Voir tous les clips",
    months: ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"],
  },
  en: {
    kit: "Presskit", tbc: "To be completed", news: "New release", bio: "Biography", disco: "Discography",
    clips: "Music videos", awards: "Awards & honours", tour: "Tour", press: "In the press", inPress: (name: string) => `${name} in the press`,
    photos: "Photos", contact: "Contact", cont: "continued", single: "Single", ep: "EP", album: "Album", mixtape: "Mixtape",
    tracks: (n: number) => `${n} tracks`, out: "Out", wasOut: "Out since", listen: "Private listening link", listenAll: "Listen",
    shortFilm: "Short film", battles: "Rap battles", alsoIn: "Also featured in", hd: "Download the photos in high resolution",
    folder: "Full presskit folder (Drive)", links: "Links", allClips: "Watch all the videos",
    months: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  },
} as const;

const esc = (s: unknown): string =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const day = (iso: string) => iso.slice(0, 10);
function longDate(iso: string, lang: Lang): string {
  const [y, m, d] = day(iso).split("-").map(Number) as [number, number, number];
  return lang === "fr" ? `${d} ${L.fr.months[m - 1]} ${y}` : `${L.en.months[m - 1]} ${d}, ${y}`;
}
// A show whose day is not known yet is stored as its year alone, and printed so.
const shortDate = (iso: string) => { const [y, m, d] = day(iso).split("-"); return m && d ? `${d}.${m}.${y}` : y!; };
const PLATFORM: Record<string, string> = {
  website: "Site web", spotify: "Spotify", apple_music: "Apple Music", youtube: "YouTube", instagram: "Instagram",
  tiktok: "TikTok", facebook: "Facebook", bandcamp: "Bandcamp", soundcloud: "SoundCloud", deezer: "Deezer", x: "X", linktree: "Linktree",
};

/** Vocabulary, not prose: the profile stores genres and cities in English. */
const LABELS: Record<Lang, Record<string, string>> = {
  fr: { "folk acoustic": "Folk acoustique", montreal: "Montréal", "quebec city": "Québec" },
  en: { "folk acoustic": "Folk acoustic", montreal: "Montréal" },
};

export interface PrintLinks {
  /** The shared Artist/Photos folder. Required: a presskit without it is incomplete. */
  photosHd?: string | null;
  /** The presskit folder itself. */
  folder?: string | null;
}

export interface PresskitModel {
  lang: Lang;
  name: string;
  descriptor: string;
  shortBio: string | null;
  longBio: string[];
  upcoming: { title: string; kind: string; date: string; tracks: number; tracklist: { title: string; language: string | null }[]; credits: { role: string; names: string }[]; listen: string | null; cover: string | null; out: boolean; smartLink: string | null }[];
  back: { title: string; kind: string; year: string; cover: string | null; url: string | null }[];
  videos: { title: string; url: string; thumb: string | null; subtitle: string | null; featured: boolean }[];
  awards: { year: string; title: string; organization: string | null; detail: string | null }[];
  shows: { date: string; venue: string; city: string | null }[];
  quotes: { text: string; source: string; url: string | null }[];
  clippings: { outlet: string; title: string | null; url: string | null }[];
  /** `place` says which page a photo belongs to; each photo prints once. */
  photos: { url: string; slot: string | null; place: string | null; credit: string | null }[];
  platforms: { platform: string; url: string }[];
  /** Partner logos as the artist's site shows them (presskit memory `partner_logos`). */
  logos: { name: string; url: string }[];
  contactEmail: string | null;
  bookingEmail: string | null;
  brand: Row | null;
  links: PrintLinks;
}

/** A Drive "view" link is a page, not an image; the direct-image form is the same file. */
const imageUrl = (u: string | null | undefined): string | null => {
  if (!u) return null;
  const id = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/)?.[1];
  return id ? `https://lh3.googleusercontent.com/d/${id}` : u;
};
/**
 * A Drive image the artist has not shared publicly still belongs in her own
 * presskit: read it with her Drive connection and inline it. Anything else is
 * returned as is.
 */
async function inlineDrive(u: string | null): Promise<string | null> {
  const id = u?.match(/lh3\.googleusercontent\.com\/d\/([\w-]+)/)?.[1];
  if (!id) return u;
  try {
    const { downloadFile } = await import("../../../../../engine/google/drive");
    const buf = await downloadFile(id);
    const type = buf[0] === 0x89 ? "image/png" : buf[0] === 0x52 ? "image/webp" : "image/jpeg";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return u;
  }
}
/** Release-level studio credits, one line per role group, names as written. */
const ROLE: Record<Lang, Record<string, string>> = {
  fr: { mixing_engineer: "mixage", mastering_engineer: "mastering", producer: "réalisation", recording_engineer: "prise de son", cover_artwork: "pochette", photography: "photo" },
  en: { mixing_engineer: "mixing", mastering_engineer: "mastering", producer: "production", recording_engineer: "recording", cover_artwork: "cover art", photography: "photography" },
};
function creditLines(rows: Row[], lang: Lang): { role: string; names: string }[] {
  const byName = new Map<string, string[]>();
  for (const c of [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    const label = ROLE[lang][c.role]; if (!label) continue;
    byName.set(c.name, [...(byName.get(c.name) ?? []), label]);
  }
  const join = (xs: string[]) => xs.length < 2 ? xs[0]! : `${xs.slice(0, -1).join(", ")} ${lang === "fr" ? "et" : "and"} ${xs.at(-1)}`;
  return [...byName].map(([names, roles]) => {
    const r = join(roles);
    return { role: r.charAt(0).toUpperCase() + r.slice(1), names };
  });
}
const ytId = (url: string) => url.match(/[?&]v=([\w-]{6,})/)?.[1] ?? url.match(/youtu\.be\/([\w-]{6,})/)?.[1] ?? null;
const paras = (s: string | null | undefined) => (s ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/** Everything the document prints, read from the artist's rows. */
export async function loadModel(lang: Lang, links: PrintLinks = {}): Promise<PresskitModel> {
  const artist = await openArtist();
  try {
    const profile = (await artist.one<Row>("profile")) ?? {};
    const presskit = (await artist.one<Row>("presskit")) ?? {};
    const brand = await artist.one<Row>("brand");
    const items = (await artist.query<Row>("presskit_items", { status: "confirmed" }))
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
    const releases = await artist.query<Row>("releases");
    const songs = await artist.query<Row>("songs");
    const credits = await artist.query<Row>("release_credits");
    const platforms = await artist.query<Row>("platforms");
    // English copy lives in the presskit memory; `artist.presskit` holds the
    // French. A language with no bio on file prints `tbc`, never a translation.
    const mem = lang === "fr" ? [] : await artist.recall("presskit", lang);
    const recall = (k: string) => mem.find((m) => m.key === k)?.value ?? null;
    // Past singles the artist chose to show in the discography grid, by title.
    const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
    const allMem = await artist.recall("presskit");
    const picked = allMem.find((m) => m.key === "discography_include")?.value;
    const logos = (() => { try { return JSON.parse(allMem.find((m) => m.key === "partner_logos")?.value ?? "[]") as { name: string; url: string }[]; } catch { return []; } })();
    const include = new Set<string>((() => { try { return (JSON.parse(picked ?? "[]") as string[]).map(norm); } catch { return []; } })());

    const of = (kind: string) => items.filter((i) => i.kind === kind).map((i) => ({ ...i, d: { ...i.data, ...(i.data?.[lang] ?? {}) } }));
    const today = new Date().toISOString().slice(0, 10);
    const dated = releases.filter((r) => r.release_date).map((r) => ({ ...r, date: day(new Date(r.release_date).toISOString()) }));
    const listenIn = (notes: string | null) => notes?.match(/listening:\s*(https?:\/\/\S+)/i)?.[1] ?? null;
    const T = L[lang];
    const kindLabel = (k: string) => (T as any)[k] ?? k;
    // A single out within 90 days before an upcoming release is its lead
    // single and stays in Actualité until the release is out.
    const DAY = 86_400_000;
    const leads = (r: Row) => r.release_type === "single" && r.date < today &&
      dated.some((u) => u.date >= today && u.release_type !== "single" && Date.parse(u.date) - Date.parse(r.date) <= 90 * DAY);
    const upcoming = dated.filter((r) => r.date >= today || leads(r)).sort((a, b) => a.date.localeCompare(b.date));
    // The private listening link is the project's: a single that belongs to an
    // upcoming EP points at the same page.
    const projectListen = upcoming.map((r) => listenIn(r.notes)).find(Boolean) ?? null;
    const genres = (Array.isArray(profile.genres) ? profile.genres : [profile.genres]).filter(Boolean)
      .map((g: string) => LABELS[lang][g.toLowerCase()] ?? g).join(", ");
    const city = profile.city ? LABELS[lang][String(profile.city).toLowerCase()] ?? profile.city : null;

    const model: PresskitModel = {
      lang,
      name: profile.artist_name ?? T.tbc,
      descriptor: [genres, city].filter(Boolean).join(" · "),
      shortBio: lang === "fr" ? presskit.short_bio ?? null : recall("short_bio"),
      longBio: paras(lang === "fr" ? presskit.long_bio : recall("long_bio")),
      upcoming: upcoming.map((r) => ({
        title: r.title, kind: kindLabel(r.release_type), date: r.date,
        tracks: songs.filter((s) => s.release_id === r.id).length,
        // Titles exactly as the artist wrote them — case included.
        credits: creditLines(credits.filter((c) => c.release_id === r.id && !c.song_id), lang),
        tracklist: songs.filter((s) => s.release_id === r.id).map((s) => ({ title: s.title, language: s.language ?? null })),
        listen: listenIn(r.notes) ?? projectListen, cover: imageUrl(r.cover_art_url),
        out: r.date < today, smartLink: r.smart_link_url ?? null,
      })),
      // The back catalogue as bodies of work. Past singles are not presented as
      // singles: the current single is the only one the artist is pushing.
      back: dated.filter((r) => r.date < today && (r.release_type !== "single" || include.has(norm(r.title))))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((r) => ({ title: r.title, kind: kindLabel(r.release_type), year: r.date.slice(0, 4), cover: imageUrl(r.cover_art_url), url: null })),
      videos: of("video").map((v) => {
        const id = ytId(String(v.d.url ?? ""));
        return { title: v.d.title, url: v.d.url, subtitle: v.d.subtitle ?? null, featured: v.d.featured === true, thumb: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null };
      }),
      awards: of("award").map((a) => ({ year: String(a.d.year ?? ""), title: a.d.title, organization: a.d.organization ?? null, detail: a.d.detail ?? null })),
      shows: of("show").map((s) => ({ date: s.d.date, venue: s.d.venue, city: s.d.city ?? null })).filter((s) => s.date)
        .sort((a, b) => b.date.localeCompare(a.date)),
      quotes: of("quote").map((q) => ({ text: q.d.text, source: q.d.source, url: q.d.url ?? null })),
      clippings: of("clipping").map((c) => ({ outlet: c.d.outlet, title: c.d.title ?? null, url: c.d.url ?? null })),
      photos: of("photo").map((p) => ({ url: imageUrl(p.d.url)!, slot: p.slot ?? null, place: p.d.place ?? null, credit: p.d.credit ?? null })),
      platforms: platforms.filter((p) => p.url).sort((a, b) =>
        Object.keys(PLATFORM).indexOf(a.platform) - Object.keys(PLATFORM).indexOf(b.platform))
        .map((p) => ({ platform: p.platform, url: p.url })),
      logos,
      contactEmail: presskit.contact_email ?? null,
      bookingEmail: presskit.booking_email ?? null,
      brand,
      links,
    };
    for (const r of model.upcoming) r.cover = await inlineDrive(r.cover);
    for (const r of model.back) r.cover = await inlineDrive(r.cover);
    for (const p of model.photos) p.url = (await inlineDrive(p.url))!;
    return model;
  } finally {
    await artist.close();
  }
}

/** The display face, inlined: a cross-origin font file will not load into a blank page. */
async function displayFace(brand: Row | null): Promise<string> {
  if (!brand?.font_file_url || brand.font_embed_ok !== true) return "";
  try {
    const res = await fetch(brand.font_file_url);
    if (!res.ok) return "";
    const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    const fmt = /\.otf/i.test(brand.font_file_url) ? "opentype" : /\.woff2/i.test(brand.font_file_url) ? "woff2" : "truetype";
    return `@font-face{font-family:"BrandDisplay";src:url(data:font/${fmt};base64,${b64}) format("${fmt}");font-weight:400;font-style:normal}`;
  } catch {
    return "";
  }
}

export async function toHtml(m: PresskitModel): Promise<string> {
  const T = L[m.lang];
  const b = m.brand ?? {};
  const ink = b.text_color ?? "#1a1613", paper = b.background_color ?? "#ffffff";
  const accent = b.primary_color ?? "#7d2a3d", soft = b.accent_color ?? "#b4707f";
  const display = `"BrandDisplay", "${b.font_display ?? "EB Garamond"}", "EB Garamond", Georgia, serif`;
  const body = `"${b.font_body ?? "Inter"}", "Inter", "Helvetica Neue", Arial, sans-serif`;
  const gfonts = [...new Set([b.font_body ?? "Inter", b.font_display ?? "EB Garamond"])]
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:ital,wght@0,400;0,500;0,600;1,400`).join("&");

  // Each photo prints once. A page gets the next unused photo filed for its
  // place, or none; it never borrows another page's.
  const used = new Set<string>();
  type Photo = PresskitModel["photos"][number];
  const take = (place: string, n = 1): Photo[] => {
    const out = m.photos.filter((p) => !used.has(p.url) && (p.place ?? (p.slot === "hero" ? "cover" : "gallery")) === place).slice(0, n);
    out.forEach((p) => used.add(p.url));
    return out;
  };
  const credit = (p: Photo | undefined) => (p?.credit ? `<span class="credit">© ${esc(p.credit)}</span>` : "");
  const bg = (p: Photo | undefined, cls: string, extra = "") =>
    p ? `<div class="${cls} ph" style="background-image:url('${esc(p.url)}')${extra}">${credit(p)}</div>` : "";
  const img = (p: Photo, cls = "") => `<div class="ph ${cls}"><img src="${esc(p.url)}">${credit(p)}</div>`;
  const [coverP] = take("cover");
  const logoStrip = m.logos.length ? `<div class="logos">${m.logos.map((l) => `<img class="logo" src="${esc(l.url)}" alt="${esc(l.name)}">`).join("")}</div>` : "";
  const tbc = `<p class="tbc">${T.tbc}</p>`;
  const kitWord = T.kit;
  const year = new Date().getFullYear();
  const foot = `<footer><span>${esc(m.name)} — ${esc(kitWord)} ${year}</span><span class="num"></span></footer>`;
  const head = (title: string, extra = "") => `<header><h1 class="title">${esc(title)}</h1>${extra}<div class="rule"></div></header>`;
  const link = (url: string | null | undefined, label: string) => (url ? `<a href="${esc(url)}">${esc(label)}</a>` : esc(label));
  const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

  const pages: string[] = [];

  // ── Cover ───────────────────────────────────────────────────────────────
  pages.push(`<section class="page cover">
    <div class="masthead"><h1 class="title xl">${esc(m.name)}</h1><div class="rule"></div><div class="kit">${esc(kitWord)} ${year}</div></div>
    ${coverP ? bg(coverP, "cover-photo") : `<div class="cover-photo empty">${tbc}</div>`}
    <div class="cover-foot">
      <div class="desc">${esc(m.descriptor)}</div>
      <div class="cover-links">${m.links.photosHd ? `<a href="${esc(m.links.photosHd)}">${esc(T.hd)} →</a>` : `<span class="tbc">${T.hd} : ${T.tbc}</span>`}${m.links.folder ? `<a href="${esc(m.links.folder)}">${esc(T.folder)} →</a>` : ""}</div>
    </div>
      ${logoStrip}
  </section>`);

  // ── New release, only when there is one ─────────────────────────────────
  if (m.upcoming.length) {
    let listenShown = false;
    const cards = m.upcoming.map((r) => `<div class="release block">
        ${r.cover ? `<img class="rcover" src="${esc(r.cover)}">` : ""}
        <div class="rmeta"><div class="kicker">${esc(r.kind)}${r.tracks > 1 ? ` · ${esc(T.tracks(r.tracks))}` : ""}</div>
        <h2 class="rtitle">${esc(r.title)}</h2>
        <div class="rdate">${esc(r.out ? T.wasOut : T.out)} ${esc(longDate(r.date, m.lang))}</div>
        ${r.tracklist.length > 1 ? `<ol class="tracks">${r.tracklist.map((t) => `<li>${esc(t.title)}${t.language ? ` <span class="lang">${esc(t.language.toUpperCase())}</span>` : ""}</li>`).join("")}</ol>` : ""}
        ${r.credits.length ? `<div class="credits">${r.credits.map((c) => `${esc(c.role)}${m.lang === "fr" ? " :" : ":"} ${esc(c.names)}`).join("<br>")}</div>` : ""}
        ${r.out && r.smartLink ? `<div class="rlink"><a href="${esc(r.smartLink)}">${esc(T.listenAll)} →</a></div>`
          : r.listen && !r.out && !listenShown && (listenShown = true) ? `<div class="rlink"><a href="${esc(r.listen)}">${esc(T.listen)} →</a></div>` : ""}</div></div>`).join("");
    pages.push(`<section class="page flow news">${head(T.news)}<div class="content"><div class="flow-items">
      ${(() => { const ps = take("news", 2); return ps.length ? `<div class="block news-photos n${ps.length}">${ps.map((p) => img(p)).join("")}</div>` : ""; })()}
      <div class="block news-lede">${m.shortBio ? paras(m.shortBio).map((p) => `<p>${esc(p)}</p>`).join("") : tbc}</div>
      <div class="block hr"></div>
      ${cards || `<div class="block">${tbc}</div>`}
    </div></div>${foot}</section>`);
  }

  // ── Biographie ──────────────────────────────────────────────────────────
  pages.push(`<section class="page flow bio">${head(T.bio)}<div class="content"><div class="flow-items">
    ${bg(take("bio")[0], "block banner")}
    ${m.longBio.length ? m.longBio.map((p) => `<p class="split">${esc(p)}</p>`).join("") : tbc}
  </div></div>${foot}</section>`);

  // ── Discographie ────────────────────────────────────────────────────────
  {
    const listen = m.platforms.filter((p) => ["spotify", "apple_music", "bandcamp", "youtube"].includes(p.platform));
    const cells = m.back.map((r) => `<figure class="block">${r.cover ? `<img src="${esc(r.cover)}">` : `<div class="nocover"></div>`}
      <figcaption><span class="yr">${esc(r.year)}</span><span class="rt">${esc(r.title)}</span><span class="rk">${esc(r.kind)}</span></figcaption></figure>`).join("");
    const listenCell = listen.length ? `<div class="block listen"><div class="kicker">${esc(T.listenAll)}</div>${listen.map((p) => `<a href="${esc(p.url)}">${esc((p.platform === "website" ? (m.lang === "fr" ? "Site web" : "Website") : PLATFORM[p.platform] ?? p.platform))}</a>`).join("")}</div>` : "";
    pages.push(`<section class="page flow disco">${head(T.disco)}<div class="content"><div class="flow-items grid3">
      ${cells || tbc}${listenCell}</div></div>${foot}</section>`);
  }

  // ── Clips ───────────────────────────────────────────────────────────────
  {
    const battles = m.videos.filter((v) => /\bvs\b/i.test(v.title));
    // The artist picks the lead videos (`data.featured`); the rest follow in her order.
    const lead = m.videos.filter((v) => v.featured && !battles.includes(v));
    const clips = m.videos.filter((v) => !battles.includes(v) && !lead.includes(v));
    const yt = m.platforms.find((p) => p.platform === "youtube")?.url;
    const card = (v: PresskitModel["videos"][number], big = false) => `<a class="clip block${big ? " big" : ""}" href="${esc(v.url)}">
      ${v.thumb ? `<div class="thumb" style="background-image:url('${esc(v.thumb)}')"></div>` : ""}
      <div class="ctitle">${esc(v.title)}</div>${v.subtitle ? `<div class="csub">${esc(v.subtitle)}</div>` : ""}</a>`;
    pages.push(`<section class="page flow clips">${head(T.clips, yt ? `<a class="headlink" href="${esc(yt)}">${esc(T.allClips)}</a>` : "")}<div class="content"><div class="flow-items grid2">
      ${m.videos.length ? [...lead.map((v) => card(v, true)), ...clips.map((v) => card(v))].join("") : tbc}
      ${battles.length ? `<div class="block battles"><div class="kicker">${esc(T.battles)}</div>${battles.map((v) => `<a href="${esc(v.url)}">${esc(v.title)}</a>`).join("")}</div>` : ""}
    </div></div>${foot}</section>`);
  }

  // ── Prix et mentions, over a full-bleed stage photo ────────────────────
  const awardsP = take("awards")[0];
  pages.push(`<section class="page flow dark awards"${awardsP ? ` style="background-image:linear-gradient(rgba(10,8,8,.62),rgba(10,8,8,.78)),url('${esc(awardsP.url)}')"` : ""}>${awardsP?.credit ? `<span class="credit page-credit">© ${esc(awardsP.credit)}</span>` : ""}${head(T.awards)}<div class="content"><div class="flow-items">
    ${m.awards.length ? m.awards.map((a) => `<div class="award block"><div class="ay">${esc([a.organization, a.year].filter(Boolean).join(" "))}</div>
      <div class="at">${esc(a.title)}</div>${a.detail ? `<div class="ad">${esc(a.detail)}</div>` : ""}</div>`).join("") : tbc}
  </div></div>${foot}</section>`);

  // ── Tournée: every date, grouped by year ───────────────────────────────
  {
    const years = [...new Set(m.shows.map((s) => s.date.slice(0, 4)))];
    const groups = years.map((y) => `<div class="group block" data-head="${esc(y)}"><h3 class="gy">${esc(y)}</h3>
      ${m.shows.filter((s) => s.date.startsWith(y)).map((s) => `<div class="show"><span class="sd">${esc(shortDate(s.date))}</span> <b>${esc(s.venue)}</b>${s.city ? `, <i>${esc(s.city)}</i>` : ""}</div>`).join("")}</div>`).join("");
    const tourP = take("tour")[0];
    pages.push(`<section class="page flow tour">${head(T.tour)}<div class="content"><div class="flow-items cols">${groups || tbc}${tourP ? `<div class="block tour-photo">${img(tourP)}</div>` : ""}</div></div>${foot}</section>`);
  }

  // ── Dans la presse: opener, then quotes and every mention ───────────────
  const pressP = take("press")[0];
  pages.push(`<section class="page opener"${pressP ? ` style="background-image:linear-gradient(rgba(0,0,0,.05),rgba(0,0,0,.45)),url('${esc(pressP.url)}')"` : ""}>${pressP?.credit ? `<span class="credit page-credit">© ${esc(pressP.credit)}</span>` : ""}
    <div class="opener-title"><h1 class="title xl light">${esc(T.inPress(m.name))}</h1><div class="rule light"></div></div></section>`);
  pages.push(`<section class="page flow press">${head(T.press)}<div class="content"><div class="flow-items">
    ${m.quotes.map((q) => `<blockquote class="block"><p>« ${esc(q.text)} »</p><cite>${link(q.url, q.source)}</cite></blockquote>`).join("")}
    ${m.clippings.length ? `<div class="group block mentions" data-head="${esc(T.alsoIn)}"><h3 class="kicker">${esc(T.alsoIn)}</h3>${m.clippings.map((c) => `<div class="mention"><b>${link(c.url, c.outlet)}</b>${c.title ? ` — ${esc(c.title)}` : ""}</div>`).join("")}</div>` : ""}
    ${!m.quotes.length && !m.clippings.length ? tbc : ""}
  </div></div>${foot}</section>`);

  // ── Photos ──────────────────────────────────────────────────────────────
  pages.push(`<section class="page flow photos">${head(T.photos)}<div class="content"><div class="flow-items">
    <div class="block hd">${m.links.photosHd ? `<a href="${esc(m.links.photosHd)}">${esc(T.hd)} →</a><div class="url">${esc(m.links.photosHd)}</div>` : `<span class="tbc">${esc(T.hd)} : ${T.tbc}</span>`}</div>
    ${(() => { const ps = take("gallery", 6); return ps.length ? `<div class="block pgrid n${ps.length}">${ps.map((p) => img(p)).join("")}</div>` : ""; })()}
  </div></div>${foot}</section>`);

  // ── Contact & liens ─────────────────────────────────────────────────────
  {
    const mails = [[m.lang === "fr" ? "Presse" : "Press", m.contactEmail], ["Booking", m.bookingEmail]].filter(([, v]) => v) as [string, string][];
    pages.push(`<section class="page flow contact">${head(T.contact)}<div class="content"><div class="flow-items">
      <div class="block">${mails.length ? mails.map(([k, v]) => `<p><span class="kicker">${k}</span><br><a href="mailto:${esc(v)}">${esc(v)}</a></p>`).join("") : tbc}</div>
      <div class="block linkset"><div class="kicker">${esc(T.links)}</div>${m.platforms.map((p) => `<div><span class="pl">${esc((p.platform === "website" ? (m.lang === "fr" ? "Site web" : "Website") : PLATFORM[p.platform] ?? p.platform))}</span> <a href="${esc(p.url)}">${esc(host(p.url) + new URL(p.url).pathname.replace(/\/$/, ""))}</a></div>`).join("")}</div>
      <div class="block linkset"><div class="kicker">${esc(T.photos)}</div>
        ${m.links.photosHd ? `<div><a href="${esc(m.links.photosHd)}">${esc(T.hd)}</a></div>` : `<div class="tbc">${T.tbc}</div>`}
        ${m.links.folder ? `<div><a href="${esc(m.links.folder)}">${esc(T.folder)}</a></div>` : ""}</div>
      ${logoStrip ? `<div class="block contact-logos">${logoStrip}</div>` : ""}
    </div></div>${foot}</section>`);
  }

  const css = `
  ${await displayFace(m.brand)}
  @page{size:A4;margin:0}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:${paper};color:${ink};font-family:${body};font-size:10pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  a{color:${accent};text-decoration:none;border-bottom:.5pt solid ${soft}}
  .page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;break-after:page;padding:14mm 16mm 0;display:flex;flex-direction:column;background-size:cover;background-position:center}
  header{flex:none}
  .title{font-family:${display};font-style:italic;font-weight:400;text-transform:uppercase;font-size:50pt;line-height:1;margin:0;letter-spacing:.5pt;color:${ink}}
  .title.xl{font-size:64pt;letter-spacing:1pt}
  .title.light,.dark .title{color:#fff}
  .cont .title{font-size:34pt}
  .rule{border-top:.6pt solid ${ink};margin:3mm 0 6mm}
  .rule.light,.dark .rule{border-color:rgba(255,255,255,.85)}
  .headlink{position:absolute;right:16mm;top:24mm;font-size:9.5pt;text-transform:uppercase;letter-spacing:1pt}
  .content{flex:1;min-height:0;overflow:hidden;position:relative}
  .flow-items{height:100%}
  footer{flex:none;height:13mm;display:flex;justify-content:space-between;align-items:center;font-size:9.5pt;color:#8c8175;letter-spacing:.6pt;border-top:.4pt solid rgba(26,22,19,.15)}
  .dark footer{color:rgba(255,255,255,.75);border-color:rgba(255,255,255,.3)}
  p{margin:0 0 3.2mm;text-align:justify;hyphens:auto}
  .tbc{color:#8c8175;font-style:italic;font-family:${display};font-size:13pt}
  .kicker{font-size:9.5pt;text-transform:uppercase;letter-spacing:1.4pt;color:${accent};font-weight:600}
  .dark .kicker{color:#f0c3ce}
  /* cover */
  .cover{padding-bottom:12mm}
  .masthead{text-align:center}
  .masthead .rule{margin:2mm 0 2mm}
  .masthead .kit{text-align:right;font-size:13pt;text-transform:uppercase;letter-spacing:1.2pt;font-weight:500}
  .cover-photo{flex:1;margin:6mm 0 5mm;background-size:cover;background-position:center 30%}
  .cover-foot{display:flex;justify-content:space-between;align-items:flex-end;gap:8mm}
  .desc{font-family:${display};font-style:italic;font-size:15pt;text-transform:uppercase;letter-spacing:.6pt}
  .logos{display:flex;align-items:center;justify-content:space-between;gap:4mm;margin-top:5mm;height:9mm;overflow:hidden}
  .logo{height:7mm;max-width:26mm;min-width:0;flex:0 1 auto;width:auto;object-fit:contain;filter:grayscale(1);opacity:.85}
  .contact-logos{margin-top:12mm;padding-top:5mm;border-top:.4pt solid rgba(26,22,19,.15)}
  .cover-links{display:flex;flex-direction:column;align-items:flex-end;gap:1.5mm;font-size:9.5pt;text-align:right}
  /* news */
  .news-photos{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-bottom:5mm}
  .news-photos.n1{grid-template-columns:1fr}
  .news-photos .ph{height:52mm}
  .news-lede{font-size:10.5pt}
  .news-lede{font-size:10.5pt}
  .hr{border-top:.6pt solid ${ink};margin:2mm 0 7mm}
  .release{display:flex;gap:7mm;margin-bottom:7mm;align-items:center}
  .rcover{width:52mm;height:52mm;object-fit:cover}
  .rtitle{font-family:${display};font-style:italic;font-weight:400;font-size:30pt;line-height:1.05;margin:1mm 0 2mm;text-transform:none}
  .rdate{font-size:11pt;font-weight:500}
  .tracks{margin:2mm 0 0;padding-left:5mm;font-size:10.5pt;line-height:1.45}
  .lang{font-size:9.5pt;color:#8c8175;letter-spacing:.8pt}
  .credits{margin-top:2mm;font-size:9.5pt;color:#8c8175}
  .rlink{margin-top:2mm;font-size:10.5pt;font-weight:600}
  /* bio */
  .banner{height:40mm;background-size:cover;background-position:center 18%;margin-bottom:6mm}
  /* disco */
  .grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7mm 6mm;align-content:start}
  .grid3 figure{margin:0}
  .grid3 img,.nocover{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#f0c3ce}
  figcaption{margin-top:2mm;display:flex;flex-direction:column}
  .yr{font-family:${display};font-style:italic;font-size:14pt;line-height:1.1}
  .rt{font-size:10.5pt;text-transform:uppercase;font-weight:500;line-height:1.25}
  .rk{font-size:9.5pt;color:#8c8175}
  .listen{display:flex;flex-direction:column;justify-content:center;gap:2mm;font-size:11pt;padding:4mm;border:.6pt solid ${ink};aspect-ratio:1}
  /* clips */
  .grid2{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5mm 6mm;align-content:start}
  .clip{border:none;color:${ink};display:block}
  .grid2>*{grid-column:span 2}
  .grid2>.clip.big{grid-column:span 3}
  .thumb{width:100%;aspect-ratio:16/9;background-size:cover;background-position:center}
  .ctitle{margin-top:1.5mm;font-size:9.5pt;text-transform:uppercase;font-weight:600;line-height:1.25}
  .clip.big .ctitle{font-family:${display};font-style:italic;font-weight:400;font-size:18pt;text-transform:none;line-height:1.15}
  .csub{font-size:9.5pt;color:#8c8175}
  .battles{display:flex;flex-direction:column;gap:2mm;font-size:9.5pt;line-height:1.3;padding-top:1mm}
  /* awards */
  .dark{color:#fff}
  .dark a{color:#fff}
  .award{margin-bottom:3.6mm;max-width:150mm}
  .ay{font-family:${display};font-style:italic;font-size:15pt;text-transform:uppercase;letter-spacing:.5pt;line-height:1.15}
  .at{font-size:11pt;font-weight:600}
  .ad{font-size:10pt;opacity:.9;line-height:1.35}
  /* tour */
  .cols{column-count:2;column-gap:9mm;column-fill:auto}
  .group{break-inside:auto}
  .gy{font-family:${display};font-style:italic;font-weight:400;font-size:22pt;margin:0 0 1.5mm;line-height:1;break-after:avoid}
  .show{font-size:9.5pt;line-height:1.38;margin-bottom:1.6mm;break-inside:avoid}
  .sd{font-family:${display};font-style:italic;font-size:10.5pt;color:${accent}}
  .group+.group{margin-top:4mm}
  /* press */
  .opener{padding:0;justify-content:flex-end}
  .opener-title{padding:0 14mm 34mm}
  blockquote{margin:0 0 6mm;padding-left:5mm;border-left:1.2pt solid ${accent}}
  blockquote p{font-family:${display};font-style:italic;font-size:17pt;line-height:1.25;text-align:left;margin-bottom:1.5mm}
  cite{font-style:normal;font-size:9.5pt;text-transform:uppercase;letter-spacing:1pt}
  .mentions{column-count:2;column-gap:8mm;margin-top:4mm}
  .mentions .kicker{column-span:all;margin:0 0 3mm}
  .mention{font-size:9.5pt;line-height:1.35;margin-bottom:1.6mm;break-inside:avoid}
  .mention a{border:none}
  /* photos */
  .hd{font-size:13pt;font-weight:600;margin-bottom:6mm}
  .hd .url{font-size:9.5pt;font-weight:400;color:#8c8175;word-break:break-all;margin-top:1mm}
  .pgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm}
  .pgrid .ph{height:88mm}
  .pgrid.n5 .ph:first-child{grid-row:span 2;height:180mm}
  .ph{position:relative;overflow:hidden;background-size:cover;background-position:center 25%}
  .ph img{width:100%;height:100%;object-fit:cover;display:block}
  .credit{position:absolute;right:2mm;bottom:1.5mm;font-size:7pt;letter-spacing:.3pt;color:#fff;text-shadow:0 0 2px rgba(0,0,0,.8);font-weight:500;line-height:1}
  .page-credit{position:absolute;right:16mm;bottom:15mm;z-index:2}
  .opener .page-credit{bottom:6mm}
  .tour-photo{break-inside:avoid;margin-top:5mm}
  .tour-photo .ph{height:95mm}
  /* contact */
  .linkset{margin-top:8mm;font-size:10.5pt;line-height:1.7}
  .pl{display:inline-block;width:36mm;color:#8c8175;font-size:9.5pt;text-transform:uppercase;letter-spacing:1pt}
  `;

  return `<!doctype html><html lang="${m.lang}"><head><meta charset="utf-8">
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?${gfonts}&display=block" rel="stylesheet">
    <style>${css}</style></head><body>${pages.join("\n")}</body></html>`;
}

/**
 * Runs inside Chrome. Splits overflowing pages, numbers them, then measures.
 * Returns the problems it could not fix — the caller fails on any.
 */
function paginateAndMeasure(contLabel: string): string[] {
  const over = (el: Element) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
  const problems: string[] = [];
  const pages = () => [...document.querySelectorAll<HTMLElement>(".page")];

  for (const start of [...document.querySelectorAll<HTMLElement>(".page.flow")]) {
    let cur = start;
    for (let guard = 0; guard < 30; guard++) {
      const box = cur.querySelector<HTMLElement>(".content")!;
      const flow = cur.querySelector<HTMLElement>(".flow-items")!;
      if (!over(box) && !over(flow)) break;
      const next = cur.cloneNode(true) as HTMLElement;
      next.classList.add("cont");
      const title = next.querySelector(".title");
      if (title && !title.textContent!.includes(`(${contLabel})`)) title.textContent = `${title.textContent} (${contLabel})`;
      next.querySelector(".headlink")?.remove();
      const nflow = next.querySelector<HTMLElement>(".flow-items")!;
      nflow.innerHTML = "";
      cur.after(next);
      const fits = () => !over(box) && !over(flow);
      while (!fits() && flow.children.length > 1) nflow.prepend(flow.lastElementChild!);
      if (!fits()) {
        const last = flow.lastElementChild as HTMLElement | null;
        if (last && last.tagName === "P") {
          // A paragraph that does not fit is split at a sentence, never cut.
          const sentences = last.textContent!.split(/(?<=[.!?»])\s+/);
          const moved: string[] = [];
          while (!fits() && sentences.length > 1) { moved.unshift(sentences.pop()!); last.textContent = sentences.join(" "); }
          if (moved.length) { const p = last.cloneNode() as HTMLElement; p.textContent = moved.join(" "); nflow.prepend(p); }
        } else if (last && last.classList.contains("group")) {
          // A list group splits at an entry, and the continuation keeps its heading.
          const clone = last.cloneNode(false) as HTMLElement;
          const h = last.firstElementChild!.cloneNode(true) as HTMLElement;
          clone.append(h);
          while (!fits() && last.children.length > 2) clone.insertBefore(last.lastElementChild!, h.nextSibling);
          if (clone.children.length > 1) nflow.prepend(clone);
        }
      }
      if (!fits()) { problems.push(`page "${cur.querySelector(".title")?.textContent}" still overflows after splitting`); break; }
      if (!nflow.children.length) { next.remove(); break; }
      cur = next;
    }
  }

  const all = pages();
  all.forEach((p, i) => p.querySelectorAll(".num").forEach((n) => (n.textContent = String(i + 1).padStart(2, "0"))));

  // Measure: every box fits, every text node sits inside its page, nothing under 9.5pt.
  all.forEach((p, i) => {
    const pr = p.getBoundingClientRect();
    for (const box of p.querySelectorAll(".content, .flow-items")) if (over(box)) problems.push(`page ${i + 1}: content box overflows`);
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent!.trim()) continue;
      const el = n.parentElement!;
      const range = document.createRange(); range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (r.width === 0) continue;
        if (r.left < pr.left - 0.5 || r.right > pr.right + 0.5 || r.top < pr.top - 0.5 || r.bottom > pr.bottom + 0.5)
          { problems.push(`page ${i + 1}: text outside the page — "${n.textContent!.trim().slice(0, 40)}"`); break; }
        const box = el.closest(".content");
        if (box) { const b = box.getBoundingClientRect(); if (r.bottom > b.bottom + 0.5 || r.right > b.right + 0.5) { problems.push(`page ${i + 1}: text cut at the content edge — "${n.textContent!.trim().slice(0, 40)}"`); break; } }
      }
      const size = parseFloat(getComputedStyle(el).fontSize) * 0.75;
      // Photo credits are captions, not reading text: the 9.5pt floor is for prose.
      if (size < 9.49 && !el.closest(".credit")) problems.push(`page ${i + 1}: ${size.toFixed(1)}pt text — "${n.textContent!.trim().slice(0, 30)}"`);
    }
    for (const img of p.querySelectorAll("img")) if (!(img as HTMLImageElement).naturalWidth) problems.push(`page ${i + 1}: image did not load ${(img as HTMLImageElement).src.slice(0, 80)}`);
  });
  return [...new Set(problems)];
}

/**
 * Every remote image, fetched once and inlined. Two reasons: Chrome cannot
 * resample a cross-origin image on a canvas (it is "tainted"), and a page must
 * not depend on a third-party host being up at print time.
 */
async function inlineImages(html: string): Promise<string> {
  const urls = new Set<string>();
  for (const m of html.matchAll(/(?:src="|url\(')(https?:\/\/[^"')]+)/g)) urls.add(m[1]!.replace(/&amp;/g, "&"));
  const map = new Map<string, string>();
  await Promise.all([...urls].map(async (u) => {
    try {
      const res = await fetch(u, { redirect: "follow" });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) return;
      map.set(u, `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`);
    } catch { /* left remote; the measure step reports it if it fails to load */ }
  }));
  return html.replace(/(src="|url\(')(https?:\/\/[^"')]+)/g, (all, pre: string, u: string) => {
    const d = map.get(u.replace(/&amp;/g, "&"));
    return d ? `${pre}${d}` : all;
  });
}

/**
 * Runs inside Chrome. Every image is cropped and resampled to the box it fills,
 * at ~240 dpi, and re-encoded as JPEG. Chrome embeds cropped images losslessly,
 * which makes PDFs too large for Drive's viewer.
 */
async function optimizeImages(): Promise<number> {
  const SCALE = 2.5, Q = 0.85;
  const load = (src: string) => new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
  const pct = (v: string, fallback = 0.5) => { const n = parseFloat(v); return v.trim().endsWith("%") && Number.isFinite(n) ? n / 100 : fallback; };
  const draw = (img: HTMLImageElement, w: number, h: number, px: number, py: number, filter: string) => {
    const cw = Math.max(1, Math.round(w * SCALE)), ch = Math.max(1, Math.round(h * SCALE));
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight); // cover
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    const c = document.createElement("canvas"); c.width = cw; c.height = ch;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch);
    if (filter && filter !== "none") ctx.filter = filter;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (cw - dw) * px, (ch - dh) * py, dw, dh);
    return c.toDataURL("image/jpeg", Q);
  };
  let n = 0;
  for (const el of [...document.querySelectorAll<HTMLImageElement>("img")]) {
    // Logos keep their transparency and proportions: drawn as-is, not cropped.
    // Some are drawn white for a dark footer; on paper they vanish, so a logo
    // whose opaque pixels are mostly light is inverted to dark.
    if (el.classList.contains("logo")) {
      const i = await load(el.src); const c = document.createElement("canvas");
      c.width = Math.min(200, i.naturalWidth); c.height = Math.max(1, Math.round(c.width * i.naturalHeight / i.naturalWidth));
      const x = c.getContext("2d")!; x.drawImage(i, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height).data; let sum = 0, cnt = 0;
      for (let k = 0; k < d.length; k += 4) if (d[k + 3]! > 128) { sum += (0.2126 * d[k]! + 0.7152 * d[k + 1]! + 0.0722 * d[k + 2]!) / 255; cnt++; }
      if (cnt && sum / cnt > 0.7 && d.some((_, k) => k % 4 === 3 && d[k]! < 128)) el.style.filter = "invert(1) grayscale(1)";
      continue;
    }
    const r = el.getBoundingClientRect(); if (!r.width || !el.src.startsWith("data:")) continue;
    const cs = getComputedStyle(el); const [px, py] = cs.objectPosition.split(" ");
    el.src = draw(await load(el.src), r.width, r.height, pct(px ?? "50%"), pct(py ?? "50%"), cs.filter);
    el.style.objectFit = "fill"; el.style.filter = "none"; n++;
  }
  for (const el of [...document.querySelectorAll<HTMLElement>("[style*='background-image']")]) {
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    const m = cs.backgroundImage.match(/url\("(data:[^"]+)"\)/); if (!m || !r.width) continue;
    const layers = cs.backgroundPosition.split(",").map((s) => s.trim());
    const last = (layers[layers.length - 1] ?? "50% 50%").split(" ");
    const jpg = draw(await load(m[1]!), r.width, r.height, pct(last[0] ?? "50%"), pct(last[1] ?? "50%"), "none");
    el.style.backgroundImage = cs.backgroundImage.replace(m[0], `url("${jpg}")`);
    el.style.backgroundSize = "100% 100%"; el.style.backgroundPosition = "0 0"; n++;
  }
  return n;
}

export async function renderPdf(m: PresskitModel, outPath: string): Promise<{ path: string; pages: number; problems: string[] }> {
  const html = await inlineImages(await toHtml(m));
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"], protocolTimeout: 900_000 });
  try {
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 120_000 });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.evaluate(optimizeImages);
    const problems = await page.evaluate(paginateAndMeasure, L[m.lang].cont);
    const pages = await page.evaluate(() => document.querySelectorAll(".page").length);
    await Bun.write(outPath.replace(/\.pdf$/, ".html"), await page.content());
    await page.pdf({ path: outPath, format: "A4", printBackground: true, preferCSSPageSize: true });
    return { path: outPath, pages, problems };
  } finally {
    await browser.close();
  }
}

/**
 * Drive: the photos link is the whole `Artist/Photos` workspace folder
 * (`artist/photos` in engine/google/workspace.ts). Read-only: it shares, it
 * never creates or uploads.
 */
async function photoLinks(): Promise<PrintLinks & { presskitId: string }> {
  const { ensureArtistBranch, currentArtistName } = await import("../../../../../engine/google/workspace");
  const { shareFolder } = await import("../../../../../engine/google/drive");
  const branch = await ensureArtistBranch(await currentArtistName());
  if (!branch) throw new Error("Google Drive is not connected — run `houselabel connect google`.");
  return { presskitId: branch.presskitId, photosHd: await shareFolder(branch.photosId), folder: await shareFolder(branch.presskitId) };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  // One language — the artist's own (artist.profile.preferred_locale) —
  // unless --lang picks one or --both asks for the pair.
  const preferred = await (async () => {
    const a = await openArtist();
    try { return ((await a.one<Row>("profile"))?.preferred_locale === "fr" ? "fr" : "en") as Lang; } finally { await a.close(); }
  })();
  const langs: Lang[] = flag("--lang") ? [flag("--lang") as Lang] : args.includes("--both") ? ["fr", "en"] : [preferred];
  const outDir = flag("--out") ?? join(process.cwd(), "content", "presskit");
  const upload = args.includes("--upload");
  // `--upload --no-push`: resolve the Drive links into the PDF, then stop, so
  // every page can be looked at before anything is replaced.
  const push = upload && !args.includes("--no-push");
  mkdirSync(outDir, { recursive: true });

  let links: PrintLinks & { presskitId?: string } = {};
  if (upload) {
    links = await photoLinks();
    console.log(`photos HD  ${links.photosHd}\npresskit   ${links.folder}`);
  }
  let failed = false;
  for (const lang of langs) {
    const m = await loadModel(lang, links);
    const name = lang === "fr" ? `${m.name} — Dossier de presse ${new Date().getFullYear()}` : `${m.name} — Presskit ${new Date().getFullYear()}`;
    const r = await renderPdf(m, join(outDir, `${name}.pdf`));
    console.log(`${lang}  ${r.pages} pages  ${r.path}`);
    for (const p of r.problems) console.log(`   ✗ ${p}`);
    if (r.problems.length) { failed = true; continue; }
    if (push && links.presskitId) {
      const { uploadBinary, listFolder, replaceFileContent } = await import("../../../../../engine/google/drive");
      // Same name already there: replace its bytes, keep its id and link.
      const body = Buffer.from(await Bun.file(r.path).arrayBuffer());
      const existing = (await listFolder(links.presskitId)).find((f) => f.name === `${name}.pdf`);
      const up = existing
        ? await replaceFileContent(existing.id, body, "application/pdf")
        : await uploadBinary({ name: `${name}.pdf`, mimeType: "application/pdf", body, folderId: links.presskitId });
      console.log(`   → ${up.url}`);
    }
  }
  if (failed) process.exit(1);
}
