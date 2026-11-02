import type { Sql } from "postgres";
import puppeteer, { type Browser } from "puppeteer";
import { anthropic } from "./anthropic";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z, type ZodType } from "zod";
import type { Crawler, SourceRow, EngineUsed } from "./types";
import { fetchPages as fetchIntoStore } from "./pages";

// ── TinyFish Fetch + Claude: the default engine ───────────────────────────
// Fetch (free, 150 URLs/min per key) turns a URL into markdown; Claude returns
// the crawler's Zod schema via structured outputs, validated by the API.

// Cheapest models that do the job: selection is classification, extraction one
// tier up. Override with CRAWL_SELECT_MODEL / CRAWL_EXTRACT_MODEL or extraction.model.
const SELECT_MODEL = process.env.CRAWL_SELECT_MODEL ?? "claude-haiku-4-5";
const EXTRACT_MODEL = process.env.CRAWL_EXTRACT_MODEL ?? "claude-sonnet-5";

/** Thinking and effort are 4.6+ parameters; Haiku 4.5 rejects both. */
function reasoningParams(model: string) {
  return model.startsWith("claude-haiku")
    ? {}
    : { thinking: { type: "adaptive" as const }, effort: true };
}

/** Read a page through the raw layer (stored if fresh), so `catalog:derive` can replay offline. */
async function fetchMarkdown(
  sql: Sql, url: string, source?: SourceRow,
): Promise<{ markdown: string; links: string[]; changed: boolean }> {
  const pages = await fetchIntoStore(sql, [url], {
    topic: source?.topic, kind: "index", sourceId: source?.id,
  });
  const page = [...pages.values()][0];
  if (!page || page.status !== "ok" || !page.markdown.trim())
    throw new Error(page?.status === "error" ? "fetch error" : "Fetch returned empty content");
  return { markdown: page.markdown, links: page.links, changed: page.changed };
}

