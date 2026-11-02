/**
 * Buffer: drafts only, and only for the departments that declared it.
 * No network or database: the Buffer MCP server is a recorder.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listDepartments, ROOT } from "../agent";
import { parseDoc, parseServices, SERVICES } from "../frontmatter";
import type { BufferCall, BufferToolName } from "./client";
import { accountLabel } from "./index";
import { buildBufferTools, NOT_CONNECTED } from "./tools";

/** The shape of Buffer's real get_account reply, trimmed. */
const ACCOUNT = '{"id":"6ab183a3a55bed6bfabced72","organizations":[{"id":"6ab183a3a55bed6bfabced74","name":"My organization"}]}';

/** A fake Buffer that records every call. */
function recorder(reply = "{\"ok\":true}") {
  const calls: { name: BufferToolName; args: Record<string, unknown> }[] = [];
  const call: BufferCall = async (name, args) => {
    calls.push({ name, args });
    return name === "get_account" ? ACCOUNT : reply;
  };
  return { calls, resolve: async () => call };
}

const run = (t: unknown, input: unknown) =>
  (t as { execute: (i: unknown, o: unknown) => Promise<string> }).execute(input, {
    toolCallId: "t",
    messages: [],
  });

describe("buildBufferTools", () => {
  test("a department that declared nothing gets nothing", () => {
    expect(buildBufferTools({ services: [] })).toEqual({});
  });

  test("a department that declared buffer gets exactly three tools", () => {
    expect(Object.keys(buildBufferTools({ services: ["buffer"] })).sort()).toEqual([
      "buffer_channels",
      "buffer_draft_post",
      "buffer_drafts",
    ]);
  });

  test("a post is ALWAYS a draft, and never shareNow", async () => {
    const fake = recorder();
    const tools = buildBufferTools({ services: ["buffer"] }, fake.resolve);
    const out = await run(tools.buffer_draft_post, { channelId: "ch1", text: "Nuit blanche — vendredi" });

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]!.name).toBe("create_post");
    expect(fake.calls[0]!.args.saveToDraft).toBe(true);
    expect(fake.calls[0]!.args.mode).toBe("addToQueue");
    expect(JSON.stringify(fake.calls)).not.toContain("shareNow");
    expect(out).toContain("nothing was published");
  });

  test("the model cannot turn saveToDraft off — the argument is not in its schema", async () => {
    const fake = recorder();
    const tools = buildBufferTools({ services: ["buffer"] }, fake.resolve);
    await run(tools.buffer_draft_post, { channelId: "ch1", text: "hi", saveToDraft: false, mode: "shareNow" });
    expect(fake.calls[0]!.args.saveToDraft).toBe(true);
    expect(fake.calls[0]!.args.mode).toBe("addToQueue");
  });

  test("an intended date rides on the draft without scheduling it", async () => {
    const fake = recorder();
    const tools = buildBufferTools({ services: ["buffer"] }, fake.resolve);
    await run(tools.buffer_draft_post, { channelId: "ch1", text: "hi", dueAt: "2026-10-02T17:00:00Z" });
    expect(fake.calls[0]!.args).toMatchObject({ mode: "customScheduled", dueAt: "2026-10-02T17:00:00Z", saveToDraft: true });
  });

  test("photos ride as Buffer image assets, and Instagram is told which kind of post", async () => {
    const fake = recorder();
    const tools = buildBufferTools({ services: ["buffer"] }, fake.resolve);
    await run(tools.buffer_draft_post, {
      channelId: "ig",
      text: "Nuit blanche",
      imageUrls: ["https://lh3.googleusercontent.com/d/abc"],
      instagram: "post",
    });
    expect(fake.calls[0]!.args).toMatchObject({
      assets: [{ image: { url: "https://lh3.googleusercontent.com/d/abc" } }],
      metadata: { instagram: { type: "post", shouldShareToFeed: true } },
      saveToDraft: true,
    });
  });

  test("drafts are listed by status, in the account's organization — Buffer requires one", async () => {
    const fake = recorder();
    const tools = buildBufferTools({ services: ["buffer"] }, fake.resolve);
    await run(tools.buffer_drafts, {});
    expect(fake.calls.at(-1)).toEqual({
      name: "list_posts",
      args: { organizationId: "6ab183a3a55bed6bfabced74", status: ["draft"] },
    });
  });

  test("channels are listed in the account's organization, never asked for", async () => {
    const fake = recorder();
    const tools = buildBufferTools({ services: ["buffer"] }, fake.resolve);
    await run(tools.buffer_channels, {});
    expect(fake.calls.at(-1)).toEqual({ name: "list_channels", args: { organizationId: "6ab183a3a55bed6bfabced74" } });
  });

  test("no key is a sentence the artist can act on, not a crash", async () => {
    const tools = buildBufferTools({ services: ["buffer"] }, async () => null);
    expect(await run(tools.buffer_channels, {})).toBe(NOT_CONNECTED);
    expect(await run(tools.buffer_draft_post, { channelId: "c", text: "t" })).toBe(NOT_CONNECTED);
  });

  test("a Buffer error comes back as a sentence", async () => {
    const tools = buildBufferTools({ services: ["buffer"] }, async () => async () => {
      throw new Error("Instagram posts need media");
    });
    expect(await run(tools.buffer_draft_post, { channelId: "c", text: "t" })).toContain("Instagram posts need media");
  });
});

describe("accountLabel", () => {
  test("shows the email in Buffer's reply, never anything else", () => {
    expect(accountLabel('{"account":{"email":"artist@example.com","id":"x"}}')).toBe("artist@example.com");
    expect(accountLabel("{}")).toBeNull();
  });
});

describe("services: across the roster", () => {
  test("sync.ts and frontmatter.ts list the same services", () => {
    const sync = readFileSync(join(ROOT, "agents/sync.ts"), "utf8");
    const listed = sync.match(/const SERVICES = \[([^\]]*)\]/)?.[1] ?? "";
    expect(listed.split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)).toEqual([...SERVICES]);
  });

  test("every AGENT.md declares services:, and only digital-marketing uses buffer", async () => {
    for (const name of await listDepartments()) {
      const { front } = parseDoc(readFileSync(join(ROOT, "agents", name, "AGENT.md"), "utf8"));
      expect(`${name}: ${front.services ?? "MISSING"}`).not.toContain("MISSING");
      expect(`${name}: ${parseServices(front.services).includes("buffer")}`).toBe(
        `${name}: ${name === "digital-marketing"}`,
      );
    }
  });
});
