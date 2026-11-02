/**
 * The artist's data as model-callable tools. Calls the same openArtist() /
 * openCatalog() / buildBrief() as the CLI, in-process rather than shelling out.
 * Each AGENT.md `data:` block becomes a z.enum, so undeclared tables are refused by schema.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { tool } from "ai";
import { z } from "zod";
import { openArtist, isArtistOwned, type Artist } from "../data/artist/client";
import { buildBrief, renderBrief } from "../data/artist/brief/rules";
import { openCatalog, type Catalog } from "../data/catalog/client";
import { readKnowledge, type Department } from "./agent";
import type { Config } from "./config";
import { reconcile } from "../agents/digital-marketing/skills/digital-marketing-plan/scripts/reconcile-budget";
import { buildGoogleTools } from "./google/tools";
import { buildBufferTools } from "./buffer/tools";
import { buildHunterTools } from "./hunter/tools";
import { makeVariants } from "../agents/digital-marketing/skills/digital-marketing-draft-content/scripts/variants";

/** Connections opened once per conversation, not once per tool call. */
export interface Session {
  artist(): Promise<Artist>;
  catalog(): Promise<Catalog>;
  close(): Promise<void>;
}

/**
 * The brief for one department, read once and put in the system prompt.
 * Never throws: a down database means less context, not no conversation.
 */
export async function readBriefFor(dept: string, session: Session): Promise<string> {
  try {
    return renderBrief(await buildBrief(await session.artist(), dept, {}));
  } catch {
    return "";
  }
}

/**
 * The campaign's tasks as a dated list, or null when there is nothing to show.
 * Exported because session.ts prints it after a turn that wrote tasks, so the
 * plan reaches the screen without the model choosing to show it.
 */
export async function renderPlan(artist: Artist, campaignId: string): Promise<string | null> {
  const [c] = await artist.query<Record<string, unknown>>("marketing_campaigns", { id: campaignId });
  if (!c) return null;
  const rows = await artist.query<Record<string, unknown>>(
    "marketing_tasks",
    { campaign_id: campaignId },
    { orderBy: "sort_order asc" },
  );
  if (!rows.length) return null;

  const day = (v: unknown) => String(v instanceof Date ? v.toISOString().slice(0, 10) : v ?? "").slice(0, 10);
  const lines = rows.map((r) => {
    const cost = Number(r.estimated_cost ?? 0);
    const where = (r.platforms as string[])?.length ? ` → ${(r.platforms as string[]).join(", ")}` : "";
    const money = cost > 0 ? `  $${cost}` : "";
    const time = r.posting_time ? ` ${String(r.posting_time).slice(0, 5)}` : "";
    return `${day(r.due_date)}${time}  ${String(r.task_type).padEnd(9)} ${r.title}${where}${money}`;
  });
  const spend = rows.reduce((n, r) => n + Number(r.estimated_cost ?? 0), 0);
  return (
    `${c.title} — ${rows.length} tasks, ${day(rows[0]!.due_date)} to ${day(rows[rows.length - 1]!.due_date)}, ` +
    `$${spend} of $${c.budget ?? 0}\n\n${lines.join("\n")}`
  );
}

/**
 * Reconcile campaign costs after any turn that touched the plan, so totals
 * do not depend on the model calling `reconcile_budget`.
 */
export async function reconcileIfNeeded(artist: Artist, campaignId: string): Promise<void> {
  const [c] = await artist.query<Record<string, unknown>>("marketing_campaigns", { id: campaignId });
  if (!c) return;
  const rows = await artist.query<Record<string, unknown>>("marketing_tasks", { campaign_id: campaignId });
  if (!rows.length) return;

  const budget = c.budget == null ? null : Number(c.budget);
  const result = reconcile(
    { tasks: rows.map((r) => ({ id: String(r.id), title: String(r.title ?? ""), estimated_cost: Number(r.estimated_cost ?? 0) })) },
    budget !== null && Number.isFinite(budget) ? budget : null,
  );

  for (const t of result.plan.tasks) {
    const row = rows.find((r) => String(r.id) === t.id);
    if (!row || Number(t.estimated_cost ?? 0) === Number(row.estimated_cost ?? 0)) continue;
    await artist.upsert("marketing_tasks", { ...row, estimated_cost: t.estimated_cost ?? 0 }, ["id"]);
  }
  if (Number(c.total_estimated_cost ?? -1) !== Number(result.plan.total_estimated_cost ?? 0)) {
    await artist.upsert("marketing_campaigns", { ...c, total_estimated_cost: result.plan.total_estimated_cost ?? 0 }, ["id"]);
  }
}

