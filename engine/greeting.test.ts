/**
 * Generated-greeting failure modes: a missing skill, trigger text shown to the
 * artist, numbered lists, and misrouted sentences.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { inDeclaredOrder, loadDepartment, type Department, type Skill } from "./agent";
import { lineFor, offers, renderGreeting, route, talkLine } from "./greeting";

const skill = (over: Partial<Skill> & Pick<Skill, "name">): Skill => ({
  description: "", body: "", mode: null, greeting: null, greetingFr: null, ...over,
});

const dept = (skills: Skill[], over: Partial<Department> = {}): Department => ({
  name: "promotion", slug: "promotion", staffMember: "The Promotion Agent",
  description: "", department: "Promotion", status: "developed",
  discuss: "discuss getting played in general", discussFr: "discuter de radio en général",
  skills, knowledge: [], tables: { catalog: [], artist: [] }, network: [], google: [], services: [],
  drive: { write: [], read: [] }, body: "", front: {}, ...over,
});

const WIRED = dept([
  skill({ name: "promotion-match-radio", mode: "task", greeting: "find the radio stations worth reaching", greetingFr: "trouver les radios qui valent la peine" }),
  skill({ name: "promotion-match-playlists", mode: "task", greeting: "shortlist the playlists to pitch" }),
]);

// A model that must never be called; other tests pass `ask` directly.
const NO_MODEL = {} as never;

describe("offers", () => {
  test("lists every task skill, in roster order, and nothing else", () => {
    expect(offers(WIRED).map((o) => o.skill)).toEqual(["promotion-match-radio", "promotion-match-playlists"]);
  });

  test("a skill with a greeting line is offered even before it is wired", () => {
    const d = dept([skill({ name: "promotion-match-playlists", greeting: "shortlist the playlists to pitch" })]);
    expect(offers(d).map((o) => o.line)).toEqual(["shortlist the playlists to pitch"]);
  });

  test("a skill with neither mode nor greeting is not said out loud", () => {
    expect(offers(dept([skill({ name: "promotion-match-radio" })]))).toEqual([]);
  });
});

describe("lines", () => {
  test("uses the artist-facing clause, in their language", () => {
    const s = WIRED.skills[0]!;
    expect(lineFor(s, "en")).toBe("find the radio stations worth reaching");
    expect(lineFor(s, "fr")).toBe("trouver les radios qui valent la peine");
  });

  test("falls back to English when no French line is written", () => {
    expect(lineFor(WIRED.skills[1]!, "fr")).toBe("shortlist the playlists to pitch");
  });

  test("never reads the model-facing trigger sentence to a musician", () => {
    const s = skill({
      name: "promotion-match-radio",
      description: "Use when the artist wants radio play — ranks stations by fit. Triggers on \"how do I get on the radio\".",
    });
    const line = lineFor(s, "en");
    expect(line).not.toContain("Use when");
    expect(line).not.toContain("Triggers on");
  });

  test("the or-just clause comes from AGENT.md, else from the department name", () => {
    expect(talkLine(WIRED, "fr")).toBe("discuter de radio en général");
    expect(talkLine(dept([], { discuss: null, discussFr: null }))).toBe("ask me anything about promotion");
  });
});

describe("renderGreeting", () => {
  test("one paragraph: who, what it can run, that it can just talk, the question", () => {
    expect(renderGreeting(WIRED)).toBe(
      "Hey! I'm the Promotion Agent. I can find the radio stations worth reaching, shortlist the playlists to pitch, " +
        "or just discuss getting played in general. What do you want to do today?",
    );
  });

  test("no numbers, no markdown — the house voice applies to the frame too", () => {
    const out = renderGreeting(WIRED);
    expect(out).not.toMatch(/\b1\b|\*\*|^#/m);
  });

  test("a department with nothing to run still invites the conversation", () => {
    const out = renderGreeting(dept([]));
    expect(out).toContain("discuss getting played in general");
    expect(out).toContain("What do you want to do today?");
  });

  test("in French, all of it", () => {
    const out = renderGreeting(WIRED, "fr");
    expect(out).toContain("Je peux trouver les radios qui valent la peine");
    expect(out).toContain("ou simplement discuter de radio en général");
    expect(out).toContain("Qu'est-ce que tu veux faire aujourd'hui ?");
  });
});

describe("route", () => {
  test("a sentence that asks for a task starts it", async () => {
    const ask = async () => "promotion-match-radio";
    expect(await route(WIRED, "find me a room in Montréal for a 200-cap show", { model: NO_MODEL, ask })).toEqual({
      task: "promotion-match-radio",
    });
  });

  // Free text is never rejected.
  test("anything else is a conversation, not an invalid choice", async () => {
    const ask = async () => "TALK";
    expect(await route(WIRED, "how does a door split work", { model: NO_MODEL, ask })).toEqual({ chat: true });
  });

  test("trusts the list, never the model's spelling of it", async () => {
    const ask = async () => "promotion-do-everything";
    expect(await route(WIRED, "book everything", { model: NO_MODEL, ask })).toEqual({ chat: true });
  });

  test("a model failure degrades to the conversation, never to a wrong task", async () => {
    const ask = async () => { throw new Error("429"); };
    expect(await route(WIRED, "plan my radio campaign", { model: NO_MODEL, ask })).toEqual({ chat: true });
  });

  test("with nothing to run, the model is never called", async () => {
    let called = false;
    const ask = async () => { called = true; return "TALK"; };
    expect(await route(dept([]), "anything", { model: NO_MODEL, ask })).toEqual({ chat: true });
    expect(called).toBe(false);
  });

  test("the model is shown the staff member's last words, so 'yes' can mean the job", async () => {
    let seen = "";
    const ask = async (_s: string, prompt: string) => { seen = prompt; return "promotion-match-playlists"; };
    await route(WIRED, "yes please", { model: NO_MODEL, ask, lastSaid: "Want me to shortlist those playlists?" });
    expect(seen).toContain("Want me to shortlist those playlists?");
    expect(seen).toContain("They typed: yes please");
  });

  test("a bare number is not a choice any more", async () => {
    const ask = async () => "TALK";
    expect(await route(WIRED, "2", { model: NO_MODEL, ask })).toEqual({ chat: true });
  });
});

describe("greeting order follows the roster, not the filesystem", () => {
  const s = (name: string): Skill => ({
    name, description: "", body: "", mode: "task", greeting: null, greetingFr: null,
  });
  // readdir order (alphabetical), which puts the last step first.
  const onDisk = [s("digital-marketing-build-website"), s("digital-marketing-draft-content"), s("digital-marketing-plan")];

  test("the declared order wins", () => {
    const out = inDeclaredOrder(onDisk, [
      "digital-marketing-plan", "digital-marketing-draft-content", "digital-marketing-build-website",
    ]);
    expect(out.map((x) => x.name)).toEqual([
      "digital-marketing-plan", "digital-marketing-draft-content", "digital-marketing-build-website",
    ]);
  });

  test("a skill missing from `skills:` is listed last, never dropped", () => {
    const out = inDeclaredOrder(onDisk, ["digital-marketing-plan"]);
    expect(out.map((x) => x.name)).toEqual([
      "digital-marketing-plan", "digital-marketing-build-website", "digital-marketing-draft-content",
    ]);
  });

  test("no declaration at all falls back to alphabetical", () => {
    expect(inDeclaredOrder(onDisk, []).map((x) => x.name)).toEqual(onDisk.map((x) => x.name));
  });

  test("the digital-marketing greeting really opens on plan", async () => {
    const d = await loadDepartment("digital-marketing");
    expect(offers(d)[0]?.skill).toBe("digital-marketing-plan");
  });
});

describe("the roster, as the artist hears it", () => {
  test("every served department's tasks have a sentence, and every department has an or-just clause", async () => {
    const { SERVED } = await import("./modes");
    for (const name of SERVED) {
      const d = await loadDepartment(name);
      expect(`${name}: ${d.discuss ?? "no discuss:"}`).not.toContain("no discuss:");
      for (const s of d.skills.filter((s) => s.mode === "task")) {
        expect(`${s.name}: ${s.greeting ?? "no greeting:"}`).not.toContain("no greeting:");
      }
    }
  });

  test("no department still ships a discuss skill", async () => {
    const { listDepartments } = await import("./agent");
    for (const name of await listDepartments()) {
      const d = await loadDepartment(name);
      expect(d.skills.map((s) => s.name).filter((n) => n.endsWith("-discuss"))).toEqual([]);
    }
  });
});
