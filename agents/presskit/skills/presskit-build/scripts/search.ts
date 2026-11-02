/**
 * Find editorial coverage of an artist, and prove each link is reachable.
 *
 * Model URLs are plausible, not real: hosts are checked against BLOCKED_HOSTS
 * in code and every URL is fetched before it is shown. Returns candidates
 * only; the artist confirms each `clipping`, since a common name finds a
 * stranger's press. A provider with no web search returns `{ unsupported: true }`.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs } from "ai";
import type { Config } from "../../../../../engine/config";
import { resolveModel } from "../../../../../engine/providers";

/** Not press, however often a model offers them. Checked in code, not prose. */
const BLOCKED_HOSTS: readonly string[] = [
  "instagram.com", "tiktok.com", "x.com", "twitter.com", "facebook.com",
  "open.spotify.com", "spotify.com", "music.apple.com", "bandcamp.com",
  "youtube.com", "youtu.be", "soundcloud.com", "en.wikipedia.org",
  "songkick.com", "bandsintown.com", "eventbrite.com", "linktr.ee",
  "linkedin.com",
];

const MAX_CANDIDATES = 10;
const VERIFY_CONCURRENCY = 4;
const VERIFY_TIMEOUT_MS = 5_000;
const UA = "Mozilla/5.0 (compatible; HouseLabelBot/1.0; +https://houselabel.ai)";

export interface PressCandidate {
  title: string;
  publication: string;
  /** "YYYY-MM-DD" or "". Never guessed. */
  date: string;
  url: string;
  /** ≤280 chars. */
  snippet: string;
}

export interface PressSearchResult {
  candidates: PressCandidate[];
  /** True when the artist's provider offers no server-side web search. */
  unsupported?: boolean;
  /** How many the model offered before blocking and reachability culled them. */
  offered: number;
}

const isHostBlocked = (hostname: string): boolean => {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  return BLOCKED_HOSTS.some((b) => h === b || h.endsWith(`.${b}`));
};

function safeUrl(input: unknown): URL | null {
  if (typeof input !== "string") return null;
  try {
    return new URL(input.trim());
  } catch {
    return null;
  }
}

/** Host + path, trailing slash dropped — so /a and /a/ are one article. */
const normalizeKey = (u: URL): string =>
  `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/$/, "").toLowerCase()}`;

/** Models wrap JSON in prose and code fences. Both are tolerated. */
export function parseJsonArray(text: string): unknown[] {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = (fenced?.[1] ?? text).trim();
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(body.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function cleanCandidate(raw: Record<string, unknown>): PressCandidate | null {
  const url = safeUrl(raw.url);
  if (!url || isHostBlocked(url.hostname)) return null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const publication = typeof raw.publication === "string" ? raw.publication.trim() : "";
  // A headline with no outlet is not a citation, and a presskit prints the outlet.
  if (!title || !publication) return null;
  return {
    title,
    publication,
    date: typeof raw.date === "string" ? raw.date.trim() : "",
    url: url.toString(),
    snippet: (typeof raw.snippet === "string" ? raw.snippet.trim() : "").slice(0, 280),
  };
}

export function dedupe(candidates: PressCandidate[]): PressCandidate[] {
  const seen = new Set<string>();
  const out: PressCandidate[] = [];
  for (const c of candidates) {
    const u = safeUrl(c.url);
    if (!u) continue;
    const key = normalizeKey(u);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), VERIFY_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Reachable if HEAD returns <400. Plenty of publishers refuse HEAD outright,
 * so 403/405/501 retries as a one-byte ranged GET before giving up.
 */
export async function isReachable(url: string): Promise<boolean> {
  try {
    const head = await fetchWithTimeout(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": UA },
    });
    if (head.status < 400) return true;
    if ([403, 405, 501].includes(head.status)) {
      const get = await fetchWithTimeout(url, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": UA, Range: "bytes=0-0" },
      });
      return get.status < 400;
    }
    return false;
  } catch {
    return false;
  }
}

async function verifyAll(items: PressCandidate[]): Promise<PressCandidate[]> {
  const out: PressCandidate[] = [];
  for (let i = 0; i < items.length; i += VERIFY_CONCURRENCY) {
    const batch = items.slice(i, i + VERIFY_CONCURRENCY);
    const kept = await Promise.all(batch.map(async (c) => ((await isReachable(c.url)) ? c : null)));
    for (const c of kept) if (c) out.push(c);
  }
  return out;
}

function promptFor(name: string, extraContext?: string): string {
  const context = extraContext?.trim() ? ` (${extraContext.trim()})` : "";
  return `Find press articles, interviews, and reviews about the musician "${name}"${context}.

ONLY return editorial coverage from music publications, magazines, blogs, or newspapers — NOT:
- the artist's own social profiles (Instagram, TikTok, X, Facebook)
- streaming pages (Spotify, Apple Music, YouTube, SoundCloud, Bandcamp)
- Wikipedia
- event listings (Songkick, Bandsintown, Eventbrite)
- generic directory pages

Run up to 5 web searches using variants of the artist's name. Then return your final answer as ONLY a JSON array (no prose, no code fences) shaped exactly like:

[
  {
    "title": "Article headline",
    "publication": "Publication name",
    "date": "YYYY-MM-DD or empty string if unknown",
    "url": "https://...",
    "snippet": "One sentence describing the article (under 200 chars)."
  }
]

Cap at ${MAX_CANDIDATES + 5} entries. If you cannot find any editorial coverage, return [].`;
}

/**
 * The provider's own web-search tool, or null when it has none.
 *
 * Anthropic: the 2025-03-05 tool on purpose. The newer one needs programmatic
 * tool calling, which the `fast` tier refuses.
 */
function webSearchToolFor(provider: string) {
  if (provider === "anthropic") return anthropic.tools.webSearch_20250305({ maxUses: 5 });
  if (provider === "openai") return openai.tools.webSearch({});
  return null;
}

export interface SearchOptions {
  extraContext?: string;
  /** Tests only — skips the network reachability pass. */
  skipVerify?: boolean;
}

export async function searchPressCandidates(
  cfg: Config,
  artistName: string,
  options: SearchOptions = {},
): Promise<PressSearchResult> {
  const name = artistName.trim();
  if (!name) return { candidates: [], offered: 0 };

  // Web search is the provider's own server-side tool. Without one, return
  // `unsupported` so the intake asks for URLs instead of implying no press.
  const searchTool = webSearchToolFor(cfg.provider);
  if (!searchTool) {
    return { candidates: [], offered: 0, unsupported: true };
  }

  const { text } = await generateText({
    model: resolveModel(cfg, "fast"),
    prompt: promptFor(name, options.extraContext),
    tools: { web_search: searchTool },
    stopWhen: stepCountIs(8),
  });

  const raw = parseJsonArray(text);
  const cleaned = raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map(cleanCandidate)
    .filter((c): c is PressCandidate => c !== null);
  const unique = dedupe(cleaned);
  const reachable = options.skipVerify ? unique : await verifyAll(unique);
  return { candidates: reachable.slice(0, MAX_CANDIDATES), offered: raw.length };
}