/** The campaign a turn just touched, so the engine knows what to print. */
export async function latestCampaignId(artist: Artist): Promise<string | null> {
  const [c] = await artist.query<{ id: string }>("marketing_campaigns", {}, {
    orderBy: "updated_at desc",
    limit: 1,
  });
  return c?.id ?? null;
}

/** The content menu as a numbered list, or null when there is nothing to show. */
export async function renderIdeas(
  artist: Artist,
  campaignId: string,
  only: "all" | "suggested" | "selected" = "all",
): Promise<string | null> {
  const rows = await artist.query<Record<string, unknown>>(
    "marketing_ideas",
    only === "all" ? { campaign_id: campaignId } : { campaign_id: campaignId, status: only },
    { orderBy: "n asc", limit: 300 },
  );
  if (!rows.length) return null;

  const MARK: Record<string, string> = { selected: "[x]", rejected: "[-]", planned: "[✓]", suggested: "[ ]" };
  const EFFORT: Record<string, string> = { low: "quick", normal: "", shoot: "SHOOT" };
  const byCat = new Map<string, Record<string, unknown>[]>();
  for (const r of rows) {
    const k = String(r.category ?? "other");
    byCat.set(k, [...(byCat.get(k) ?? []), r]);
  }

  const out: string[] = [];
  for (const [cat, list] of byCat) {
    out.push(`\n${cat.replaceAll("_", " ").toUpperCase()}`);
    for (const r of list) {
      const eff = EFFORT[String(r.effort)] ? `  (${EFFORT[String(r.effort)]})` : "";
      const fmt = r.format ? ` · ${r.format}` : "";
      out.push(`${MARK[String(r.status)] ?? "[ ]"} ${String(r.n).padStart(2)}. ${r.title}${fmt}${eff}`);
      if (r.hook) out.push(`       hook: ${r.hook}`);
    }
  }
  const sel = rows.filter((r) => r.status === "selected" || r.status === "planned").length;
  return `${rows.length} ideas · ${sel} picked${out.join("\n")}`;
}

export function openSession(): Session {
  let artist: Artist | null = null;
  let catalog: Catalog | null = null;
  return {
    async artist() {
      artist ??= await openArtist();
      return artist;
    },
    async catalog() {
      catalog ??= await openCatalog();
      return catalog;
    },
    async close() {
      await artist?.close().catch(() => {});
      await catalog?.close().catch(() => {});
    },
  };
}

const rows = (r: Record<string, unknown>[], empty: string) =>
  r.length ? r.map((x) => JSON.stringify(x)).join("\n") : empty;

/**
 * Every tool this department gets, and no others. Undeclared catalog tables or
 * `network:` entries mean the tool is absent, not present-but-refusing.
 * Network tools are specific scripts, never a generic fetch.
 */
