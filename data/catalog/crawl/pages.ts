/**
 * The raw layer: fetch once, derive many times. All network reads go through
 * here, so the model step is replayable from stored pages. Unchanged pages
 * (etag → `not_modified`) need no model call. TinyFish Fetch is free.
 */
import type { Sql } from "postgres";

const FETCH_ENDPOINT = "https://api.fetch.tinyfish.ai";
const FETCH_BATCH = 10;          // Fetch's documented max URLs per request
const DEFAULT_TTL_DAYS = 7;      // re-ask the site at most this often

export interface Page {
  url: string;
  final_url: string | null;
  markdown: string;
  links: string[];
  content_hash: string | null;
  status: "ok" | "empty" | "error" | "not_modified";
  fetched_at: Date;
  fresh: boolean;                // true when this call fetched it rather than reading the store
  changed: boolean;              // true when the content differs from what we had
}

/** Normalize URLs for lookup: Fetch echoes back a URL whose slash, case or fragment may differ. */
export const urlKey = (u: string) =>
  u.trim().toLowerCase().replace(/#.*$/, "").replace(/\/+$/, "");

/**
 * The marketing site behind a signup URL. Signup URLs often sit on an app
 * subdomain (apply.awal.com) whose origin is a login form with no products,
 * so a known app label is dropped. Only these labels, and only when a real
 * domain remains, so we never send sessions to a host that does not resolve.
 */
const APP_SUBDOMAINS = new Set([
  "apply", "login", "auth", "app", "dashboard", "artist", "web",
  "portal", "my", "account", "release", "signup", "register",
]);

export function marketingSite(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const labels = u.hostname.split(".");
    // 3+ labels means there is something to drop and a domain left after it.
    if (labels.length >= 3 && APP_SUBDOMAINS.has(labels[0]!.toLowerCase()))
      return `${u.protocol}//${labels.slice(1).join(".")}`;
    return u.origin;
  } catch {
    return rawUrl;
  }
}

/**
 * Absolute http(s) URL, or null. Fetch rejects the whole batch with a 400 if
 * any one URL is malformed.
 */
export function usableUrl(u: unknown, base?: string): string | null {
  if (typeof u !== "string" || !u.trim()) return null;
  const t = u.trim();
  try {
    const p = new URL(t, base);
    return p.protocol === "http:" || p.protocol === "https:" ? p.href : null;
  } catch {
    if (!/^https?:\/\//i.test(t) && /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(t)) {
      try { return new URL(`https://${t}`).href; } catch { return null; }
    }
    return null;
  }
}

/**
 * Postgres text rejects NUL bytes, so strip NUL and other C0 controls
 * (keep tab, newline, carriage return).
 */
const scrub = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

const sha256 = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

/** Read stored pages without any network access — what `catalog:derive` uses. */
export async function storedPages(sql: Sql, urls: string[]): Promise<Map<string, Page>> {
  const keys = [...new Set(urls.map((u) => usableUrl(u)).filter((u): u is string => !!u).map(urlKey))];
  const out = new Map<string, Page>();
  if (!keys.length) return out;
  const rows = await sql<Record<string, never>[]>`
    select url, final_url, markdown, links, content_hash, status, fetched_at
    from catalog.crawl_pages where url = any(${keys})`;
  for (const r of rows as unknown as Page[])
    out.set(urlKey(r.url), { ...r, markdown: r.markdown ?? "", links: r.links ?? [], fresh: false, changed: false });
  return out;
}

/**
 * Fetch URLs into the raw layer, skipping anything still fresh (`force` ignores
 * TTL). `changed: false` tells the derive step it may skip the model.
 */

