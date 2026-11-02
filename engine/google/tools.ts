/**
 * A department's Google tools, chosen by its AGENT.md `google:` line. No tool
 * ever returns a token: outputs are links, counts or sentences.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { tool } from "ai";
import { z } from "zod";
import type { Department } from "../agent";
import { colorFor, listCalendars, sync, targetCalendar, type Dated } from "./calendar";
import { composeUrl, mailtoUrl } from "./gmail";
import { uploadDocument } from "./drive";
import { ensureWorkspaceRoot } from "./workspace";
import { isConfigured } from "./auth";
import { status } from "./store";

/** Returned instead of throwing when Google is not linked. The model repeats it to the artist. */
const NOT_CONNECTED =
  "No Google account is connected. Tell the artist to run `houselabel connect google` in their terminal, " +
  "then try again. Do not attempt this another way.";

async function connected(): Promise<boolean> {
  if (!isConfigured()) return false;
  return (await status()).connected;
}

export function buildGoogleTools(dept: Department): Record<string, ReturnType<typeof tool>> {
  const can = new Set(dept.google);
  if (!can.size) return {};

  const tools: Record<string, ReturnType<typeof tool>> = {};

  tools.google_status = tool({
    description:
      "Whether the artist has linked their Google account, and which one. " +
      "Check this BEFORE promising anything that lands in their Drive or on their calendar.",
    inputSchema: z.object({}),
    execute: async () => {
      if (!isConfigured())
        return "Google is not set up on this machine. `houselabel connect google` walks the artist through it.";
      const s = await status();
      return s.connected
        ? `Connected as ${s.accountEmail ?? "a Google account"}.` +
            (s.settings.calendar_id ? ` Syncing to calendar ${String(s.settings.calendar_id)}.` : "")
        : NOT_CONNECTED;
    },
  });

  if (can.has("calendar")) {
    tools.calendar_list = tool({
      description:
        "The artist's calendars, so they can choose which one this department writes to. " +
        "Ask before creating a new one — most artists already have the calendar they live in.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!(await connected())) return NOT_CONNECTED;
        const cals = await listCalendars();
        return cals.length
          ? cals.map((c) => `${c.id} — ${c.name}${c.primary ? " (primary)" : ""}`).join("\n")
          : "(no calendars on this account)";
      },
    });

    tools.calendar_sync = tool({
      description:
        "Put dated work on the artist's calendar — campaign tasks, release milestones, deadlines. " +
        "Idempotent: pass the SAME id for the same thing every time and it updates in place instead of " +
        "duplicating. The id must be the row's own id from the database, never a new one. " +
        "Set active:false for something cancelled or done, and its event is removed.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              id: z.string().describe("the database row's id — this is what makes re-running safe"),
              title: z.string(),
              date: z.string().describe("YYYY-MM-DD"),
              description: z.string().optional(),
              active: z.boolean().optional().describe("false removes the event"),
            }),
          )
          .min(1)
          .max(200),
        calendarId: z.string().optional().describe("omit to use the one the artist already chose"),
      }),
      execute: async ({ items, calendarId }) => {
        if (!(await connected())) return NOT_CONNECTED;
        const bad = items.find((i) => !/^\d{4}-\d{2}-\d{2}$/.test(i.date));
        if (bad) return `"${bad.date}" is not a date. Every item needs YYYY-MM-DD.`;

        const target = calendarId ?? (await targetCalendar());
        const color = colorFor(dept.name);
        const counts = await sync(
          target,
          items.map((i): Dated => ({ ...i, colorId: color })),
        );
        return (
          `✓ calendar ${target}: ${counts.created} added, ${counts.updated} updated, ${counts.deleted} removed. ` +
          "Tell the artist it is on their calendar and that re-running will not duplicate it."
        );
      },
    });
  }

  if (can.has("drive")) {
    tools.drive_upload = tool({
      description:
        "Put a finished document in the artist's own Google Drive, in a folder called House Label, and get a " +
        "shareable link back. For things the artist sends onward — a one-sheet, a plan, a tracking list. " +
        "The file is theirs; this app can only see files it created.",
      inputSchema: z.object({
        name: z.string().describe("the filename the artist will see"),
        content: z.string().describe("the full document text"),
        format: z.enum(["html", "markdown", "text", "csv"]).default("html"),
      }),
      execute: async ({ name, content, format }) => {
        if (!(await connected())) return NOT_CONNECTED;
        const mime = {
          html: "text/html",
          markdown: "text/markdown",
          text: "text/plain",
          csv: "text/csv",
        }[format];
        const folderId = await ensureWorkspaceRoot();
        if (!folderId) return NOT_CONNECTED;
        const file = await uploadDocument({
          name,
          mimeType: mime,
          body: Buffer.from(content, "utf8"),
          folderId,
        });
        return `✓ in their Drive: ${file.url}`;
      },
    });
  }

  if (can.has("gmail")) {
    tools.gmail_draft = tool({
      description:
        "Turn a finished email into a link that opens it, prefilled, in the artist's own mail. " +
        "This SENDS NOTHING and needs no connected account — the artist reads it, edits it, and presses send. " +
        "Give them the link and say plainly that nothing has gone out yet.",
      inputSchema: z.object({
        to: z.string().describe("one address, or several separated by commas"),
        subject: z.string(),
        body: z.string().describe("the full email, exactly as it should read"),
      }),
      execute: async ({ to, subject, body }) => {
        const draft = { to, subject, body };
        return (
          `Gmail: ${composeUrl(draft)}\n` +
          `Other mail apps: ${mailtoUrl(draft)}\n\n` +
          "Nothing has been sent. Say so."
        );
      },
    });
  }

  return tools;
}
