/**
 * One email from the artist to the artist. Only caller: `houselabel recap
 * --send`, which requests GMAIL_SEND_SCOPE itself. No department tool sends
 * mail, and `to` is not a parameter: it is always the connected account.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { gapi } from "./api";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

/** RFC 2047, so an accented or emoji subject survives the MIME header. */
export const encodeHeader = (s: string): string =>
  /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;

/** The raw base64url message. With HTML it is multipart/alternative, text first. */
export function rawMessage(to: string, subject: string, text: string, html?: string): string {
  const head = [`To: ${to}`, `Subject: ${encodeHeader(subject)}`, "MIME-Version: 1.0"];
  const part = (type: string, body: string) => [`Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: 8bit", "", body].join("\r\n");
  let mime: string;
  if (!html) mime = [...head, part("text/plain", text)].join("\r\n");
  else {
    const boundary = `hl_${Date.now().toString(36)}`;
    mime = [
      ...head,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      part("text/plain", text),
      `--${boundary}`,
      part("text/html", html),
      `--${boundary}--`,
    ].join("\r\n");
  }
  return Buffer.from(mime, "utf8").toString("base64url");
}

/** Send to the connected account itself. Returns Gmail's message id. */
export async function sendToSelf(to: string, subject: string, text: string, html?: string): Promise<string> {
  const r = await gapi<{ id: string }>("sending your recap", `${BASE}/messages/send`, {
    method: "POST",
    json: { raw: rawMessage(to, subject, text, html) },
  });
  return r.id;
}