const NETWORK_TOOLS: Record<string, (cfg: Config) => ReturnType<typeof tool>> = {
  bandcamp_discography: (_cfg) =>
    tool({
      description:
        "Read every release off an artist's Bandcamp page — titles, years, cover art. " +
        "Returns CANDIDATES: show them to the artist and save only what they confirm. " +
        "Some Bandcamp pages are rendered by JavaScript and yield nothing; that is " +
        "reported as unreadable, and never as 'the artist has no releases'.",
      inputSchema: z.object({
        url: z.string().describe("The artist's Bandcamp URL, any page on their subdomain."),
      }),
      execute: async ({ url }) => {
        const { scrapeBandcampDiscography } = await import(
          "../agents/presskit/skills/presskit-build/scripts/bandcamp"
        );
        try {
          const releases = await scrapeBandcampDiscography(url);
          if (!releases.length) {
            return "That Bandcamp page returned no releases. It may be a JavaScript-rendered custom page — ask the artist to list their releases instead. Do NOT report that they have none.";
          }
          return rows(releases as unknown as Record<string, unknown>[], "");
        } catch (e) {
          return `Could not read that Bandcamp page: ${e instanceof Error ? e.message : String(e)}`;
        }
      },
    }),

  find_press: (cfg) =>
    tool({
      description:
        "Search the web for editorial coverage of the artist and verify each link is reachable. " +
        "Returns CANDIDATES for the artist to confirm — a search on a common name returns a " +
        "different person's press, and only the artist can tell. Never save these directly.",
      inputSchema: z.object({
        artist_name: z.string(),
        context: z
          .string()
          .optional()
          .describe("Genre + city + a release title. Essential for a common name."),
      }),
      execute: async ({ artist_name, context }) => {
        const { searchPressCandidates } = await import(
          "../agents/presskit/skills/presskit-build/scripts/search"
        );
        const r = await searchPressCandidates(cfg, artist_name, { extraContext: context });
        if (r.unsupported) {
          return "This artist's model provider has no web search. Ask them to paste article URLs instead.";
        }
        if (!r.candidates.length) return "No reachable editorial coverage found.";
        return rows(r.candidates as unknown as Record<string, unknown>[], "");
      },
    }),

  shows_from_poster: (cfg) =>
    tool({
      description:
        "Read the shows off a tour poster, show listing or festival lineup image. " +
        "Returns CANDIDATES for the artist to confirm. When the image turns out not to be " +
        "a listing at all, say so and offer to save it as a press photo instead.",
      inputSchema: z.object({
        image_urls: z.array(z.string()).max(4).describe("Up to 4 poster image URLs."),
      }),
      execute: async ({ image_urls }) => {
        const { extractShowsFromImages } = await import(
          "../agents/presskit/skills/presskit-build/scripts/poster"
        );
        const r = await extractShowsFromImages(cfg, image_urls);
        const notes: string[] = [];
        if (r.unreadable.length) notes.push(`Could not fetch: ${r.unreadable.join(", ")}`);
        if (r.notAPoster) {
          notes.push("That image is not a show listing. Offer to save it as a press photo instead.");
        }
        const body = r.shows.length ? rows(r.shows as unknown as Record<string, unknown>[], "") : "";
        return [body, ...notes].filter(Boolean).join("\n");
      },
    }),
};

