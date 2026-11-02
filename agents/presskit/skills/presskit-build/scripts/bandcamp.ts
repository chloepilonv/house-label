/**
 * Read an artist's whole discography off their Bandcamp page.
 *
 * A script, not a model, so the same URL gives the same releases with no
 * API call. The regexes encode Bandcamp's real markup. Returns candidates
 * only; `presskit-build` saves after the artist confirms.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

export interface BandcampRelease {
  title: string;
  /** "" when the page carries no usable date. Never guessed. */
  year: string;
  label: string;
  streaming_url: string;
  cover_url: string;
  kind: "album" | "track";
}

const UA = "Mozilla/5.0 (compatible; HouseLabelBot/1.0; +https://houselabel.ai)";

function decodeEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Any Bandcamp URL → that artist's /music page. Throws on anything else. */
export function toMusicPageUrl(input: string): string {
  let url: URL;
  const raw = input.trim();
  try {
    // Accept a bare host like `odile-ray.bandcamp.com`; artists rarely type the scheme.
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error(`Not a URL: ${input}`);
  }
  if (!/bandcamp\.com$/i.test(url.hostname)) {
    throw new Error(`Not a Bandcamp URL: ${input}`);
  }
  url.pathname = "/music";
  url.search = "";
  url.hash = "";
  return url.toString();
}

/** bcbits thumbs use _N.jpg — _2 is small, _10 is 1200x1200. Decks want _10. */
const upscaleCover = (src: string): string => src.replace(/_(\d+)\.jpg/, "_10.jpg");

interface GridItem {
  type: "track" | "album";
  href: string;
  title: string;
  thumbUrl: string;
}

export function parseGridItems(html: string): GridItem[] {
  const gridMatch = /<ol[^>]*id="music-grid"[^>]*>([\s\S]*?)<\/ol>/i.exec(html);
  if (!gridMatch?.[1]) return [];
  const items: GridItem[] = [];
  const liRe = /<li\s+data-item-id="(track|album)-(\d+)"[^>]*>([\s\S]*?)<\/li>/gi;
  let m: RegExpExecArray | null;
  while ((m = liRe.exec(gridMatch[1])) !== null) {
    const [, type, , body] = m;
    if (!body) continue;
    const href = /<a\s+href="([^"]+)"/i.exec(body)?.[1];
    const title = /<p\s+class="title"[^>]*>\s*([\s\S]*?)\s*<\/p>/i.exec(body)?.[1];
    if (!href || !title) continue;
    items.push({
      type: type as "track" | "album",
      href,
      // Everything after a nested <span> is a subtitle, not the title.
      title: decodeEntities(title.replace(/<[^>]+>[\s\S]*/i, "").trim()),
      thumbUrl: /<img\s+src="([^"]+)"/i.exec(body)?.[1] ?? "",
    });
  }
  return items;
}

interface LdRelease {
  datePublished?: string;
  image?: string;
  label?: string;
  streamingUrl?: string;
}

export function parseLdJson(html: string): LdRelease {
  const m = /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i.exec(html);
  if (!m?.[1]) return {};
  try {
    const data = JSON.parse(m[1]);
    const label = data.recordLabel?.name || data.publisher?.name || "";
    const image = Array.isArray(data.image) ? data.image[0] : data.image;
    return {
      datePublished: data.datePublished,
      image: typeof image === "string" ? image : undefined,
      label: typeof label === "string" ? label : "",
      streamingUrl: data["@id"] || data.url,
    };
  } catch {
    return {};
  }
}

/**
 * The year, or "". A four-digit number in the string is accepted when the date
 * itself will not parse, because Bandcamp prints "released March 2019" as often
 * as it prints an ISO date — but nothing is inferred beyond that.
 */
export function yearOf(datePublished: string | undefined): string {
  if (!datePublished) return "";
  const d = new Date(datePublished);
  if (Number.isNaN(d.getTime())) return /\b(19|20)\d{2}\b/.exec(datePublished)?.[0] ?? "";
  return String(d.getUTCFullYear());
}

async function fetchHtml(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal });
  if (!res.ok) throw new Error(`Bandcamp ${res.status} at ${url}`);
  return res.text();
}

/**
 * Every release on the page, newest first. A release page that fails to load
 * falls back to what the grid showed instead of failing the run.
 */
export async function scrapeBandcampDiscography(
  artistUrl: string,
  opts: { limit?: number; timeoutMs?: number } = {},
): Promise<BandcampRelease[]> {
  const { limit = 30, timeoutMs = 15_000 } = opts;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const musicUrl = toMusicPageUrl(artistUrl);
    const origin = new URL(musicUrl).origin;
    const items = parseGridItems(await fetchHtml(musicUrl, controller.signal)).slice(0, limit);

    const out = await Promise.all(
      items.map(async (item): Promise<BandcampRelease> => {
        const pageUrl = origin + item.href;
        try {
          const ld = parseLdJson(await fetchHtml(pageUrl, controller.signal));
          return {
            title: item.title,
            year: yearOf(ld.datePublished),
            label: ld.label ?? "",
            streaming_url: ld.streamingUrl || pageUrl,
            cover_url: ld.image || upscaleCover(item.thumbUrl),
            kind: item.type,
          };
        } catch {
          return {
            title: item.title,
            year: "",
            label: "",
            streaming_url: pageUrl,
            cover_url: upscaleCover(item.thumbUrl),
            kind: item.type,
          };
        }
      }),
    );

    // Newest first where years exist; grid order otherwise.
    out.sort((a, b) => (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0));
    return out;
  } finally {
    clearTimeout(t);
  }
}

// Run it directly: bun run .../bandcamp.ts https://artist.bandcamp.com
if (import.meta.main) {
  const url = process.argv[2];
  if (!url) {
    console.error("usage: bun run bandcamp.ts <bandcamp-url>");
    process.exit(1);
  }
  const releases = await scrapeBandcampDiscography(url);
  if (!releases.length) {
    console.error("No releases found on that page.");
    process.exit(1);
  }
  for (const r of releases) {
    console.log(`${(r.year || "----").padEnd(6)} ${r.kind.padEnd(6)} ${r.title}`);
  }
  console.log(`\n${releases.length} release${releases.length === 1 ? "" : "s"}.`);
}
