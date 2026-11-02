/**
 * A served department runs its interview from `engine/interview/`; others keep
 * the prompt-embedded flow. Never both at once.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import type { Department, Skill } from "./agent";
import { SERVED } from "./modes";
import { buildSystemPrompt } from "./session";

const dept = (name: string, skills: Skill[] = []): Department => ({
  name, slug: name, staffMember: `The ${name}`, description: "",
  department: name, status: "developed", skills, knowledge: [],
  tables: { catalog: [], artist: [] }, body: "a body", front: {},
});

/**
 * SERVED before any test ran. The restore check compares against this, not
 * `[]`, so it keeps passing as departments get served.
 */
const SERVED_AT_START = [...SERVED];

/** SERVED is module state; restore it so test order cannot matter. */
function withServed<T>(name: string, fn: () => T): T {
  SERVED.push(name);
  try {
    return fn();
  } finally {
    SERVED.splice(SERVED.indexOf(name), 1);
  }
}

describe("the interview block", () => {
  test("an un-overhauled department still carries its question flow", () => {
    expect(buildSystemPrompt(dept("press"))).toContain("QUESTION FLOW");
  });

  test("a served department carries none — the runner walks it instead", () => {
    // Uses a department not already in SERVED, so the push is what's proven.
    expect(SERVED).not.toContain("press");
    withServed("press", () => {
      expect(buildSystemPrompt(dept("press"))).not.toContain("QUESTION FLOW");
    });
  });

  test("and SERVED is left exactly as it was found", () => {
    expect(SERVED).toEqual(SERVED_AT_START);
  });

  test("a department that never interviewed is unaffected either way", () => {
    // `platforms` records rather than interviews; its FLOWS entry is null.
    expect(buildSystemPrompt(dept("platforms"))).not.toContain("QUESTION FLOW");
  });
});

describe("what they asked for", () => {
  test("naming the task stops the staff member re-asking what they want", () => {
    const p = buildSystemPrompt(dept("press"), { task: "promotion-match-radio" });
    expect(p).toContain("What they asked for");
    expect(p).toContain("promotion-match-radio");
    expect(p).toContain("Do not ask them what they want");
  });

  test("no pick, no block — the department opens the way it always did", () => {
    expect(buildSystemPrompt(dept("press"))).not.toContain("What they asked for");
  });
});

describe("the house voice survives every branch", () => {
  test.each([
    ["plain", {}],
    ["with a pick", { task: "promotion-match-radio" }],
    ["in French", { locale: "fr" }],
  ])("%s", (_name, opts) => {
    const p = buildSystemPrompt(dept("press"), opts as Record<string, string>);
    expect(p).toContain("One question per message");
    expect(p).toContain("Do not claim you sent, submitted, or booked anything");
  });
});

describe("HOUSE_VOICE is a template literal, so a stray backtick ends it", () => {
  test("no rule contains a backtick", async () => {
    // The prompt is a template literal, so a backtick inside a rule is a
    // syntax error whose message points at prose.
    const src = await Bun.file(new URL("./session.ts", import.meta.url)).text();
    const start = src.indexOf("const HOUSE_VOICE");
    const end = src.indexOf("export function buildSystemPrompt");
    const block = src.slice(start, end);
    const offenders = block
      .split("\n")
      // The last rule carries the literal's own closing backtick.
      .filter((l) => l.startsWith("- ") && l.replace(/`;\s*$/, "").includes("`"));
    expect(offenders).toEqual([]);
  });
});

describe("what a turn costs, in tokens", () => {
  test("no department's opening turn is unreasonably large", async () => {
    // Measures prompt plus tool schemas (the tools are about a third of a
    // request). Threshold 12,000 tokens: catches inlining every skill again.
    // Groq's free tier (8,000 per request) is out of reach; see README roadmap.
    const { listStaff } = await import("./agent");
    const { buildTools, openSession } = await import("./tools");
    const colleagues = await listStaff();
    const session = openSession();
    const over: string[] = [];
    try {
      for (const d of colleagues) {
        const prompt = buildSystemPrompt(d, { locale: "en", colleagues }).length / 4;
        const tools =
          JSON.stringify(buildTools(d, session), (_k, v) => (typeof v === "function" ? undefined : v))
            .length / 4;
        const total = Math.round(prompt + tools);
        if (total > 12_000) over.push(`${d.name}: ~${total} tokens (${Math.round(prompt)} prompt + ${Math.round(tools)} tools)`);
      }
    } finally {
      await session.close();
    }
    expect(over).toEqual([]);
  });
});
