/**
 * Hunter tools for departments whose AGENT.md `services:` names `hunter`:
 * hunter_quote (free) then hunter_find_contacts (spends, saves to artist.contacts).
 * Find takes a quote id, not outlets, so spend can never exceed the quote shown.
 * Nothing here returns the key (see engine/google/store.ts).
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { tool } from "ai";
import { z } from "zod";
import type { Department } from "../agent";
import type { Session } from "../tools";
import { loadKey } from "../google/store";
import { hunterCaller, type HunterCall } from "./client";
import { creditsLeft } from "./index";

/** Written for the artist, because the model will repeat it. */
export const NOT_CONNECTED =
  "No Hunter account is connected. Tell the artist they can run `houselabel connect hunter` in their terminal " +
  "(free plan: 50 credits a month) if they want the people behind generic addresses. Otherwise carry on " +
  "with the catalog emails. Do not attempt this another way.";

/** At most this many outlets per quote — a free month is 50 credits. */
export const MAX_OUTLETS = 10;

/** Mailboxes that reach a desk, not a person. */
const GENERIC_MAILBOX =
  /^(info|contact|contacts|music|musique|press|presse|media|medias|news|nouvelles|redaction|editor|editors|submissions?|soumissions?|programmation|programming|admin|hello|bonjour|general|office|studio|library|musicdirector|md)$/i;

/** Names that stand for a desk, not a person. */
const GENERIC_NAME = /^(rédaction|redaction|submissions?|membership|adhésion|production|music director|newsroom|editors?)\b/i;

/** Domains Hunter cannot search: everyone's inbox lives there. */
const WEBMAIL = /^(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|me|proton|protonmail|videotron|sympatico|bell)\./i;

/** The catalog row a lookup starts from — press_outlets or promotion_radio_stations. Both hold media, never people; `name` is a person only when the artist typed one. */
export interface OutletRow {
  slug: string;
  table: "press_outlets" | "promotion_radio_stations";
  name: string | null;
  outlet: string | null;
  email: string | null;
  website: string | null;
  region: string | null;
  kind: "press" | "radio";
}

export type Lookup =
  | { slug: string; outlet: string; domain: string; method: "email-finder"; person: string; row: OutletRow }
  | { slug: string; outlet: string; domain: string; method: "domain-search"; row: OutletRow }
  | { slug: string; outlet: string; method: "skip"; reason: string };

/** `https://www.ledevoir.com/culture` → `ledevoir.com`. */
export function domainOf(row: Pick<OutletRow, "website" | "email">): string | null {
  try {
    if (row.website) return new URL(row.website.includes("://") ? row.website : `https://${row.website}`).hostname.replace(/^www\./, "");
  } catch {}
  const fromEmail = row.email?.split("@")[1]?.toLowerCase();
  return fromEmail && !WEBMAIL.test(fromEmail) ? fromEmail : null;
}

/**
 * A named person's work address: not a desk mailbox, not webmail. Personal
 * addresses fall under Quebec privacy law and PIPEDA
 * (agents/press/knowledge/outreach-legal.md).
 */
export const isNamedWorkAddress = (email: string | null | undefined) =>
  !!email && email.includes("@") && !GENERIC_MAILBOX.test(email.split("@")[0]!) && !WEBMAIL.test(email.split("@")[1]!);

/** `jane@arts.ledevoir.com` belongs to `ledevoir.com`; `jane@gmail.com` does not. */
const onDomain = (email: string, domain: string) => {
  const host = email.split("@")[1]?.toLowerCase() ?? "";
  return host === domain || host.endsWith(`.${domain}`);
};

const isPerson = (name: string | null) => !!name && !GENERIC_NAME.test(name.trim()) && name.trim().includes(" ");

/**
 * What each outlet needs: a person on file costs nothing, a named journalist
 * is one Email Finder call, a nameless desk is one Domain Search call.
 */
