/**
 * The staff table's rungs, checked against what each department folder earns.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { INTERNAL } from "./agent";
import { atLeast, listArtistFacing, overclaiming, readRungs, RUNGS, SERVED } from "./modes";

describe("the rung is earned, not claimed", () => {
  test("no department claims a rung its folder does not support", async () => {
    const bad = overclaiming(await readRungs());
    // The message is the fix: it names what is missing, not just that it is.
    expect(bad.map((d) => `${d.name} claims ${d.claimed}: ${d.blockers.join(" · ")}`)).toEqual([]);
  });

  test("every department declares a status this file knows", async () => {
    for (const d of await readRungs()) expect(RUNGS).toContain(d.claimed);
  });
});

describe("SERVED", () => {
  test("every name is a real department — the list cannot rot", async () => {
    const real = await listArtistFacing();
    for (const name of SERVED) expect(real).toContain(name);
  });

  test("no meta department is served — they never talk to an artist", () => {
    for (const name of SERVED) expect(INTERNAL.has(name)).toBe(false);
  });

  test("holds no duplicates", () => {
    expect(new Set(SERVED).size).toBe(SERVED.length);
  });

  // Together these keep the staff table right in both directions.
  test("a served department really has both modes wired", async () => {
    for (const d of (await readRungs()).filter((d) => SERVED.includes(d.name))) {
      expect(`${d.name}: ${d.blockers.join(" · ")}`).toBe(`${d.name}: `);
      expect(atLeast(d.earned, "production")).toBe(true);
    }
  });

  test("a department that is fully wired has been added to SERVED", async () => {
    const stale = (await readRungs())
      .filter((d) => d.blockers.length === 1 && d.blockers[0]!.includes("not yet listed in SERVED"))
      .map((d) => d.name);
    expect(stale).toEqual([]);
  });
});

describe("modes", () => {
  test("a department never has two conversations", async () => {
    for (const d of await readRungs()) {
      const discussing = d.skills.filter((s) => s.mode === "discuss");
      expect(discussing.length).toBeLessThanOrEqual(1);
    }
  });

  test("a task skill that declares itself carries its question set", async () => {
    for (const d of await readRungs()) {
      for (const s of d.skills.filter((s) => s.mode === "task")) {
        expect(`${s.name} hasQuestions`).toBe(s.hasQuestions ? `${s.name} hasQuestions` : "missing");
      }
    }
  });
});
