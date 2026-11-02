/**
 * Read the shows off a tour poster, on whichever provider the artist chose.
 * Partial dates ("July 15") stay as written: guessing a day is worse.
 * Nothing is saved; the artist confirms candidates before they become `show` rows.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { generateText } from "ai";
import type { Config } from "../../../../../engine/config";
import { resolveModel } from "../../../../../engine/providers";

const UA = "Mozilla/5.0 (compatible; HouseLabelBot/1.0; +https://houselabel.ai)";
const MAX_IMAGES_PER_CALL = 4;
const MAX_CANDIDATES = 30;

export interface ShowCandidate {
  venue: string;
  city: string;
  /** ISO when the poster showed a full date, else the poster's own string. */
  date: string;
  event: string;
}

const PROMPT = `This image is likely a concert tour poster, show listing, festival lineup, or similar. Read every show / date / venue you can see and return them as JSON.

Return ONLY a JSON array (no prose, no code fences). Schema:

[
  {
    "venue": "Venue name (required, non-empty)",
    "city": "City — empty string if not visible",
    "date": "YYYY-MM-DD if a full date is visible, otherwise the freeform string from the poster (e.g. 'July 15', 'Summer 2024', '15.07.24'). Empty string if no date.",
    "event": "Festival / tour name if the poster shows one (e.g. 'Summer 2024 Tour', 'Osheaga'). Empty string otherwise."
  }
]

If the image is NOT a show listing (it's an artist photo, album art, logo, etc.), return [].
If you can read the year from the poster's title or banner, apply it to every date that is missing a year.
Do NOT invent venues, cities, or dates. If something is unclear, leave that field empty.`;

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

/** A show with no venue is not a show. Everything else may be blank. */
export function cleanShow(raw: unknown): ShowCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const venue = str(r.venue);
  if (!venue) return null;
  return { venue, city: str(r.city), date: str(r.date), event: str(r.event) };
}

export function dedupe(items: ShowCandidate[]): ShowCandidate[] {
  const seen = new Set<string>();
  const out: ShowCandidate[] = [];
  for (const s of items) {
    const key = `${s.venue.toLowerCase()}|${s.date.toLowerCase()}|${s.city.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Fetch an image and return it as bytes. Done here rather than handing the URL
 * to the provider because a redirect, a hotlink block or a 404 should fail
 * loudly in our code, not silently inside someone else's vision endpoint.
 */
async function loadImage(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export interface PosterResult {
  shows: ShowCandidate[];
  /** URLs that could not be fetched — reported, never silently dropped. */
  unreadable: string[];
  /** True when the model read the image and said it is not a show listing. */
  notAPoster: boolean;
}

export async function extractShowsFromImages(
  cfg: Config,
  imageUrls: string[],
): Promise<PosterResult> {
  const valid = imageUrls
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter((u) => /^https?:\/\//i.test(u))
    .slice(0, MAX_IMAGES_PER_CALL);
  if (!valid.length) return { shows: [], unreadable: imageUrls, notAPoster: false };

  const loaded: { url: string; bytes: Uint8Array }[] = [];
  const unreadable: string[] = [];
  for (const url of valid) {
    const bytes = await loadImage(url);
    if (bytes) loaded.push({ url, bytes });
    else unreadable.push(url);
  }
  if (!loaded.length) return { shows: [], unreadable, notAPoster: false };

  const { text } = await generateText({
    model: resolveModel(cfg, "standard"),
    messages: [
      {
        role: "user",
        content: [
          ...loaded.map((l) => ({ type: "file" as const, data: l.bytes, mediaType: "image/jpeg" })),
          { type: "text" as const, text: PROMPT },
        ],
      },
    ],
  });

  const raw = parseJsonArray(text);
  const shows = dedupe(
    raw.map(cleanShow).filter((s): s is ShowCandidate => s !== null),
  ).slice(0, MAX_CANDIDATES);

  return { shows, unreadable, notAPoster: shows.length === 0 };
}
