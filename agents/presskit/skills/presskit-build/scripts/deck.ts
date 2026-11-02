/**
 * The nine slides, as a function of the artist's rows. No model call.
 *
 * A missing fact renders only through `tbc()` ("To be completed"), so nothing
 * here can invent text. Every slide must survive its own data being absent:
 * the deck is often built mid-intake.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import pptxgen from "pptxgenjs-plus";
import { enforceContrast, resolveTheme, type Theme, type ThemeInputs } from "./theme";

export type Lang = "en" | "fr";

const UA = "Mozilla/5.0 (compatible; HouseLabelBot/1.0; +https://houselabel.ai)";

const W = 10, H = 5.625, M = 0.62;

const T = {
  en: {
    tbc: "To be completed",
    presskit: "PRESSKIT",
    bio: "Biography", who: "Who is",
    disco: "Discography", catalogue: "The catalogue",
    title: "TITLE", format: "FORMAT", year: "YEAR",
    shows: "Shows", road: "On the road",
    awards: "Recognition", prizes: "Awards and mentions",
    press: "Press", written: "What's been written",
    team: "Team", talk: "Who to talk to",
    gallery: "Gallery", photos: "Photos",
    monthly: "MONTHLY LISTENERS", streams: "TOTAL STREAMS", followers: "FOLLOWERS",
    selfReported: "Self-reported by the artist.",
    alsoReleased: "ALSO RELEASED",
    platforms: "PLATFORMS",
    audience: "Where the audience is",
    readOn: "Read off each platform's own public page. Views are the sum of what the page shows — a floor, not a lifetime total.",
    viewsCol: "VIEWS",
    hiRes: "High-resolution downloads on request.",
    noPhotos: "No photos on file yet — this slide fills itself once you add some.",
  },
  fr: {
    tbc: "À compléter",
    presskit: "PRESSKIT",
    bio: "Biographie", who: "Qui est",
    disco: "Discographie", catalogue: "Le catalogue",
    title: "TITRE", format: "FORMAT", year: "ANNÉE",
    shows: "Spectacles", road: "Sur la route",
    awards: "Reconnaissance", prizes: "Prix et mentions",
    press: "Revue de presse", written: "Ce qui s'est écrit",
    team: "Équipe", talk: "À qui parler",
    gallery: "Galerie", photos: "Photos",
    monthly: "AUDITEURS MENSUELS", streams: "ÉCOUTES TOTALES", followers: "ABONNÉS",
    selfReported: "Déclaré par l'artiste.",
    alsoReleased: "AUTRES SORTIES",
    platforms: "PLATEFORMES",
    audience: "Où est le public",
    readOn: "Relevé sur la page publique de chaque plateforme. Les vues sont la somme de ce que la page affiche — un plancher, pas un total.",
    viewsCol: "VUES",
    hiRes: "Téléchargement haute résolution sur demande.",
    noPhotos: "Aucune photo au dossier — cette page se remplit dès que tu en ajoutes.",
  },
} as const;

export interface DeckItem {
  kind: string;
  slot: string | null;
  data: Record<string, unknown>;
}

export interface DeckData {
  artistName: string;
  genres?: string | null;
  location?: string | null;
  shortBio?: string | null;
  longBio?: string | null;
  contactEmail?: string | null;
  bookingEmail?: string | null;
  /** From `artist.releases` — never copied into the presskit tables. */
  releases: { title: string; kind?: string | null; year?: string | null; coverUrl?: string | null }[];
  /** From `artist.platform_latest`. A metric nobody reported is missing, not 0. */
  stats: { monthly?: number | null; streams?: number | null; followers?: number | null };
  /**
   * Per-platform audience, read off each platform's public page. Separate from
   * `stats` because a single total hides where the audience is.
   */
  platforms?: {
    platform: string;
    url?: string | null;
    handle?: string | null;
    followers?: number | null;
    /** Views or plays, where the platform prints them. A floor, never a total. */
    views?: number | null;
  }[];
  /** Confirmed items only. `suggested` never reaches this function. */
  items: DeckItem[];
  lang: Lang;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (n: number | null | undefined, lang: Lang): string | null =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA") : null;

/** Every image is fetched here. `addImage({path:url})` does not follow redirects. */
async function loadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export interface BuildResult {
  path: string;
  theme: Theme;
  /** Everything the artist should be told: missing slides, unreadable photos. */
  warnings: string[];
  /** Slides whose data was absent, so the caller can name them. */
  incomplete: string[];
}