export function planLookups(rows: OutletRow[], alreadySaved: Set<string>): Lookup[] {
  return rows.map((row): Lookup => {
    const outlet = row.outlet ?? row.name ?? row.slug;
    if (alreadySaved.has(row.slug)) return { slug: row.slug, outlet, method: "skip", reason: "already found — in your contacts" };
    if (isNamedWorkAddress(row.email)) return { slug: row.slug, outlet, method: "skip", reason: "the catalog already has a personal email" };
    const domain = domainOf(row);
    if (!domain) return { slug: row.slug, outlet, method: "skip", reason: "no website to search" };
    return isPerson(row.name)
      ? { slug: row.slug, outlet, domain, method: "email-finder", person: row.name!, row }
      : { slug: row.slug, outlet, domain, method: "domain-search", row };
  });
}

/** One credit per lookup, at most — Hunter charges nothing when it finds nothing. */
export const creditsFor = (plan: Lookup[]) => plan.filter((l) => l.method !== "skip").length;

async function defaultCall(): Promise<HunterCall | null> {
  const key = await loadKey("hunter").catch(() => null);
  return key ? hunterCaller(key) : null;
}

/** Every catalog row behind these slugs, from whichever table holds it. */
async function outletsFor(session: Session, slugs: string[]): Promise<{ rows: OutletRow[]; unknown: string[] }> {
  const catalog = await session.catalog();
  const rows: OutletRow[] = [];
  const unknown: string[] = [];
  for (const slug of slugs) {
    const [press] = await catalog.query<Record<string, string | null>>("press_outlets", { slug }, 1);
    if (press) {
      rows.push({
        slug, table: "press_outlets", name: null, outlet: press.outlet ?? null,
        email: press.desk_email ?? null, website: press.website ?? null, region: press.city ?? press.market ?? null,
        kind: "press",
      });
      continue;
    }
    const [station] = await catalog.query<Record<string, string | null>>("promotion_radio_stations", { slug }, 1).catch(() => []);
    if (station) {
      rows.push({
        slug, table: "promotion_radio_stations", name: null, outlet: station.name ?? station.call_sign ?? null,
        email: station.submission_email ?? null, website: station.website ?? null,
        region: station.city ?? station.region ?? null, kind: "radio",
      });
      continue;
    }
    unknown.push(slug);
  }
  return { rows, unknown };
}

interface Found { name: string | null; position: string | null; email: string; confidence: number | null; verification: string | null; sourceUrl: string | null }

/**
 * Hunter's reply → the people in it. Keeps only named work addresses on the
 * outlet's own domain; personal addresses are dropped here, whatever Hunter returned.
 */
export function peopleFrom(method: "email-finder" | "domain-search", data: any, domain: string): Found[] {
  const one = (p: any): Found | null => {
    if (!p?.email && !p?.value) return null;
    const sources: { uri?: string; domain?: string }[] = p.sources ?? [];
    const own = sources.find((s) => s.domain === domain || s.uri?.includes(domain)) ?? sources[0];
    return {
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
      position: p.position ?? null,
      email: String(p.email ?? p.value).toLowerCase(),
      confidence: p.score ?? p.confidence ?? null,
      verification: p.verification?.status ?? null,
      sourceUrl: own?.uri ?? null,
    };
  };
  const all = method === "email-finder" ? [one(data)] : (data?.emails ?? []).map(one);
  return all.filter((p: Found | null): p is Found => !!p && isNamedWorkAddress(p.email) && onDomain(p.email, domain));
}

