/**
 * Finds a task skill's question set so the engine can drive the interview
 * itself (the engine's model has no shell to run scripts). The model is handed
 * one question at a time to phrase. `cli.ts` is the terminal adapter over the same core.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { join } from "node:path";
import { ROOT } from "../agent";
import type { Flow } from "./core";

/** Where a task skill keeps its questions. One shape, every department. */
export const flowPath = (dept: string, skill: string): string =>
  join(ROOT, "agents", dept, "skills", skill, "scripts", "questions.ts");

/**
 * The `Flow` a task skill exports, or null when it has none (a department
 * mid-overhaul). `engine/modes.ts` refuses to call such a department `production`.
 */
export async function loadFlow(dept: string, skill: string): Promise<Flow | null> {
  const path = flowPath(dept, skill);
  if (!(await Bun.file(path).exists())) return null;
  const mod = (await import(path)) as { FLOW?: Flow; default?: Flow };
  const flow = mod.FLOW ?? mod.default ?? null;
  // A questions.ts exporting under another name is an error, not a silent
  // fallback to free chat.
  if (!flow?.questions?.length) {
    throw new Error(
      `${dept}/${skill}: scripts/questions.ts must export \`FLOW\` (or default) with a non-empty \`questions\` array`,
    );
  }
  return flow;
}