export async function fetchPages(
  sql: Sql,
  urls: string[],
  opts: { topic?: string; kind?: "index" | "detail"; sourceId?: string; ttlDays?: number; force?: boolean } = {},
): Promise<Map<string, Page>> {
  const key = process.env.TINYFISH_API_KEY;
  if (!key) throw new Error("TINYFISH_API_KEY not set");
  const ttl = (opts.ttlDays ?? DEFAULT_TTL_DAYS) * 86_400_000;

  const wanted = [...new Set(urls.map((u) => usableUrl(u)).filter((u): u is string => !!u))];
  const have = await storedPages(sql, wanted);
  const out = new Map<string, Page>();
  const todo: string[] = [];

  for (const u of wanted) {
    const stored = have.get(urlKey(u));
    const age = stored ? Date.now() - new Date(stored.fetched_at).getTime() : Infinity;
    if (stored && !opts.force && age < ttl && stored.status === "ok") out.set(urlKey(u), stored);
    else todo.push(u);
  }

  for (let i = 0; i < todo.length; i += FETCH_BATCH) {
    const batch = todo.slice(i, i + FETCH_BATCH);
    // Conditional requests need one etag, so they only apply to single-URL calls.
    const etag = batch.length === 1
      ? (await sql`select etag from catalog.crawl_pages where url = ${urlKey(batch[0])}`)[0]?.etag
      : null;

    let res: Response;
    try {
      res = await fetch(FETCH_ENDPOINT, {
        method: "POST",
        headers: { "X-API-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: batch,
          format: "markdown",
          links: true,
          include_etag_and_last_modified: true,
          ...(etag ? { if_none_match: etag } : {}),
        }),
        signal: AbortSignal.timeout(180_000),
      });
    } catch (e) {
      console.warn(`  fetch batch failed: ${(e as Error).message}`);
      continue;
    }
    if (!res.ok) {
      console.warn(`  fetch batch failed: HTTP ${res.status} — ${(await res.text()).slice(0, 140)}`);
      continue;
    }

    const json = (await res.json()) as {
      results?: { url: string; final_url?: string; text?: unknown; links?: string[];
                  etag?: string; last_modified?: string; not_modified?: boolean }[];
      errors?: { url: string; error: string; status?: number }[];
    };

    for (const e of json.errors ?? []) {
      await sql`insert into catalog.crawl_pages ${sql({
        url: urlKey(e.url), status: "error", error: `${e.error}${e.status ? ` (${e.status})` : ""}`,
        topic: opts.topic ?? null, kind: opts.kind ?? "detail", source_id: opts.sourceId ?? null,
        fetched_at: new Date(),
      })} on conflict (url) do update set status = excluded.status, error = excluded.error, fetched_at = excluded.fetched_at`;
    }

    for (const r of json.results ?? []) {
      const k = urlKey(r.url);
      const previous = have.get(k);
      if (r.not_modified && previous) {
        await sql`update catalog.crawl_pages set fetched_at = now(), status = 'ok' where url = ${k}`;
        out.set(k, { ...previous, fresh: true, changed: false });
        continue;
      }
      const markdown = scrub(typeof r.text === "string" ? r.text : JSON.stringify(r.text ?? ""));
      const hash = markdown.trim() ? await sha256(markdown) : null;
      const changed = !previous || previous.content_hash !== hash;
      const row = {
        url: k,
        final_url: r.final_url ?? r.url,
        markdown,
        links: (r.links ?? []).map(scrub),
        content_hash: hash,
        bytes: markdown.length,
        etag: r.etag ?? null,
        last_modified: r.last_modified ?? null,
        status: markdown.trim() ? "ok" : "empty",
        error: null,
        topic: opts.topic ?? null,
        kind: opts.kind ?? "detail",
        source_id: opts.sourceId ?? null,
        fetched_at: new Date(),
      };
      await sql`insert into catalog.crawl_pages ${sql(row)}
        on conflict (url) do update set ${sql(row)}`;
      out.set(k, {
        url: k, final_url: row.final_url, markdown, links: row.links, content_hash: hash,
        status: row.status as Page["status"], fetched_at: row.fetched_at, fresh: true, changed,
      });
    }
  }
  return out;
}

/** Record that a model has read this page's current content, and which one. */
export async function markDerived(sql: Sql, url: string, model?: string): Promise<void> {
  await sql`update catalog.crawl_pages
            set derived_at = now(), derived_model = coalesce(${model ?? null}, derived_model)
            where url = ${urlKey(url)}`;
}