export function buildHunterTools(
  dept: Pick<Department, "services" | "tables" | "slug">,
  session: Session,
  resolve: () => Promise<HunterCall | null> = defaultCall,
): Record<string, ReturnType<typeof tool>> {
  if (!dept.services.includes("hunter") || !dept.tables.artist.includes("contacts")) return {};

  /** Quotes live for the conversation; find runs one, once. */
  const quotes = new Map<string, Lookup[]>();

  const failed = (err: unknown) =>
    `Hunter said: ${(err as Error).message}. Tell the artist in one sentence; do not retry more than once.`;

  return {
    hunter_quote: tool({
      description:
        "FREE — spends no credit. For the outlets or stations on the artist's shortlist (catalog slugs), says which " +
        "ones Hunter would look up, which it would skip and why, and what it would cost against the credits left. " +
        "Call it once the shortlist for the campaign's region is agreed, then ASK the artist in one sentence — " +
        "\"Want me to use Hunter to find the people at these N outlets? About N of your M credits.\" — and wait.",
      inputSchema: z.object({
        slugs: z.array(z.string()).min(1).max(MAX_OUTLETS).describe("catalog slugs from press_outlets or promotion_radio_stations"),
      }),
      execute: async ({ slugs }) => {
        const call = await resolve();
        if (!call) return NOT_CONNECTED;
        try {
          const artist = await session.artist();
          const saved = new Set(
            (await artist.query<{ catalog_slug: string | null }>("contacts", { source: "hunter" }, { limit: 1000 }))
              .map((r) => r.catalog_slug)
              .filter((s): s is string => !!s),
          );
          const { rows, unknown } = await outletsFor(session, slugs);
          const plan = planLookups(rows, saved);
          const cost = creditsFor(plan);
          const left = creditsLeft(await call("account", {}));
          const id = `q${quotes.size + 1}`;
          quotes.set(id, plan);
          const lines = plan.map((l) =>
            l.method === "skip"
              ? `- ${l.outlet}: skip — ${l.reason}`
              : `- ${l.outlet}: ${l.method === "email-finder" ? `find ${l.person}'s email` : "find the people"} at ${l.domain}`,
          );
          if (unknown.length) lines.push(`- not in the catalog: ${unknown.join(", ")}`);
          return [
            `Quote ${id}: ${cost} lookup${cost === 1 ? "" : "s"}, at most ${cost} credit${cost === 1 ? "" : "s"} ` +
              `(Hunter charges nothing when it finds no one).` +
              (left === null ? "" : ` The artist has ${left} left this month.`),
            ...lines,
            cost === 0
              ? "Nothing to spend. Tell the artist; do not call hunter_find_contacts."
              : left !== null && cost > left
                ? `This is more than the artist has left. Offer the ${left} most important outlets instead, as a new quote — ` +
                  "or, if they need more just this once, one month of Hunter's Starter plan ($49, 2,000 credits), then cancel."
                : `Ask the artist before calling hunter_find_contacts with quote_id "${id}".`,
          ].join("\n");
        } catch (err) {
          return failed(err);
        }
      },
    }),

    hunter_find_contacts: tool({
      description:
        "SPENDS the artist's Hunter credits. Runs one quote from hunter_quote, exactly as quoted, and saves every " +
        "person found to artist.contacts. Call it ONLY after the artist said yes to that quote in this conversation.",
      inputSchema: z.object({ quote_id: z.string().describe("from hunter_quote") }),
      execute: async ({ quote_id }) => {
        const plan = quotes.get(quote_id);
        if (!plan) return `There is no quote ${quote_id}. Call hunter_quote first and ask the artist.`;
        quotes.delete(quote_id); // one quote, one run — a retry cannot spend twice
        const call = await resolve();
        if (!call) return NOT_CONNECTED;
        const artist = await session.artist();
        const out: string[] = [];
        let saved = 0;
        for (const l of plan) {
          if (l.method === "skip") continue;
          try {
            const data =
              l.method === "email-finder"
                ? await call("email-finder", { domain: l.domain, full_name: l.person })
                : await call("domain-search", { domain: l.domain, type: "personal", limit: "5" });
            const people = peopleFrom(l.method, data, l.domain);
            if (!people.length) {
              out.push(`- ${l.outlet}: nobody found — no credit spent`);
              continue;
            }
            for (const p of people) {
              await artist.upsert(
                "contacts",
                {
                  kind: l.row.kind, catalog_slug: l.slug, outlet: l.outlet, domain: l.domain, region: l.row.region,
                  name: p.name, position: p.position, email: p.email, confidence: p.confidence,
                  verification: p.verification, source_url: p.sourceUrl, source: "hunter",
                },
                ["email"],
              );
              saved++;
            }
            out.push(
              `- ${l.outlet}: ${people.map((p) => `${p.name ?? "?"}${p.position ? ` (${p.position})` : ""} <${p.email}>`).join(", ")}`,
            );
          } catch (err) {
            out.push(`- ${l.outlet}: ${failed(err)}`);
          }
        }
        return [`✓ ${saved} contact${saved === 1 ? "" : "s"} saved to the artist's contacts.`, ...out].join("\n");
      },
    }),
  };
}
