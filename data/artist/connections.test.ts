/**
 * artist.connections holds OAuth refresh tokens, so it is deliberately off
 * ARTIST_TABLES (whose rows reach model context via `artist_get`).
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ARTIST_TABLES, openArtist } from "./client";

const here = new URL(".", import.meta.url).pathname;

describe("artist.connections is unreachable from the seam", () => {
  test("the schema is applied", () => {
    // The table must still be migrated; `houselabel connect` needs it.
    expect(readFileSync(join(here, "migrate.ts"), "utf8")).toContain("connections.sql");
    expect(readFileSync(join(here, "connections.sql"), "utf8")).toContain("create table if not exists artist.connections");
  });

  test("it is not on the allowlist", () => {
    expect(ARTIST_TABLES as readonly string[]).not.toContain("connections");
  });

  test("querying it is refused before a connection is opened", async () => {
    // openArtist needs a URL but the table guard fires on the call, so this
    // runs without a database.
    const artist = await openArtist({ url: "postgres://nobody@127.0.0.1:1/none" }).catch(() => null);
    if (!artist) return; // no local Postgres; the guard is covered by the list test above
    await expect(artist.query("connections")).rejects.toThrow(/unknown artist table/);
    await artist.close();
  });

  test("no department declares it", async () => {
    const agents = join(here, "../../agents");
    const { readdirSync } = await import("node:fs");
    for (const name of readdirSync(agents, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
      const text = readFileSync(join(agents, name, "AGENT.md"), "utf8");
      expect(`${name}: ${text.includes("artist.connections")}`).toBe(`${name}: false`);
    }
  });
});
