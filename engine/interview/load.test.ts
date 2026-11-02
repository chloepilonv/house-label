/**
 * The engine has no shell, so this is the only path from a task skill's
 * question set to a running interview. Its failure modes are all silent ones.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { normalize, validate } from "./core";
import { readRungs } from "../modes";
import { flowPath, loadFlow } from "./load";

describe("flowPath", () => {
  test("is one shape for every department", () => {
    expect(flowPath("press", "press-draft-pitch")).toEndWith(
      "agents/press/skills/press-draft-pitch/scripts/questions.ts",
    );
  });
});

describe("loadFlow", () => {
  test("returns null for a skill with no question set — mid-overhaul is not an error", async () => {
    expect(await loadFlow("press", "press-draft-pitch")).toBeNull();
  });

  test("returns null rather than throwing for a department that does not exist", async () => {
    expect(await loadFlow("nope", "nope-nothing")).toBeNull();
  });

  // manager-scope-project's questions.ts exports QUESTIONS, not a Flow. Until
  // it is overhauled the engine must say so rather than fall through to chat.
  test("throws, naming the export, when questions.ts is not shaped for the core", async () => {
    const err = await loadFlow("label-manager", "manager-scope-project").catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("must export `FLOW`");
    expect((err as Error).message).toContain("manager-scope-project");
  });
});

/**
 * Every question on disk must be answerable. `normalize()` splits `multi`
 * answers on /[,\s]+/, so a multi-word option is unanswerable. This walks every
 * `FLOW` in `agents/` and answers each question with its own declared options.
 */
describe("every task skill on disk", () => {
  test("has a question set its own engine can load and answer", async () => {
    const broken: string[] = [];
    for (const dept of await readRungs()) {
      // Only `mode: task` skills: the menu offers them and the engine loads
      // them. Skills without a mode are mid-overhaul.
      for (const skill of dept.skills.filter((sk) => sk.mode === "task")) {
        // A throw is a finding here: `modes.ts` only checks that questions.ts
        // exists, not that it exports the right name.
        const flow = await loadFlow(dept.name, skill.name).catch((e: Error) => {
          broken.push(`${dept.name}/${skill.name} · ${e.message}`);
          return null;
        });
        if (!flow) continue;
        for (const q of flow.questions) {
          if (!q.options?.length) continue;
          // Each option alone, and for `multi` the whole comma-joined set.
          const tries = q.type === "multi" ? [...q.options, q.options.join(", ")] : q.options;
          for (const raw of tries) {
            const bad = validate(q, normalize(q, raw));
            if (bad) broken.push(`${dept.name}/${skill.name} · ${q.id} (${q.type}) · "${raw}" → ${bad}`);
          }
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
