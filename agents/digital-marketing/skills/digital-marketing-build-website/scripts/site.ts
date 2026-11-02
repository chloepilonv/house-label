/**
 * The site object: rows in, one `Site` out. The only file that decides what goes
 * where on the page; pure, so render.test.ts pins every rule. Nothing is invented:
 * a field the rows lack becomes an entry in `missing`.
 */

export type Locale = "en" | "fr";
export type Row = Record<string, unknown>;

export interface SiteRows {
  profile: Row | null;
  presskit: Row | null;
  presskit_items: Row[];
  presskit_version: Row | null;
  releases: Row[];
  platforms: Row[];
  brand: Row | null;
  website: Row | null;
  /** `artist.memory` rows for this department: key `website.bio` per language. */
  memory: { key: string; value: string; language: string }[];
}

export interface SiteRelease {
  title: string;
  type: string;
  date: string | null;
  year: string | null;
  cover: string | null;
  link: string | null;
  upcoming: boolean;
}
export interface SiteShow {
  date: string | null;
  venue: string;
  city: string | null;
}
export interface Missing {
  id: string;
  fix: string;
}
export interface Site {
  name: string;
  locale: Locale;
  city: string | null;
  region: string | null;
  genres: string[];
  markets: string[];
  roles: { en: string; fr: string }[];
  hero: {
    release: SiteRelease | null;
    presave: string | null;
    listen: { title: string; url: string } | null;
  };
  releases: SiteRelease[];
  shows: {
    upcoming: SiteShow[];
    past: SiteShow[];
    widget: string | null;
    cities: string[];
  };
  bio: {
    lead: Partial<Record<Locale, string>>;
    text: Partial<Record<Locale, string>>;
  };
  photos: string[];
  press: {
    quotes: { text: string; source: string; url: string | null }[];
    clippings: { title: string; outlet: string | null; url: string | null }[];
    awards: { title: string; organization: string | null; year: string | null }[];
  };
  store: { url: string | null; bandcamp: string | null };
  contact: {
    team: { role: string; name: string | null; email: string | null }[];
    presskit: string | null;
    newsletter: string | null;
    sms: string | null;
    emails: { contact: string | null; booking: string | null };
    socials: { platform: string; label: string; url: string }[];
  };
  theme: Theme;
  sections: Record<string, boolean>;
  missing: Missing[];
}
export interface Theme {
  background: string;
  text: string;
  accent: string;
  fontDisplay: string;
  fontBody: string;
  fontSource: "google" | "derived" | "uploaded";
}

const DEFAULT_THEME: Theme = {
  background: "#0B0A09",
  text: "#F1EADF",
  accent: "#D9B65C",
  fontDisplay: "Bricolage Grotesque",
  fontBody: "Instrument Sans",
  fontSource: "google",
};

const SOCIAL_LABEL: Record<string, string> = {
  spotify: "Spotify",
  apple_music: "Apple Music",
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  soundcloud: "SoundCloud",
  bandcamp: "Bandcamp",
  facebook: "Facebook",
  x: "X",
  deezer: "Deezer",
  linktree: "Linktree",
};

const ROLE: Record<string, { en: string; fr: string }> = {
  songwriter: { en: "Songwriting", fr: "Écriture" },
  performer: { en: "Performance", fr: "Scène" },
  producer: { en: "Production", fr: "Réalisation" },
  composer: { en: "Composition", fr: "Composition" },
};

const TYPE_LABEL: Record<string, string> = {
  single: "Single",
  ep: "EP",
  album: "Album",
  mixtape: "Mixtape",
  compilation: "Compilation",
};

const s = (v: unknown): string | null => {
  if (v == null) return null;
  const t = String(v).trim();
  return t ? t : null;
};
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const iso = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const t = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : t;
};

/**
 * Which language a bio was written in. `preferred_locale` is the language the
 * artist is spoken to, not necessarily the bio's. Stopwords decide; a tie goes to the profile.
 */
export function detectLocale(text: string, fallback: Locale): Locale {
  const t = ` ${text.toLowerCase().replace(/[^a-zàâçéèêëîïôûùüÿœ' ]+/g, " ")} `;
  const count = (words: string[]) => words.reduce((n, w) => n + (t.split(` ${w} `).length - 1), 0);
  const fr = count(["le", "la", "les", "des", "une", "est", "elle", "et", "du", "en", "au", "ses", "son"]);
  const en = count(["the", "and", "is", "of", "her", "his", "with", "an", "to", "in", "on", "she", "he"]);
  if (fr === en) return fallback;
  return fr > en ? "fr" : "en";
}