/** Ask Claude for the crawler's schema from page markdown. Streamed, since long pages are large. */
async function extractWithClaude(
  markdown: string, schema: ZodType, url: string, instructions?: string,
  modelOverride?: string, links?: string[],
): Promise<unknown> {
  const client = anthropic(); // reads ANTHROPIC_API_KEY / an `ant` profile, plus ANTHROPIC_WORKSPACE_ID
  const model = modelOverride ?? EXTRACT_MODEL;
  const r = reasoningParams(model);
  const stream = client.messages.stream({
    model,
    max_tokens: 32_000,
    ...(r.thinking ? { thinking: r.thinking } : {}),
    output_config: {
      format: zodOutputFormat(schema, "extraction"),
      ...(r.effort ? { effort: "medium" as const } : {}),
    },
    system:
      "You extract structured records from web pages for a music-funding catalogue.\n" +
      "Rules, in order of importance:\n" +
      "1. NEVER invent a value. If the page does not state a field, omit it or return null.\n" +
      "2. Copy dates, amounts, and names EXACTLY as written, in the page's own language.\n" +
      "3. Return every matching item on the page, not just the first few." +
      (instructions ? `\n4. ${instructions}` : ""),
    messages: [
      {
        role: "user",
        content:
          `Source URL: ${url}\n\nPage content:\n\n${markdown}` +
          // Fetch returns links separately from the markdown; without them every
          // program_url comes back null.
          (links?.length
            ? `\n\nLinks present on this page (match each item to its own link where one exists; ` +
              `do not guess, leave the field null if no link clearly belongs to it):\n${links.slice(0, 400).join("\n")}`
            : ""),
      },
    ],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal")
    throw new Error(`Claude refused: ${message.stop_details?.category ?? "unknown"}`);
  const parsed = message.content.find((b) => b.type === "text");
  return parsed && "parsed" in parsed ? parsed.parsed : JSON.parse((parsed as { text: string })?.text ?? "null");
}


// ── Two-hop: index → its links → each program's own page ──────────────────
// JS-rendered listings return little prose but many links, and a program's own
// page is where amounts, deadlines and eligibility live.
const PAGE_BATCH = 6;         // program pages per extraction call
const DEFAULT_MAX_PAGES = 40; // cost ceiling per source; overridable per row

const LINKS_SCHEMA = z.object({
  urls: z.array(z.string()).describe("Absolute URLs of individual funding program pages"),
});

/** Hop one: which of this index's links are individual program pages? */
async function selectEntryLinks(
  markdown: string, links: string[], url: string, instructions?: string,
): Promise<string[]> {
  const client = anthropic();
  const r = reasoningParams(SELECT_MODEL);
  const stream = client.messages.stream({
    model: SELECT_MODEL,
    max_tokens: 8_000,
    ...(r.thinking ? { thinking: r.thinking } : {}),
    output_config: {
      format: zodOutputFormat(LINKS_SCHEMA, "links"),
      ...(r.effort ? { effort: "low" as const } : {}),
    },
    system:
      "You identify which links on an index page lead to the INDIVIDUAL entries it lists.\n" +
      "Include: one link per distinct entry (a service, a plan, an outlet, a program).\n" +
      "Exclude: navigation, login, news, contact, PDFs, social media, language toggles, " +
      "and pages about the organization rather than an entry.\n" +
      "Return absolute URLs, copied exactly. Return an empty list if none qualify." +
      (instructions ? `\nContext: ${instructions}` : ""),
    messages: [{ role: "user", content: `Index page: ${url}\n\nPage text:\n${markdown.slice(0, 30_000)}\n\nLinks found on the page:\n${links.join("\n")}` }],
  });
  const message = await stream.finalMessage();
  const block = message.content.find((b) => b.type === "text");
  const parsed = block && "parsed" in block ? (block.parsed as { urls?: string[] }) : null;
  return (parsed?.urls ?? []).filter((u) => /^https?:\/\//.test(u));
}

/** Fetch many URLs, in Fetch's batch size, tolerating per-URL failures. */
async function fetchMany(sql: Sql, urls: string[], source: SourceRow): Promise<{ url: string; text: string }[]> {
  const pages = await fetchIntoStore(sql, urls, {
    topic: source.topic, kind: "detail", sourceId: source.id,
  });
  return [...pages.values()]
    .filter((p) => p.status === "ok" && p.markdown.trim())
    .map((p) => ({ url: p.final_url ?? p.url, text: p.markdown }));
}

/**
 * The whole two-hop pass. Returns the same `{ programs: [...] }` shape the
 * one-hop engine returns, so the crawler's mapper is unchanged.
 */
async function fetchFollowingLinks(
  sql: Sql, source: SourceRow, schema: ZodType,
  instructions?: string, maxPages?: number, model?: string,
): Promise<unknown> {
  const index = await fetchMarkdown(sql, source.url, source);
  const links = index.links;
  if (!links.length) throw new Error("index page returned no links to follow");

  const selected = await selectEntryLinks(index.markdown, links, source.url, instructions);
  if (!selected.length) throw new Error("no entry links identified on the index");

  const cap = maxPages ?? DEFAULT_MAX_PAGES;
  const capped = selected.slice(0, cap);
  if (selected.length > cap)
    console.warn(`  [${source.id}] ${selected.length} entry links found, crawling first ${cap} (raise extraction.maxPages)`);
  console.log(`  [${source.id}] index → ${links.length} links → ${capped.length} program pages`);

  const pages = await fetchMany(sql, capped, source);
  const programs: unknown[] = [];
  for (let i = 0; i < pages.length; i += PAGE_BATCH) {
    const batch = pages[i] ? pages.slice(i, i + PAGE_BATCH) : [];
    const combined = batch
      .map((p) => `<page url="${p.url}">\n${p.text.slice(0, 40_000)}\n</page>`)
      .join("\n\n");
    const extracted = (await extractWithClaude(
      combined, schema, source.url,
      (instructions ? instructions + " " : "") +
      "Each <page> is ONE program's own page: return one entry per page, and set program_url to that page's url attribute.",
      model,
    )) as { programs?: unknown[] } | null;
    programs.push(...(extracted?.programs ?? []));
  }
  return { programs };
}

// ── TinyFish agent sessions: for pages Fetch cannot see ───────────────────
// TinyFish agent API (SSE). Not AgentQL: same company, different keys.
// The row's `tinyfishQuery` is the output shape; `browserProfile` is 'lite'
// (default) or 'stealth' for WAF/JS-walled hosts.
const TINYFISH_SSE_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";
const TINYFISH_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Exported for `<topic>/enrich.ts`. The only engine past hosts that 403 a plain
 * fetch, and it extracts on its own, so it works without Anthropic credit.
 */
export async function tinyfish(
  url: string,
  query: string,
  profile?: string,
  instructions?: string,
  timeoutMs?: number,
): Promise<unknown> {
  const key = process.env.TINYFISH_API_KEY;
  if (!key) throw new Error("TINYFISH_API_KEY not set");
  const goal =
    "Extract structured data from this page. Return ONLY a JSON object with exactly this shape:\n" +
    `${query}\n` +
    "One array entry per item listed on the page. Omit or null any field the page does not state — never invent a value." +
    (instructions ? `\n${instructions}` : "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? TINYFISH_TIMEOUT_MS);
  try {
    const res = await fetch(TINYFISH_SSE_URL, {
      method: "POST",
      headers: { "X-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ url, goal, ...(profile ? { browser_profile: profile } : {}) }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`TinyFish HTTP ${res.status}: ${await res.text()}`);
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body from TinyFish");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let raw: Record<string, unknown>;
        try {
          raw = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        const type = raw.type ?? raw.event;
        if (type === "ERROR") throw new Error(`TinyFish error: ${raw.error ?? JSON.stringify(raw)}`);
        if (type !== "COMPLETE") continue;
        if (String(raw.status ?? "").toUpperCase() !== "COMPLETED")
          throw new Error(`TinyFish run failed: ${raw.error ?? "unknown"}`);
        // Field name varies across SDK versions; a string payload is quoted JSON.
        const result = raw.resultJson ?? raw.result_json ?? raw.result ?? null;
        if (typeof result === "string") {
          try {
            return JSON.parse(result);
          } catch {
            return result;
          }
        }
        return result;
      }
    }
    throw new Error("TinyFish stream ended without a COMPLETE event");
  } finally {
    clearTimeout(timer);
    controller.abort(); // frees the TinyFish browser session
  }
}

// ── Puppeteer — the fallback engine (shared browser per run) ────────────────
let _browser: Browser | null = null;
/** The one browser per run, shared rather than launching a second Chromium. */
export async function browser(): Promise<Browser> {
  if (!_browser) {
    _browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return _browser;
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}

/**
 * Extract one source: Fetch, then TinyFish agent (if opted in), then Puppeteer.
 * Config comes from the source row (`extraction`), so fixing a query is an
 * UPDATE; Puppeteer handlers stay in code.
 */
export async function extractFromSource(
  sql: Sql,
  source: SourceRow,
  crawler: Crawler,
): Promise<{ engine: EngineUsed; extracted: unknown }> {
  const x = source.extraction ?? {};
  const query = x.tinyfishQuery as string | undefined;
  const instructions = x.instructions as string | undefined;
  const timeoutMs = x.timeoutMs as number | undefined;
  // Default is the free engine; extraction.engine = 'agent' opts into billed browsing.
  const wants = (x.engine as string | undefined) ?? "fetch";

  // 1) Fetch + Claude. Needs the crawler's schema. followLinks walks to each
  //    program's own page, the free way to read a JS-rendered listing.
  if (wants === "fetch" && crawler.schema && process.env.TINYFISH_API_KEY) {
    try {
      const extracted = x.followLinks
        ? await fetchFollowingLinks(
            sql, source, crawler.schema, instructions,
            x.maxPages as number | undefined, x.model as string | undefined,
          )
        : await (async () => {
            const page = await fetchMarkdown(sql, source.url, source);
            // A card-grid index renders as headings only; extracting it yields
            // names and nulls, so walk the links instead.
            const headingsOnly =
              page.markdown.length < 2_500 &&
              (page.markdown.match(/^#{2,3} /gm) ?? []).length >= 4 &&
              page.links.length > 5;
            if (headingsOnly) {
              console.log(`  [${source.id}] index is headings-only — following links instead`);
              return fetchFollowingLinks(
                sql, source, crawler.schema, instructions,
                x.maxPages as number | undefined, x.model as string | undefined,
              );
            }
            return extractWithClaude(
              page.markdown, crawler.schema, source.url,
              instructions, x.model as string | undefined, page.links,
            );
          })();
      return { engine: "fetch", extracted };
    } catch (e) {
      // Never fall through to the billed agent engine; that must be opted into.
      // Puppeteer is free and local, so it is still tried.
      console.warn(`  [${source.id}] fetch engine failed: ${(e as Error).message}`);
      const viaBrowser = await tryPuppeteer(source, crawler);
      if (viaBrowser) return viaBrowser;
      console.warn(`  [${source.id}] set extraction.engine='agent' if this page truly needs a browser session`);
      return { engine: "none", extracted: null };
    }
  }

  // 2) TinyFish agent session — bills the wallet, browses and clicks.
  if (query && process.env.TINYFISH_API_KEY) {
    try {
      return {
        engine: "tinyfish",
        extracted: await tinyfish(
          source.url, query, x.browserProfile as string | undefined, instructions, timeoutMs,
        ),
      };
    } catch (e) {
      console.warn(`  [${source.id}] tinyfish failed, falling back to puppeteer: ${(e as Error).message}`);
    }
  }

  // 3) Puppeteer fallback
  return (await tryPuppeteer(source, crawler)) ?? { engine: "none", extracted: null };
}

/**
 * The hand-written Puppeteer fallback; null when the source has no handler.
 * Catches its own errors: the browser is shared, so one bad `goto` must not
 * take other sources with it.
 */
async function tryPuppeteer(
  source: SourceRow,
  crawler: Crawler,
): Promise<{ engine: EngineUsed; extracted: unknown } | null> {
  const fallback = crawler.puppeteer?.[source.id];
  if (!fallback) return null;
  const page = await (await browser()).newPage();
  try {
    await page.goto(source.url, { waitUntil: "networkidle2", timeout: 60_000 });
    return { engine: "puppeteer", extracted: await fallback(page) };
  } catch (e) {
    console.warn(`  [${source.id}] puppeteer fallback failed: ${(e as Error).message}`);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * Does this row's own page still exist? Only 404/410 count as dead; a timeout
 * or 403 is inconclusive, not evidence the program ended.
 */

export async function stillLive(url: string): Promise<boolean | null> {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(20_000) });
    if (res.status === 404 || res.status === 410) return false;
    if (res.ok) return true;
    return null; // 403/429/5xx — inconclusive, do not count against the row
  } catch {
    return null; // network error / timeout — inconclusive
  }
}
