/**
 * Buffer tools for departments whose AGENT.md `services:` names `buffer`.
 * Drafts only: `buffer_draft_post` always sends `saveToDraft: true`, and that
 * argument is not in the model's schema. Nothing here returns the key
 * (see engine/google/store.ts).
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { tool } from "ai";
import { z } from "zod";
import type { Department } from "../agent";
import { loadKey } from "../google/store";
import { bufferCaller, type BufferCall } from "./client";

/** Written for the artist, because the model will repeat it. */
export const NOT_CONNECTED =
  "No Buffer account is connected. Tell the artist to run `houselabel connect buffer` in their terminal, " +
  "then try again. Do not attempt this another way.";

/** The key, looked up per call so a `connect` in another terminal takes effect
 *  mid-conversation. Tests pass `call` and skip the database. */
async function defaultCall(): Promise<BufferCall | null> {
  const key = await loadKey("buffer").catch(() => null);
  return key ? bufferCaller(key) : null;
}

/**
 * The artist's Buffer organization, required by `list_channels` and
 * `list_posts`. Every account has one, so it is looked up; the first wins.
 */
export async function organizationOf(call: BufferCall): Promise<string> {
  const account = await call("get_account", {});
  const id = account.match(/"organizations":\s*\[\s*\{\s*"id":\s*"([a-f\d]{24})"/)?.[1];
  if (!id) throw new Error("this Buffer account has no organization");
  return id;
}

export function buildBufferTools(
  dept: Pick<Department, "services">,
  resolve: () => Promise<BufferCall | null> = defaultCall,
): Record<string, ReturnType<typeof tool>> {
  if (!dept.services.includes("buffer")) return {};

  /** Every tool fails as a sentence, never a stack trace. */
  const run = async (fn: (call: BufferCall) => Promise<string>) => {
    const call = await resolve();
    if (!call) return NOT_CONNECTED;
    try {
      return await fn(call);
    } catch (err) {
      return `Buffer said: ${(err as Error).message}. Tell the artist in one sentence; do not retry more than once.`;
    }
  };

  return {
    buffer_channels: tool({
      description:
        "The social accounts the artist connected in Buffer (Instagram, TikTok, Threads, YouTube…), with the " +
        "channel ids buffer_draft_post needs. Call this BEFORE drafting — never guess a channel id.",
      inputSchema: z.object({}),
      execute: () => run(async (call) => call("list_channels", { organizationId: await organizationOf(call) })),
    }),

    buffer_draft_post: tool({
      description:
        "Save ONE post as a DRAFT in the artist's Buffer, on one channel. It is never published: the artist " +
        "opens Buffer, reviews it, and schedules it themselves. Use it only after the artist approved the " +
        "exact text in this conversation. Attach photos with imageUrls — the links social_variants returns, in " +
        "the shape that channel needs. Without photos, Instagram and TikTok drafts need media added in Buffer; " +
        "say so.",
      inputSchema: z.object({
        channelId: z.string().describe("from buffer_channels"),
        text: z.string().min(1).max(5000),
        dueAt: z
          .string()
          .optional()
          .describe("ISO date-time the artist intends to post it — kept on the draft, not scheduled"),
        imageUrls: z.array(z.string().url()).max(10).optional().describe("from social_variants, in order"),
        instagram: z
          .enum(["post", "story", "reel"])
          .optional()
          .describe("only for an Instagram channel — Buffer needs to know which"),
      }),
      execute: ({ channelId, text, dueAt, imageUrls, instagram }) =>
        run(async (call) => {
          const out = await call("create_post", {
            channelId,
            text,
            schedulingType: "automatic",
            mode: dueAt ? "customScheduled" : "addToQueue",
            ...(dueAt ? { dueAt } : {}),
            ...(imageUrls?.length ? { assets: imageUrls.map((url) => ({ image: { url } })) } : {}),
            ...(instagram
              ? { metadata: { instagram: { type: instagram, shouldShareToFeed: instagram !== "story" } } }
              : {}),
            saveToDraft: true,
          });
          return (
            `✓ Saved as a draft in Buffer — nothing was published.\n${out}\n` +
            "Tell the artist it is waiting in Buffer → Drafts for them to review and schedule."
          );
        }),
    }),

    buffer_drafts: tool({
      description: "The drafts already waiting in the artist's Buffer — check before drafting the same post twice.",
      inputSchema: z.object({
        channelIds: z.array(z.string()).optional(),
      }),
      execute: ({ channelIds }) =>
        run(async (call) =>
          call("list_posts", {
            organizationId: await organizationOf(call),
            status: ["draft"],
            ...(channelIds?.length ? { channelIds } : {}),
          }),
        ),
    }),
  };
}