function pickTheme(brand: Row | null, kit: Row | null): Theme {
  const vi = (kit?.visual_identity ?? {}) as Row;
  const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null);
  return {
    background: hex(brand?.background_color) ?? hex(vi.background) ?? DEFAULT_THEME.background,
    text: hex(brand?.text_color) ?? hex(vi.text) ?? DEFAULT_THEME.text,
    accent: hex(brand?.accent_color) ?? hex(brand?.primary_color) ?? hex(vi.primary) ?? DEFAULT_THEME.accent,
    fontDisplay: s(brand?.font_display) ?? DEFAULT_THEME.fontDisplay,
    fontBody: s(brand?.font_body) ?? DEFAULT_THEME.fontBody,
    fontSource: (s(brand?.font_source) as Theme["fontSource"]) ?? DEFAULT_THEME.fontSource,
  };
}

export function collectSite(rows: SiteRows, opts: { today: string; extraPhotos?: string[] }): Site {
  const p = rows.profile ?? {};
  const kit = rows.presskit ?? {};
  const web = rows.website ?? {};
  const missing: Missing[] = [];
  const miss = (id: string, fix: string) => missing.push({ id, fix });

  const locale: Locale = (s(web.default_locale) ?? s(p.preferred_locale) ?? "en") === "fr" ? "fr" : "en";
  const name = s(p.artist_name) ?? "";
  if (!name) miss("profile.artist_name", "houselabel profile");

  // ── platforms ──────────────────────────────────────────────────────────
  const url = (platform: string) => s(rows.platforms.find((r) => r.platform === platform)?.url);
  const socials = rows.platforms
    .filter((r) => r.platform !== "website" && s(r.url))
    .map((r) => ({ platform: String(r.platform), label: SOCIAL_LABEL[String(r.platform)] ?? String(r.platform), url: String(r.url) }));
  const bandcamp = url("bandcamp");

  // ── releases ───────────────────────────────────────────────────────────
  const releases: SiteRelease[] = rows.releases
    .map((r) => {
      const date = iso(r.release_date);
      const title = s(r.title) ?? "";
      const cover = s(r.cover_art_url);
      const link = s(r.smart_link_url) ?? bandcamp ?? url("spotify");
      const upcoming = !!date && date > opts.today;
      if (!cover) miss(`release.artwork:${title}`, `artist:set releases '{"id":"${r.id}","cover_art_url":"…"}' --conflict id`);
      return { title, type: TYPE_LABEL[String(r.release_type)] ?? String(r.release_type), date, year: date ? date.slice(0, 4) : null, cover, link, upcoming };
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  if (!releases.length) miss("releases", "rights-manage-catalog, or the presskit intake's Bandcamp import");

  const next = [...releases].filter((r) => r.upcoming).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))[0] ?? null;
  const latest = releases.find((r) => !r.upcoming) ?? null;
  const heroRelease = next ?? latest;
  const presave = s(web.presave_url) ?? (next && s(rows.releases.find((r) => s(r.title) === next.title)?.smart_link_url)) ?? null;
  if (next && !presave) miss("hero.presave", `artist:set website '{"id":1,"presave_url":"…"}' --conflict id`);
  const listen = latest?.link ? { title: latest.title, url: latest.link } : null;

  // ── shows ──────────────────────────────────────────────────────────────
  // Every show is a presskit item; its date decides upcoming or past.
  const item = (kind: string) => rows.presskit_items.filter((i) => i.kind === kind).map((i) => (i.data ?? {}) as Row);
  const shows: SiteShow[] = item("show")
    .map((d) => ({ date: iso(d.date), venue: s(d.venue) ?? "", city: s(d.city) }))
    .filter((x) => x.venue);
  const upcoming = shows.filter((x) => x.date && x.date >= opts.today).sort((a, b) => a.date!.localeCompare(b.date!));
  const past = shows.filter((x) => !x.date || x.date < opts.today).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const widget = s(web.bandsintown_artist);
  if (!upcoming.length && !widget) miss("shows.upcoming", `artist:set presskit_items '{"kind":"show","data":{"venue":"…","city":"…","date":"YYYY-MM-DD"}}', or artist:set website '{"id":1,"bandsintown_artist":"…"}' --conflict id`);
  if (!past.length) miss("shows.past", "presskit-build asks for shows; artist:set presskit_items kind=show");
  const cities = [...new Set([...upcoming, ...past].map((x) => x.city).filter((c): c is string => !!c))].slice(0, 14);

  // ── bio ────────────────────────────────────────────────────────────────
  const text: Partial<Record<Locale, string>> = {};
  for (const m of rows.memory.filter((m) => m.key === "website.bio")) {
    if (m.language === "en" || m.language === "fr") text[m.language] = m.value;
  }
  const long = s(kit.long_bio);
  if (long) {
    const l = detectLocale(long, locale);
    text[l] ??= long;
  }
  const lead: Partial<Record<Locale, string>> = {};
  const short = s(kit.short_bio);
  if (short) lead[detectLocale(short, locale)] = short;
  for (const l of ["en", "fr"] as Locale[]) {
    if (!text[l]) miss(`bio.${l}`, long ? `artist:remember digital-marketing website.bio "<translation>" --language ${l}` : "presskit-build writes long_bio");
  }
  if (!short) miss("bio.short", "presskit-build writes short_bio");

  // ── photos ─────────────────────────────────────────────────────────────
  const photos = [...(opts.extraPhotos ?? []), ...item("photo").map((d) => s(d.url)).filter((u): u is string => !!u)];
  if (!photos.length) miss("photos", "drop photos in Drive Artist/Photos, or presskit-build");

  // ── press ──────────────────────────────────────────────────────────────
  const quotes = [
    ...item("quote").map((d) => ({ text: s(d.text) ?? "", source: s(d.source) ?? "", url: s(d.url) })),
    ...item("clipping").filter((d) => s(d.quote)).map((d) => ({ text: String(d.quote), source: s(d.outlet) ?? s(d.publication) ?? "", url: s(d.url) })),
  ].filter((q) => q.text);
  const clippings = item("clipping").map((d) => ({ title: s(d.title) ?? "", outlet: s(d.outlet) ?? s(d.publication), url: s(d.url) })).filter((c) => c.title);
  const awards = item("award").map((d) => ({ title: s(d.title) ?? "", organization: s(d.organization), year: s(d.year) })).filter((a) => a.title);
  if (!quotes.length && !clippings.length) miss("press", "presskit-build's press search, or artist:set presskit_items kind=clipping");

  // ── store, contact ─────────────────────────────────────────────────────
  const store = { url: s(web.shop_url), bandcamp };
  if (!store.url) miss("store.url", `artist:set website '{"id":1,"shop_url":"…"}' --conflict id`);
  const team = item("team").map((d) => ({ role: s(d.role) ?? "", name: s(d.name), email: s(d.email) })).filter((t) => t.role);
  const presskit = s(rows.presskit_version?.pdf_url) ?? s(rows.presskit_version?.presentation_url);
  if (!presskit) miss("contact.presskit", "presskit-build produces the deck");
  const newsletter = s(web.newsletter_url);
  if (!newsletter) miss("contact.newsletter", `artist:set website '{"id":1,"newsletter_url":"…"}' --conflict id`);
  const sms = s(web.sms_url);
  if (!sms) miss("contact.sms", `artist:set website '{"id":1,"sms_url":"…"}' --conflict id`);
  const emails = { contact: s(kit.contact_email), booking: s(kit.booking_email) };
  if (!emails.booking && !team.some((t) => /book/i.test(t.role))) miss("contact.booking", "presskit-build writes booking_email");

  return {
    name,
    locale,
    city: s(p.city),
    region: s(p.region),
    genres: arr(p.genres),
    markets: arr(p.target_markets),
    roles: arr(p.disciplines).map((d) => ROLE[d] ?? { en: d, fr: d }),
    hero: { release: heroRelease, presave, listen },
    releases,
    shows: { upcoming, past, widget, cities },
    bio: { lead, text },
    photos,
    press: { quotes, clippings, awards },
    store,
    contact: { team, presskit, newsletter, sms, emails, socials },
    theme: pickTheme(rows.brand, rows.presskit),
    sections: (web.sections ?? {}) as Record<string, boolean>,
    missing,
  };
}
