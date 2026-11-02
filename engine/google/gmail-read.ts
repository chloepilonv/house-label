/**
 * Reads the artist's sent mail once to learn their voice. Only caller:
 * `houselabel voice learn --gmail` (engine/voice.ts), which requests
 * GMAIL_READONLY_SCOPE itself. Mail never reaches artist.* or a department.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { gapi } from "./api";
import type { RawEmail } from "../voice-learn";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

interface Part {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number };
  parts?: Part[];
}
interface Message {
  id: string;
  internalDate?: string;
  payload?: Part;
}

/** The first text/plain body in a MIME tree, decoded. Pure, so it is tested. */
export function plainText(part: Part | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return Buffer.from(part.body.data, "base64url").toString("utf8");
  for (const p of part.parts ?? []) {
    const t = plainText(p);
    if (t) return t;
  }
  return "";
}

const header = (m: Message, name: string): string =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

/** "Name <a@b>, c@d" → ["a@b", "c@d"] */
export const addresses = (v: string): string[] =>
  [...v.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)].map((m) => m[0].toLowerCase());

export function toRawEmail(m: Message): RawEmail {
  return {
    id: m.id,
    date: m.internalDate ? new Date(Number(m.internalDate)).toISOString().slice(0, 10) : "",
    from: addresses(header(m, "From"))[0] ?? "",
    to: [...addresses(header(m, "To")), ...addresses(header(m, "Cc"))],
    subject: header(m, "Subject"),
    text: plainText(m.payload),
  };
}

/** Up to `max` sent messages, newest first. Chats excluded. */
export async function listSent(max: number, onProgress?: (done: number, total: number) => void): Promise<RawEmail[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q: "in:sent -in:chats", maxResults: String(Math.min(100, max - ids.length)) });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await gapi<{ messages?: { id: string }[]; nextPageToken?: string }>(
      "listing your sent mail",
      `${BASE}/messages?${params}`,
    );
    for (const m of page.messages ?? []) ids.push(m.id);
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < max);

  const out: RawEmail[] = [];
  for (const id of ids) {
    out.push(toRawEmail(await gapi<Message>("reading a sent message", `${BASE}/messages/${id}?format=full`)));
    onProgress?.(out.length, ids.length);
  }
  return out;
}
