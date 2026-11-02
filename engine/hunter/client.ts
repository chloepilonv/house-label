/**
 * One call to Hunter's REST API, https://api.hunter.io/v2, with the artist's key.
 * Results go to artist.contacts, never the shared catalog: Hunter's terms forbid
 * a competitive service. The key goes in the X-API-KEY header so it never
 * appears in a URL an error might print.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */

export const HUNTER_API_URL = "https://api.hunter.io/v2";

/** Where to get the key. Printed by `houselabel connect hunter`. */
export const HUNTER_KEY_URL = "https://hunter.io/api-keys";

/** The endpoints this repo ever calls. `account` is free; the other two spend
 *  the artist's credits. */
export type HunterEndpoint = "account" | "domain-search" | "email-finder";

/** The seam tests replace: endpoint + parameters in, Hunter's `data` out. */
export type HunterCall = (endpoint: HunterEndpoint, params: Record<string, string>) => Promise<any>;

export function hunterCaller(key: string): HunterCall {
  return async (endpoint, params) => {
    const url = `${HUNTER_API_URL}/${endpoint}?${new URLSearchParams(params)}`;
    const res = await fetch(url, { headers: { "X-API-KEY": key } });
    const body = (await res.json().catch(() => ({}))) as { data?: unknown; errors?: { details?: string }[] };
    if (!res.ok) throw new Error(body.errors?.[0]?.details ?? `Hunter answered ${res.status}`);
    return body.data;
  };
}
