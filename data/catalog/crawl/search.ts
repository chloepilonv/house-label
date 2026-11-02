/**
 * Keyless web search, the fallback when no provider search or TinyFish key exists.
 * No keyless engine currently returns results (DuckDuckGo serves a challenge,
 * Mojeek a stub), so `findUrls` detects that and returns []; callers must say
 * "I could not search", never "nothing exists". `reachable` works today.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { urlKey, usableUrl } from "./pages";

/** Hosts that are never editorial coverage. One shared list; do not inline per call site. */
export const NOT_EDITORIAL: readonly string[] = [
  "instagram.com", "tiktok.com", "x.com", "twitter.com", "facebook.com",
  "threads.net", "open.spotify.com", "spotify.com", "music.apple.com",
  "bandcamp.com", "youtube.com", "youtu.be", "soundcloud.com", "deezer.com",
  "wikipedia.org", "songkick.com", "bandsintown.com", "eventbrite.com",
  "linktr.ee", "linkedin.com", "pinterest.com", "reddit.com", "discogs.com",
  "last.fm", "genius.com", "amazon.com", "shazam.com",
];

/** A browser UA. Search front ends serve a challenge page to obvious bots. */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SEARCH_TIMEOUT_MS = 15_000;
const VERIFY_TIMEOUT_MS = 5_000;
const VERIFY_CONCURRENCY = 4;

export const isNotEditorial = (hostname: string): boolean => {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  return NOT_EDITORIAL.some((b) => h === b || h.endsWith(`.${b}`));
};

async function withTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Every absolute href in the document, in source order. */
function hrefs(html: string): string[] {
  return [...html.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]!);
}

export interface FindOptions {
  /** Cap on returned URLs. Default 20. */
  limit?: number;
  /** Keep social and streaming hosts too. Default false. */
  includeNonEditorial?: boolean;
}

/**
 * Candidate URLs for a query. Never throws: a search front end that changes its
 * markup, rate-limits us, or disappears yields [], and the caller says "I
 * couldn't search" rather than "there is nothing".
 */
export async function findUrls(query: string, opts: FindOptions = {}): Promise<string[]> {
  const { limit = 20, includeNonEditorial = false } = opts;
  const q = query.trim();
  if (!q) return [];

  let html: string;
  try {
    const res = await withTimeout(
      `https://www.mojeek.com/search?q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow" },
      SEARCH_TIMEOUT_MS,
    );
    // 202 is what a challenge page answers with. Treat anything non-200 as
    // "no search available", never as "no results".
    if (res.status !== 200) return [];
    html = await res.text();
    // Mojeek's stub is ~5.5KB and answers 200, so status alone proves nothing.
    if (html.length < 8_000) return [];
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of hrefs(html)) {
    const abs = usableUrl(raw);
    if (!abs) continue;
    let host: string;
    try {
      host = new URL(abs).hostname;
    } catch {
      continue;
    }
    // The engine's own pages are navigation, not results.
    if (/(^|\.)mojeek\.com$/i.test(host)) continue;
    if (!includeNonEditorial && isNotEditorial(host)) continue;
    const key = urlKey(abs);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(abs);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Whether a URL actually serves something. HEAD first; many publishers refuse
 * HEAD, so 403/405/501 retries as a one-byte ranged GET.
 */

export async function reachable(url: string): Promise<boolean> {
  try {
    const head = await withTimeout(
      url,
      { method: "HEAD", redirect: "follow", headers: { "User-Agent": UA } },
      VERIFY_TIMEOUT_MS,
    );
    if (head.status < 400) return true;
    if ([403, 405, 501].includes(head.status)) {
      const get = await withTimeout(
        url,
        { method: "GET", redirect: "follow", headers: { "User-Agent": UA, Range: "bytes=0-0" } },
        VERIFY_TIMEOUT_MS,
      );
      return get.status < 400;
    }
    return false;
  } catch {
    return false;
  }
}

/** `reachable` over a list, a few at a time, preserving order. */
export async function keepReachable(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < urls.length; i += VERIFY_CONCURRENCY) {
    const batch = urls.slice(i, i + VERIFY_CONCURRENCY);
    const kept = await Promise.all(batch.map(async (u) => ((await reachable(u)) ? u : null)));
    for (const u of kept) if (u) out.push(u);
  }
  return out;
}

// bun run data/catalog/crawl/search.ts "odile-ray folk"
if (import.meta.main) {
  const q = process.argv.slice(2).join(" ");
  if (!q) {
    console.error('usage: bun run data/catalog/crawl/search.ts "<query>"');
    process.exit(1);
  }
  const found = await findUrls(q);
  if (!found.length) {
    console.error("No results — the search front end returned nothing usable.");
    process.exit(1);
  }
  const live = await keepReachable(found);
  for (const u of live) console.log(u);
  console.log(`\n${live.length} reachable of ${found.length} found.`);
}
