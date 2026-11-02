/**
 * Departments may read but never write artist.profile and artist.voice, on both
 * write paths: the engine/tools.ts tool and the `artist:set` CLI. The last test
 * fails when a new ARTIST_TABLES entry has no owner decision.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { AGENT_WRITABLE_TABLES, ARTIST_OWNED_TABLES, ARTIST_TABLES, OWNER_COMMAND, isArtistOwned } from "./client";
import { buildTools } from "../../engine/tools";
import type { Department } from "../../engine/agent";

const dept = (artist: string[]): Department =>
  ({
    name: "press", slug: "press", staffMember: "", description: "", department: "press",
    status: "", skills: [], knowledge: [], body: "", front: {} as never,
    tables: { catalog: [], artist }, google: [], services: [],
  }) as Department;

// buildTools only touches session inside execute(); these tests never run one.
const session = {} as never;

describe("the profile belongs to the artist", () => {
  test("it is owned, and so is the voice", () => {
    expect(ARTIST_OWNED_TABLES).toContain("profile");
    expect(ARTIST_OWNED_TABLES).toContain("voice");
    expect(isArtistOwned("profile")).toBe(true);
    expect(isArtistOwned("voice")).toBe(true);
  });

  test("every owned table names the one command that writes it", () => {
    for (const t of ARTIST_OWNED_TABLES) expect(OWNER_COMMAND[t]).toMatch(/^houselabel /);
  });

  test("owned tables are still readable", () => {
    const tools = buildTools(dept(["profile", "press_pitches"]), session);
    const readable = tools.artist_get!.inputSchema!.shape.table.options as string[];
    expect(readable).toContain("profile");
  });

  test("artist_set cannot name an owned table", () => {
    const tools = buildTools(dept(["profile", "voice", "press_pitches"]), session);
    const writable = tools.artist_set!.inputSchema!.shape.table.options as string[];
    expect(writable).toEqual(["press_pitches"]);
  });

  test("a department with nothing else to write gets no artist_set at all", () => {
    const tools = buildTools(dept(["profile"]), session);
    expect(tools.artist_set).toBeUndefined();
    expect(tools.artist_get).toBeDefined();
  });

  test("`artist:set profile` is refused by the CLI, before it opens a connection", async () => {
    const p = Bun.spawn(["bun", "run", "data/artist/brief/cli.ts", "set", "profile", '{"city":"x"}'], {
      cwd: new URL("../..", import.meta.url).pathname,
      // No DATABASE_URL: proves the guard runs before openArtist().
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const err = await new Response(p.stderr).text();
    expect(await p.exited).not.toBe(0);
    expect(err).toContain("belongs to the artist");
    expect(err).toContain("houselabel profile");
  });

  test("`artist:set voice` is refused the same way, and points at `houselabel voice`", async () => {
    const p = Bun.spawn(["bun", "run", "data/artist/brief/cli.ts", "set", "voice", '{"guide":"x"}'], {
      cwd: new URL("../..", import.meta.url).pathname,
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const err = await new Response(p.stderr).text();
    expect(await p.exited).not.toBe(0);
    expect(err).toContain("houselabel voice");
  });
});

describe("every artist table has an owner", () => {
  test("owned + writable accounts for all of them, with no overlap", () => {
    expect([...ARTIST_OWNED_TABLES, ...AGENT_WRITABLE_TABLES].sort()).toEqual([...ARTIST_TABLES].sort());
    expect(AGENT_WRITABLE_TABLES.filter(isArtistOwned)).toEqual([]);
  });
});