export async function buildDeck(
  data: DeckData,
  outPath: string,
  themeInputs: Omit<ThemeInputs, "genres"> = {},
): Promise<BuildResult> {
  const L = T[data.lang];
  const warnings: string[] = [];
  const incomplete: string[] = [];

  const resolved = enforceContrast(resolveTheme({ ...themeInputs, genres: data.genres }));
  if (resolved.warning) warnings.push(resolved.warning);
  const th = resolved.theme;

  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = `Presskit — ${data.artistName}`;
  pres.author = "House Label";

  const of = (kind: string): DeckItem[] => data.items.filter((i) => i.kind === kind);
  const photoUrls = (slot: string): string[] =>
    of("photo").filter((p) => (p.slot ?? "gallery") === slot).map((p) => str(p.data.url)).filter(Boolean);

  // Fetch every photo and press lead image once, up front. A clipping whose
  // image is unreachable renders without it.
  const clipImages = of("clipping")
    .map((it) => String((it.data as Record<string, unknown>).image ?? ""))
    .filter(Boolean);
  // Release covers are fetched in the same pass.
  const coverUrls = data.releases.map((r) => String(r.coverUrl ?? "")).filter(Boolean);
  const wanted = [...photoUrls("hero"), ...photoUrls("secondary"), ...photoUrls("gallery"), ...clipImages, ...coverUrls];
  const loaded = new Map<string, string>();
  for (const url of wanted) {
    const d = await loadImage(url);
    if (d) loaded.set(url, d);
    else warnings.push(`photo could not be read, slide left without it: ${url}`);
  }
  const pick = (slot: string, n = 1): string[] =>
    photoUrls(slot).map((u) => loaded.get(u)).filter((d): d is string => !!d).slice(0, n);
  const anyPhoto = (n: number): string[] =>
    wanted.map((u) => loaded.get(u)).filter((d): d is string => !!d).slice(0, n);

  /** The shared chrome. Every content slide gets the same frame. */
  function page(num: string, label: string, title: string) {
    const s = pres.addSlide();
    s.background = { color: th.background };
    s.addText(`${num} — ${label.toUpperCase()}`, {
      x: M, y: 0.42, w: 6, h: 0.24, fontFace: th.fontBody, fontSize: 9,
      color: th.primary, bold: true, charSpacing: 2.4,
    });
    s.addShape(pres.ShapeType.rect, { x: M, y: 0.78, w: W - M * 2, h: 0.012, fill: { color: th.muted } });
    s.addText(title, { x: M, y: 0.95, w: W - M * 2, h: 0.68, fontFace: th.fontDisplay, fontSize: 32, color: th.text });
    s.addText(data.artistName, { x: M, y: H - 0.52, w: 3.4, h: 0.24, fontFace: th.fontBody, fontSize: 8, color: th.muted, charSpacing: 1.4 });
    s.addText(num, { x: W - M - 1, y: H - 0.52, w: 1, h: 0.24, fontFace: th.fontBody, fontSize: 8, color: th.muted, align: "right" });
    return s;
  }

  /** The only way a missing fact is rendered. */
  const tbc = (s: ReturnType<typeof page>, x: number, y: number, w = 4) =>
    s.addText(L.tbc, { x, y, w, h: 0.4, fontFace: th.fontDisplay, fontSize: 15, color: th.muted, italic: true });

  // ── 01 Cover ────────────────────────────────────────────────────────────
  {
    const s = pres.addSlide();
    s.background = { color: th.background };
    const hero = pick("hero", 1)[0] ?? anyPhoto(1)[0];
    if (hero) {
      s.addImage({ data: hero, x: 5.55, y: 0, w: 4.45, h: H, sizing: { type: "cover", w: 4.45, h: H } });
      // Tints the photo into the palette instead of letting it fight it.
      s.addShape(pres.ShapeType.rect, { x: 5.55, y: 0, w: 4.45, h: H, fill: { color: th.primary, transparency: 62 } });
    } else {
      s.addShape(pres.ShapeType.rect, { x: 5.55, y: 0, w: 4.45, h: H, fill: { color: th.card } });
      incomplete.push("cover photo");
    }
    s.addShape(pres.ShapeType.rect, { x: M, y: 1.35, w: 0.75, h: 0.02, fill: { color: th.primary } });
    s.addText(`${L.presskit} · ${new Date().getFullYear()}`, {
      x: M, y: 0.95, w: 4, h: 0.26, fontFace: th.fontBody, fontSize: 9, color: th.primary, bold: true, charSpacing: 2.6,
    });
    s.addText(data.artistName, { x: M - 0.06, y: 1.75, w: 5, h: 1.5, fontFace: th.fontDisplay, fontSize: 54, color: th.text });
    const sub = [str(data.genres), str(data.location)].filter(Boolean).join(" · ");
    if (sub) s.addText(sub, { x: M, y: 3.15, w: 4.6, h: 0.4, fontFace: th.fontBody, fontSize: 13, color: th.muted });
    const quote = str(of("quote")[0]?.data.text);
    if (quote) {
      s.addText(`« ${quote} »`, { x: M, y: 3.9, w: 4.4, h: 0.8, fontFace: th.fontDisplay, fontSize: 13, italic: true, color: th.text, lineSpacing: 20 });
    }
  }

  // ── 02 Biography ────────────────────────────────────────────────────────
  {
    const s = page("02", L.bio, `${L.who} ${data.artistName}`);
    let body = str(data.longBio) || str(data.shortBio);
    if (body) {
      // Size steps down by length so `fit: "shrink"` stays mild on long bios.
      // Bios often end with a contact block; cut at the first role-and-address
      // pair, since contacts have their own slide.
      const cut = body.search(/[A-ZÉÈÀ][\w\s+\-éèàÉ]{2,28}\s*:?\s*[\w.+-]+@[\w.-]+\.\w+/);
      if (cut > 200) body = body.slice(0, cut).trimEnd().replace(/[,;·—-]\s*$/, "");
      const chars = body.length;
      const size = chars > 1500 ? 9 : chars > 1000 ? 10 : chars > 700 ? 10.75 : 11.5;
      s.addText(body.slice(0, 2200), {
        x: M, y: 1.8, w: 5.2, h: 3.15, fontFace: th.fontBody, fontSize: size, color: th.text,
        lineSpacing: Math.round(size * 1.62), valign: "top", fit: "shrink",
      });
    } else {
      tbc(s, M, 1.8, 5.2);
      incomplete.push("biography");
    }
    const p = pick("secondary", 1)[0] ?? anyPhoto(2)[1];
    if (p) s.addImage({ data: p, x: 6.35, y: 1.35, w: 3.03, h: 3.3, sizing: { type: "cover", w: 3.03, h: 3.3 } });
  }

  // ── 03 Discography — covers, the way a presskit shows work ──────────────
  {
    const s = page("03", L.disco, L.catalogue);
    if (data.releases.length) {
      // Covers with title and format underneath, not a table.
      const order: Record<string, number> = { album: 0, mixtape: 1, ep: 2, single: 3 };
      const sorted = [...data.releases].sort(
        (a, b) =>
          (order[str(a.kind).toLowerCase()] ?? 9) - (order[str(b.kind).toLowerCase()] ?? 9) ||
          Number(str(b.year) || 0) - Number(str(a.year) || 0),
      );
      const featured = sorted.slice(0, 4);
      const CW = 1.72, GAP = 0.34, TOP = 1.78;
      featured.forEach((r, i) => {
        const x = M + i * (CW + GAP);
        const art = loaded.get(str(r.coverUrl));
        if (art) s.addImage({ data: art, x, y: TOP, w: CW, h: CW, sizing: { type: "cover", w: CW, h: CW } });
        else s.addShape(pres.ShapeType.rect, { x, y: TOP, w: CW, h: CW, fill: { color: th.card } });
        s.addText(str(r.title), {
          x: x - 0.1, y: TOP + CW + 0.12, w: CW + 0.2, h: 0.42, fontFace: th.fontDisplay, fontSize: 10.5,
          color: th.text, align: "center", lineSpacing: 13, valign: "top", fit: "shrink",
        });
        s.addText([str(r.kind), str(r.year)].filter(Boolean).join(", "), {
          x: x - 0.1, y: TOP + CW + 0.54, w: CW + 0.2, h: 0.22, fontFace: th.fontBody, fontSize: 9,
          color: th.muted, align: "center",
        });
      });

      // The rest as a named list, not a count.
      const rest = sorted.slice(4);
      if (rest.length) {
        s.addText(L.alsoReleased, {
          x: M, y: 4.42, w: W - M * 2, h: 0.22, fontFace: th.fontBody, fontSize: 8,
          color: th.muted, charSpacing: 1.6, align: "center",
        });
        s.addText(rest.map((r) => `${str(r.title)} (${[str(r.kind), str(r.year)].filter(Boolean).join(", ")})`).join("   ·   "), {
          x: M, y: 4.66, w: W - M * 2, h: 0.4, fontFace: th.fontBody, fontSize: 8.5,
          color: th.text, align: "center", lineSpacing: 12, fit: "shrink",
        });
      }
    } else {
      tbc(s, M, 1.8, 5.2);
      incomplete.push("discography");
    }
  }

  // ── 04 Platforms — where the audience actually is ───────────────────────
  {
    const s = page("04", L.platforms, L.audience);
    const rows = (data.platforms ?? []).filter((r) => str(r.platform));
    const withNumbers = rows.filter((r) => typeof r.followers === "number" && r.followers > 0);
    if (rows.length) {
      // Total first, then the per-platform split, with the source printed underneath.
      const total = withNumbers.reduce((n, r) => n + Number(r.followers ?? 0), 0);
      if (total) {
        s.addText(num(total, data.lang) ?? "", {
          x: M, y: 1.72, w: 4.2, h: 0.8, fontFace: th.fontDisplay, fontSize: 46, color: th.text,
        });
        s.addText(L.followers.toUpperCase(), {
          x: M, y: 2.5, w: 4.2, h: 0.24, fontFace: th.fontBody, fontSize: 8.5, color: th.muted, charSpacing: 1.8,
        });
      }
      for (const col of [0, 1]) {
        const hx = M + col * 4.5;
        s.addText(L.followers, { x: hx + 2.36, y: 2.74, w: 0.95, h: 0.2, fontFace: th.fontBody, fontSize: 6.5, color: th.muted, charSpacing: 1, align: "right" });
        s.addText(L.viewsCol, { x: hx + 3.34, y: 2.74, w: 0.95, h: 0.2, fontFace: th.fontBody, fontSize: 6.5, color: th.muted, charSpacing: 1, align: "right" });
      }
      // One row per platform, two columns, so eight fit without crowding.
      const half = Math.ceil(rows.length / 2);
      rows.forEach((r, i) => {
        const col = i < half ? 0 : 1;
        const y = 2.98 + (i % half) * 0.42;
        const x = M + col * 4.5;
        s.addText(str(r.platform).replace(/_/g, " ").toUpperCase(), {
          x, y, w: 2.1, h: 0.24, fontFace: th.fontBody, fontSize: 8.5, color: th.muted, charSpacing: 1.4,
        });
        const who = str(r.handle) || str(r.url).replace(/^https?:\/\/(www\.)?/, "");
        if (who) {
          s.addText(who.length > 30 ? `${who.slice(0, 29)}…` : who, {
            x, y: y + 0.2, w: 2.6, h: 0.26, fontFace: th.fontBody, fontSize: 10, color: th.primary,
            ...(str(r.url) ? { hyperlink: { url: str(r.url) } } : {}),
          });
        }
        const n = typeof r.followers === "number" && r.followers > 0 ? num(r.followers, data.lang) : null;
        const v = typeof r.views === "number" && r.views > 0 ? num(r.views, data.lang) : null;
        s.addText(n ?? (v ? "" : L.tbc), {
          x: x + 2.36, y: y + 0.04, w: 0.95, h: 0.3, fontFace: th.fontDisplay, fontSize: n ? 13 : 10,
          color: n ? th.text : th.muted, italic: !n, align: "right",
        });
        if (v) {
          s.addText(v, {
            x: x + 3.34, y: y + 0.04, w: 0.95, h: 0.3, fontFace: th.fontDisplay, fontSize: 13, color: th.text, align: "right",
          });
        }
      });
      // Computed from the bottom of the last row (handle at `y + 0.2`, 0.26 tall),
      // not a constant, so it holds for any platform count.
      const lastRow = 2.98 + (Math.ceil(rows.length / 2) - 1) * 0.42 + 0.52;
      s.addText(L.readOn, {
        x: M, y: Math.min(lastRow, H - 0.78), w: 5.6, h: 0.2, fontFace: th.fontBody, fontSize: 7.5, color: th.muted, italic: true,
      });
    } else {
      tbc(s, M, 1.8, 5.2);
      incomplete.push("platforms");
    }
  }

  // ── 05 Shows ────────────────────────────────────────────────────────────
  {
    const s = page("05", L.shows, L.road);
    const shows = of("show").slice(0, 5);
    if (shows.length) {
      shows.forEach((sh, i) => {
        const y = 1.8 + i * 0.62;
        s.addText(str(sh.data.date) || "—", { x: M, y, w: 1.6, h: 0.34, fontFace: th.fontBody, fontSize: 10, color: th.primary, bold: true });
        s.addText(str(sh.data.venue), { x: M + 1.7, y, w: 3.1, h: 0.34, fontFace: th.fontDisplay, fontSize: 14, color: th.text });
        s.addText(str(sh.data.city), { x: M + 4.8, y: y + 0.04, w: 2.2, h: 0.34, fontFace: th.fontBody, fontSize: 10, color: th.muted });
        s.addShape(pres.ShapeType.rect, { x: M, y: y + 0.46, w: W - M * 2, h: 0.008, fill: { color: th.card } });
      });
    } else {
      tbc(s, M, 1.8, 5.2);
      incomplete.push("shows");
    }
  }

  // ── 06 Awards & a pull quote ────────────────────────────────────────────
  {
    const s = page("06", L.awards, L.prizes);
    const awards = of("award").slice(0, 3);
    if (awards.length) {
      awards.forEach((a, i) => {
        const y = 1.8 + i * 0.78;
        s.addShape(pres.ShapeType.rect, { x: M, y: y + 0.06, w: 0.03, h: 0.5, fill: { color: th.primary } });
        s.addText(str(a.data.organization) || str(a.data.title), { x: M + 0.22, y, w: 4.3, h: 0.3, fontFace: th.fontDisplay, fontSize: 16, color: th.text });
        s.addText([str(a.data.title), str(a.data.year)].filter(Boolean).join(" · "), {
          x: M + 0.22, y: y + 0.3, w: 4.3, h: 0.26, fontFace: th.fontBody, fontSize: 10, color: th.muted,
        });
      });
    } else {
      tbc(s, M, 1.8, 4.4);
      incomplete.push("awards");
    }
    const q = of("quote")[0];
    if (q) {
      s.addShape(pres.ShapeType.rect, { x: 5.75, y: 1.7, w: 3.63, h: 2.5, fill: { color: th.card } });
      s.addText(`« ${str(q.data.text)} »`, {
        x: 5.98, y: 1.95, w: 3.15, h: 1.6, fontFace: th.fontDisplay, fontSize: 13, italic: true, color: th.text, lineSpacing: 20, valign: "top",
      });
      const src = str(q.data.source);
      if (src) s.addText(src, { x: 5.98, y: 3.7, w: 3, h: 0.24, fontFace: th.fontBody, fontSize: 8.5, color: th.muted, charSpacing: 1.4 });
    }
  }

  // ── 07 Press clippings ──────────────────────────────────────────────────
  {
    const s = page("07", L.press, L.written);
    const clips = of("clipping").slice(0, 4);
    if (clips.length) {
      // Each card: pull quote, the article's lead image if any, and a link to
      // the piece so the claim is checkable.
      clips.forEach((c, i) => {
        const x = M + (i % 2) * 4.44, y = 1.78 + Math.floor(i / 2) * 1.55;
        const shot = str(c.data.shot) || loaded.get(str(c.data.image));
        s.addShape(pres.ShapeType.rect, { x, y, w: 4.14, h: 1.28, fill: { color: th.card } });
        s.addShape(pres.ShapeType.rect, { x, y, w: 4.14, h: 0.035, fill: { color: th.primary } });

        // The screenshot takes the left third when there is one; the text
        // reflows rather than overlapping it.
        const hasShot = !!shot;
        if (shot) s.addImage({ data: shot, x, y: y + 0.04, w: 1.2, h: 1.2, sizing: { type: "cover", w: 1.2, h: 1.2 } });
        const tx = hasShot ? x + 1.38 : x + 0.24;
        const tw = hasShot ? 2.62 : 3.66;

        s.addText((str(c.data.outlet) || str(c.data.publication)).toUpperCase(), {
          x: tx, y: y + 0.16, w: tw, h: 0.22, fontFace: th.fontBody, fontSize: 8, color: th.primary, bold: true, charSpacing: 1.4,
        });
        const quote = str(c.data.quote);
        if (quote) {
          s.addText(`« ${quote} »`, {
            x: tx, y: y + 0.4, w: tw, h: 0.62, fontFace: th.fontDisplay, fontSize: 10.5, italic: true,
            color: th.text, lineSpacing: 14, valign: "top", fit: "shrink",
          });
        } else {
          s.addText(str(c.data.title), {
            x: tx, y: y + 0.4, w: tw, h: 0.62, fontFace: th.fontDisplay, fontSize: 11.5, color: th.text, lineSpacing: 15, fit: "shrink",
          });
        }
        const url = str(c.data.url);
        if (url) {
          // Show the domain; the hyperlink carries the full URL.
          let host = url; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep raw */ }
          s.addText(host, {
            x: tx, y: y + 1.03, w: tw, h: 0.2, fontFace: th.fontBody, fontSize: 7.5, color: th.muted,
            hyperlink: { url },
          });
        }
      });
    } else {
      tbc(s, M, 1.8, 5.2);
      incomplete.push("press clippings");
    }
  }

  // ── 08 Team & contact ───────────────────────────────────────────────────
  {
    const s = page("08", L.team, L.talk);
    const team = of("team").slice(0, 4);
    let y = 1.8;
    for (const t of team) {
      const name = str(t.data.name);
      const mail = str(t.data.email);
      s.addText(str(t.data.role).toUpperCase(), { x: M, y, w: 3.4, h: 0.24, fontFace: th.fontBody, fontSize: 8.5, color: th.muted, charSpacing: 1.6 });
      s.addText(name || mail || L.tbc, {
        x: M, y: y + 0.24, w: 4.4, h: 0.32, fontFace: name ? th.fontDisplay : th.fontBody,
        fontSize: name ? 17 : 13, color: name ? th.text : th.primary,
      });
      if (name && mail) s.addText(mail, { x: M, y: y + 0.56, w: 4.4, h: 0.26, fontFace: th.fontBody, fontSize: 10, color: th.primary });
      // A named contact needs a third line; address-only ones are shorter.
      y += name && mail ? 0.95 : 0.7;
    }
    // Never print an address twice: `contactEmail` is often a team row already.
    const shown = new Set(team.map((t) => str(t.data.email).toLowerCase()).filter(Boolean));
    const contacts: [string, string][] = [];
    const addContact = (label: string, mail: string) => {
      if (mail && !shown.has(mail.toLowerCase())) { contacts.push([label, mail]); shown.add(mail.toLowerCase()); }
    };
    addContact("PRESS", str(data.contactEmail));
    addContact("BOOKING", str(data.bookingEmail));
    for (const [role, mail] of contacts) {
      s.addText(role, { x: M, y, w: 3.4, h: 0.24, fontFace: th.fontBody, fontSize: 8.5, color: th.muted, charSpacing: 1.6 });
      s.addText(mail, { x: M, y: y + 0.24, w: 4.4, h: 0.32, fontFace: th.fontBody, fontSize: 13, color: th.primary });
      y += 0.8;
    }
    if (!team.length && !contacts.length) {
      tbc(s, M, 1.8, 4.4);
      incomplete.push("contact");
    }
    const p = pick("gallery", 1)[0] ?? anyPhoto(3)[2];
    if (p) s.addImage({ data: p, x: 5.9, y: 1.5, w: 3.48, h: 3.1, sizing: { type: "cover", w: 3.48, h: 3.1 } });
  }

  // ── 09 Gallery ──────────────────────────────────────────────────────────
  {
    const s = page("09", L.gallery, L.photos);
    const shots = anyPhoto(4);
    if (shots.length) {
      shots.forEach((d, i) => {
        s.addImage({ data: d, x: M + i * 2.28, y: 1.8, w: 2.06, h: 2.6, sizing: { type: "cover", w: 2.06, h: 2.6 } });
      });
      s.addText(L.hiRes, { x: M, y: 4.62, w: 7, h: 0.26, fontFace: th.fontBody, fontSize: 8.5, color: th.muted, italic: true });
    } else {
      s.addText(L.noPhotos, { x: M, y: 1.9, w: 7, h: 0.4, fontFace: th.fontBody, fontSize: 11, color: th.muted, italic: true });
      incomplete.push("photo gallery");
    }
  }

  await pres.writeFile({ fileName: outPath });
  return { path: outPath, theme: th, warnings, incomplete };
}
