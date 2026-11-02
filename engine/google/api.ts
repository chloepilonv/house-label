/**
 * One authorized fetch, so every Google call fails the same way, including a
 * readable message for a 403 "insufficient authentication scopes".
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { accessToken } from "./auth";

export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

async function fail(res: Response, what: string): Promise<never> {
  const text = await res.text().catch(() => "");
  let reason = "";
  let detail = text.slice(0, 300);
  try {
    const json = JSON.parse(text) as { error?: { message?: string; errors?: { reason?: string }[] } };
    detail = json.error?.message ?? detail;
    reason = json.error?.errors?.[0]?.reason ?? "";
  } catch {
    /* a non-JSON body is still worth showing */
  }
  if (res.status === 403 && /insufficient.*scope/i.test(detail))
    throw new GoogleApiError(
      res.status,
      "insufficientScopes",
      `Google refused ${what}: this connection was not granted that permission.\n` +
        "  Run `houselabel connect google` again and leave every box ticked.",
    );
  throw new GoogleApiError(res.status, reason, `Google refused ${what} (${res.status}): ${detail}`);
}

/** A JSON call against a Google API. Returns the parsed body. */
export async function gapi<T = Record<string, unknown>>(
  what: string,
  url: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("authorization", `Bearer ${await accessToken()}`);
  if (json !== undefined) headers.set("content-type", "application/json");

  const res = await fetch(url, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body });
  if (!res.ok) await fail(res, what);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * For calls answered by a header: Drive's resumable upload returns an empty
 * body and the session URL in `Location`, which `gapi` cannot parse.
 */
export async function gapiRaw(
  what: string,
  url: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<Response> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("authorization", `Bearer ${await accessToken()}`);
  if (json !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");

  const res = await fetch(url, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body });
  if (!res.ok) await fail(res, what);
  return res;
}

/** The same, for the calls whose answer is bytes rather than JSON. */
export async function gapiBytes(what: string, url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${await accessToken()}` } });
  if (!res.ok) await fail(res, what);
  return Buffer.from(await res.arrayBuffer());
}