export function buildTools(dept: Department, session: Session, cfg?: Config) {
  const artistTables = dept.tables.artist;
  const catalogTables = dept.tables.catalog;

  const tools: Record<string, ReturnType<typeof tool>> = {};

  tools.artist_brief = tool({
    description:
      `Everything on file about this artist, already shaped for the ${dept.department} department. ` +
      `Their file is ALREADY in your prompt under "The artist's file" — do not call this to read it at the start of a conversation. ` +
      `Call it only to RE-READ after you have written something, when you need to see the change.`,
    inputSchema: z.object({}),
    execute: async () => {
      const artist = await session.artist();
      const brief = await buildBrief(artist, dept.name, {});
      return renderBrief(brief);
    },
  });

  if (artistTables.length) {
    const table = z.enum(artistTables as [string, ...string[]]);

    tools.artist_get = tool({
      description:
        "Read specific rows from the artist's own database when the brief is not detailed enough. " +
        "Filters are exact matches only.",
      inputSchema: z.object({
        table,
        filter: z.record(z.string(), z.string()).optional().describe('exact matches, e.g. {"status":"pitched"}'),
        orderBy: z.string().optional().describe('one column, e.g. "release_date desc"'),
        limit: z.number().int().positive().max(200).optional(),
      }),
      execute: async ({ table: t, filter, orderBy, limit }) => {
        const artist = await session.artist();
        const out = await artist.query(t, filter ?? {}, { orderBy, limit: limit ?? 50 });
        return rows(out, `(nothing in artist.${t} matching that)`);
      },
    });

    // The profile is readable but absent from the write enum. A department
    // whose only artist table is the profile gets no write tool at all.
    const writable = artistTables.filter((t) => !isArtistOwned(t));
    if (writable.length) {
    tools.artist_set = tool({
      description:
        "Save something the artist just told you, into their own database. Write it the moment they say it — " +
        "acknowledging a fact in prose without saving it means asking for it again next week. " +
        "Their profile is not here: it is theirs to edit with `houselabel profile`, so if what they told you " +
        "belongs on it, say so and move on. Nor is their voice — how they write — which is `houselabel voice`.",
      inputSchema: z.object({
        table: z.enum(writable as [string, ...string[]]),
        row: z.record(z.string(), z.unknown()).describe("the columns to write"),
        conflict: z
          .array(z.string())
          .optional()
          .describe('the natural key, e.g. ["id"] for single-row tables. Omit to insert a new row.'),
      }),
      execute: async ({ table: t, row, conflict }) => {
        // `marketing_campaigns` has no natural key, so with no explicit
        // `conflict`, a titled row matches on title to avoid duplicates.
        if (!conflict?.length) {
          const r = row as Record<string, unknown>;
          const title = typeof r.title === "string" ? r.title.trim() : "";
          if (title) {
            const [existing] = await (await session.artist()).query<{ id: string }>(t, { title });
            if (existing?.id) conflict = ["id"], (r as Record<string, unknown>).id = existing.id;
          }
        }
        const artist = await session.artist();
        const out = await artist.upsert(t, row as Record<string, unknown>, conflict ?? []);
        return `✓ wrote artist.${t}\n${JSON.stringify(out)}`;
      },
    });
    }
  }

  tools.artist_remember = tool({
    description:
      `Remember one reusable fact for the ${dept.department} department — something worth having next time, ` +
      "not a row of structured data. Use it for answers, preferences, and things the artist has ruled out.",
    inputSchema: z.object({
      key: z.string().describe('short slug, e.g. "rejected_angles"'),
      value: z.string(),
      kind: z.enum(["fact", "answer", "history"]).optional(),
    }),
    execute: async ({ key, value, kind }) => {
      const artist = await session.artist();
      await artist.remember(dept.name, key, value, { kind });
      return `✓ remembered: ${key}`;
    },
  });

  // ── budget arithmetic, as a tool ──
  // Same function as reconcile-budget.ts, called in-process: the model has no shell.
  if (artistTables.includes("marketing_campaigns") && artistTables.includes("marketing_tasks")) {
    tools.reconcile_budget = tool({
      description:
        "Make a campaign's task costs sum to the artist's stated budget, and set its total. " +
        "Run this after writing or changing ANY task cost — it is the only sum that counts. " +
        "Scales an over-budget plan proportionally, zeroes every task when the budget is $0, " +
        "and when no budget was captured sets the total to the real sum rather than inventing one. " +
        "Never add the costs up yourself.",
      inputSchema: z.object({
        campaign_id: z.string().describe("The campaign whose tasks to reconcile."),
      }),
      execute: async ({ campaign_id }) => {
        const artist = await session.artist();
        const [campaign] = await artist.query<{ budget: string | number | null; title: string }>(
          "marketing_campaigns",
          { id: campaign_id },
        );
        if (!campaign) return `No campaign with id ${campaign_id}.`;

        // Full rows: upsert is INSERT ... ON CONFLICT, so a partial row fails
        // NOT NULL columns before the conflict clause is reached.
        const rows = await artist.query<Record<string, unknown>>(
          "marketing_tasks",
          { campaign_id },
          { orderBy: "sort_order asc" },
        );

        const budget = campaign.budget == null ? null : Number(campaign.budget);
        const result = reconcile(
          {
            tasks: rows.map((r) => ({
              id: String(r.id),
              title: String(r.title ?? ""),
              estimated_cost: Number(r.estimated_cost ?? 0),
            })),
          },
          budget !== null && Number.isFinite(budget) ? budget : null,
        );

        // Only rows whose cost moved, to avoid no-op updated_at bumps.
        let touched = 0;
        for (const t of result.plan.tasks) {
          const row = rows.find((r) => String(r.id) === t.id);
          if (!row) continue;
          if (Number(t.estimated_cost ?? 0) === Number(row.estimated_cost ?? 0)) continue;
          await artist.upsert("marketing_tasks", { ...row, estimated_cost: t.estimated_cost ?? 0 }, ["id"]);
          touched += 1;
        }

        const [campaignRow] = await artist.query<Record<string, unknown>>("marketing_campaigns", { id: campaign_id });
        await artist.upsert(
          "marketing_campaigns",
          { ...campaignRow, total_estimated_cost: result.plan.total_estimated_cost ?? 0 },
          ["id"],
        );

        return (
          `${result.note}\n` +
          `Tasks summed $${result.before} before, $${result.after} after; ${touched} task cost(s) changed. ` +
          `total_estimated_cost is now $${result.plan.total_estimated_cost}. ` +
          `Tell the artist what came down and what the new total is — never hand back a scaled plan as if it were the one they asked for.`
        );
      },
    });
    // ── content menu ──
    tools.show_ideas = tool({
      description:
        "The campaign's content menu as a numbered list, ready to show the artist verbatim. " +
        "Call it after writing ideas and print what it returns. The artist picks by number.",
      inputSchema: z.object({
        campaign_id: z.string(),
        only: z.enum(["all", "suggested", "selected"]).optional()
          .describe("Default all. Use `selected` when building the plan."),
      }),
      execute: async ({ campaign_id, only }) => {
        const plan = await renderIdeas(await session.artist(), campaign_id, only ?? "all");
        return plan ?? `No ideas on campaign ${campaign_id} yet.`;
      },
    });

    // Number selection ("3, 7, 12-15, not 9") is parsed in code, not prose.
    tools.pick_ideas = tool({
      description:
        "Record which content ideas the artist wants. Accepts the numbers they said. " +
        "Everything they did not pick stays `suggested` — it is not rejected, and it is not planned either.",
      inputSchema: z.object({
        campaign_id: z.string(),
        selected: z.array(z.number()).describe("The numbers they picked."),
        rejected: z.array(z.number()).optional().describe("Numbers they explicitly ruled out."),
      }),
      execute: async ({ campaign_id, selected, rejected }) => {
        const artist = await session.artist();
        const rows = await artist.query<Record<string, unknown>>("marketing_ideas", { campaign_id });
        const byN = new Map(rows.map((r) => [Number(r.n), r]));
        const miss: number[] = [];
        let sel = 0;
        let rej = 0;
        for (const n of selected) {
          const r = byN.get(n);
          if (!r) { miss.push(n); continue; }
          await artist.upsert("marketing_ideas", { ...r, status: "selected" }, ["id"]);
          sel += 1;
        }
        for (const n of rejected ?? []) {
          const r = byN.get(n);
          if (!r) { miss.push(n); continue; }
          await artist.upsert("marketing_ideas", { ...r, status: "rejected" }, ["id"]);
          rej += 1;
        }
        const still = rows.length - sel - rej;
        return (
          `${sel} selected, ${rej} rejected, ${still} left unruled.` +
          (miss.length ? ` No idea numbered ${miss.join(", ")}.` : "") +
          ` Build the plan from the SELECTED ones only — an unruled idea is not a yes.`
        );
      },
    });

    // ── plan ──
    // Rendering is code; the model shows what it returns.
    tools.show_plan = tool({
      description:
        "The campaign's tasks as a dated list, ready to show the artist verbatim. " +
        "ALWAYS call this after writing or changing a plan, and print what it returns — " +
        "never describe the plan in prose instead. A paragraph about a plan is not a plan.",
      inputSchema: z.object({
        campaign_id: z.string().describe("The campaign to render."),
      }),
      execute: async ({ campaign_id }) => {
        const plan = await renderPlan(await session.artist(), campaign_id);
        return plan ?? `Nothing to show for campaign ${campaign_id}.`;
      },
    });
  }

  if (catalogTables.length) {
    tools.catalog_search = tool({
      description:
        "Search the label's own research catalog — the crawled, curated data this department works from. " +
        "This is OUR data about the industry, not the artist's data.",
      inputSchema: z.object({
        table: z.enum(catalogTables as [string, ...string[]]),
        filter: z.record(z.string(), z.string()).optional().describe('exact matches, e.g. {"country":"CA"}'),
        limit: z.number().int().positive().max(200).optional(),
      }),
      execute: async ({ table: t, filter, limit }) => {
        const catalog = await session.catalog();
        const out = await catalog.query(t, filter ?? {}, limit ?? 50);
        const note = catalog.info.completeness[t];
        const caveat =
          note === "partial"
            ? `\n\n(this dataset is PARTIAL — say "here is what I found", never "these are all of them")`
            : "";
        return rows(out, `(nothing in catalog.${t} matching that)`) + caveat;
      },
    });
  }

  // The department's `network:` list decides which of these exist.
  if (cfg) {
    for (const name of dept.network ?? []) {
      const build = NETWORK_TOOLS[name];
      if (build) tools[name] = build(cfg);
    }
  }

  // The artist's Google account, for departments whose AGENT.md declares it.
  Object.assign(tools, buildGoogleTools(dept));
  // Outside services from `services:` (Buffer drafts).
  Object.assign(tools, buildBufferTools(dept));
  // Hunter lookups with the artist's own key. Quoted first, spent only on a quote.
  Object.assign(tools, buildHunterTools(dept, session));

  // Crops a task's Drive photo per platform and saves it beside the original.
  // Only for a department that writes the content folders.
  if (
    dept.google.includes("drive") &&
    dept.drive.write.includes("releases/digital-contents") &&
    artistTables.includes("marketing_tasks")
  ) {
    tools.social_variants = tool({
      description:
        "Crop every photo in a campaign task's Drive folder to the shapes its platforms need (4:5 feed, 9:16 " +
        "vertical, 16:9 wide) and save the copies in that folder. Returns one link per copy for " +
        "buffer_draft_post's imageUrls. Re-running makes nothing twice. Photos only.",
      inputSchema: z.object({
        task_id: z.string(),
        format: z.string().optional().describe("reel · story · short · post — decides 9:16 vs 4:5 on Instagram"),
      }),
      execute: async ({ task_id, format }) => {
        const [task] = await (await session.artist()).query<Record<string, unknown>>("marketing_tasks", { id: task_id });
        if (!task) return `No task ${task_id}.`;
        try {
          const { variants, skipped } = await makeVariants({
            drive_folder_url: (task.drive_folder_url as string) ?? null,
            platforms: (task.platforms as string[]) ?? [],
            format: format ?? null,
          });
          if (!variants.length) return "No photo in this task's Drive folder yet. Ask the artist to drop a JPG or PNG in it.";
          return (
            variants.map((v) => `${v.shape}: ${v.url}  (${v.name}${v.created ? "" : ", already made"})`).join("\n") +
            (skipped.length ? `\nNot a photo, left alone: ${skipped.join(", ")}` : "")
          );
        } catch (err) {
          return (err as Error).message;
        }
      },
    });
  }

  if (dept.knowledge.length) {
    tools.read_knowledge = tool({
      description:
        "Open one of this department's knowledge pages, listed in your instructions. " +
        "Read the page before making a claim about how the industry works.",
      inputSchema: z.object({
        file: z.enum(dept.knowledge.map((k) => k.file) as [string, ...string[]]),
      }),
      execute: async ({ file }) => readKnowledge(dept.name, file),
    });
  }

  return tools;
}
