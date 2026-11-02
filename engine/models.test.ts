/**
 * Tiers exist per provider, and every department declares one.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { listDepartments, loadDepartment } from "./agent";
import { MODELS, TIERS, modelFor, tierFor } from "./models";
import { PROVIDERS } from "./providers";

describe("MODELS", () => {
  test("every provider names a model for every tier", () => {
    for (const provider of Object.keys(PROVIDERS)) {
      expect(Object.keys(MODELS[provider as keyof typeof MODELS])).toEqual(TIERS);
      for (const tier of TIERS) expect(MODELS[provider as keyof typeof MODELS][tier]).toBeTruthy();
    }
  });

  test("a hand-edited override wins over the table", () => {
    expect(modelFor("anthropic", "deep")).toBe("claude-opus-5");
    expect(modelFor("anthropic", "deep", { deep: "claude-opus-4-8" })).toBe("claude-opus-4-8");
  });
});

describe("tierFor", () => {
  test("reads tier:, never model: — model: belongs to Claude Code", () => {
    expect(tierFor({ tier: "deep", model: "inherit" })).toBe("deep");
    expect(tierFor({ model: "deep" })).toBe("standard");
  });

  test("an unknown or missing value falls back to standard", () => {
    expect(tierFor({})).toBe("standard");
    expect(tierFor({ tier: "enormous" })).toBe("standard");
  });

  test("every department declares a real tier", async () => {
    for (const name of await listDepartments()) {
      const dept = await loadDepartment(name);
      expect(TIERS).toContain(dept.front.tier as never);
    }
  });

  test("no department claims 'fast' — fast is a phase, not a job", async () => {
    for (const name of await listDepartments()) {
      const dept = await loadDepartment(name);
      expect(dept.front.tier).not.toBe("fast");
    }
  });
});

describe("the model table goes stale silently", () => {
  test("no id names a model family this repo has already seen retired", () => {
    // Stops known-dead ids coming back. Only a live call (`houselabel init`)
    // proves the table is current.
    const RETIRED = ["llama-3.3-70b-versatile", "gemini-2.5-pro", "gemini-1.5", "gpt-4-turbo"];
    const ids = Object.values(MODELS).flatMap((tiers) => Object.values(tiers));
    for (const dead of RETIRED) {
      expect(ids.filter((id) => id.includes(dead))).toEqual([]);
    }
  });
});
