/**
 * Invariants of the pure interview core that the terminal and web adapters rely on.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import {
  askable, branchesFor, emptyState, missingRequired, normalize, plannedTotal,
  step, validate, withOffers, type Flow, type Question,
} from "./core";

const q = (over: Partial<Question> & Pick<Question, "id" | "order">): Question => ({
  ask: { en: `ask ${over.id}`, fr: `demande ${over.id}` },
  topic: { en: over.id, fr: over.id },
  type: "text",
  required: false,
  because: "because",
  ...over,
});

const FLOW: Flow = {
  name: "test-flow",
  questions: [
    q({ id: "title", order: 1, required: true }),
    q({
      id: "kind", order: 2, type: "choice", required: true,
      options: ["single", "album", "tour"],
      opens: { single: ["release"], album: ["release", "press"], tour: ["live"] },
    }),
    q({ id: "when", order: 3, type: "date", required: true }),
    q({ id: "markets", order: 4, type: "multi", options: ["quebec", "canada"] }),
    // Only worth asking once we know it is not a tour.
    q({
      id: "physical", order: 5, type: "choice", options: ["none", "vinyl"],
      dependsOn: ["kind"], showIf: (a) => a.kind !== undefined && a.kind !== "tour",
      opens: { vinyl: ["manufacturing"] },
    }),
  ],
  langFrom: (a) => (Array.isArray(a.markets) && a.markets.includes("quebec") ? "fr" : null),
};

describe("step", () => {
  test("asks one question at a time, in order", () => {
    const a = step(FLOW, emptyState());
    expect(a.question?.id).toBe("title");
    const b = step(FLOW, a.state, { id: "title", raw: "Nuit blanche" });
    expect(b.question?.id).toBe("kind");
    expect(b.state.answers.title).toBe("Nuit blanche");
  });

  test("never mutates the state it was given", () => {
    const before = emptyState();
    const frozen = JSON.stringify(before);
    step(FLOW, before, { id: "title", raw: "Nuit blanche" });
    expect(JSON.stringify(before)).toBe(frozen);
  });

  test("a rejected answer changes nothing and re-asks the same question", () => {
    const a = step(FLOW, emptyState(), { id: "title", raw: "X" });
    const bad = step(FLOW, a.state, { id: "kind", raw: "mixtape" });
    expect(bad.error).toContain("single, album, tour");
    expect(bad.question?.id).toBe("kind");
    expect(bad.state.answers.kind).toBeUndefined();
  });

  test("an unknown question id is an error, not a silent no-op", () => {
    const r = step(FLOW, emptyState(), { id: "nope", raw: "x" });
    expect(r.error).toContain("nope");
  });

  test("returns null once every askable question is answered", () => {
    let s = emptyState();
    for (const [id, raw] of [["title", "X"], ["kind", "tour"], ["when", "2027-04-16"], ["markets", "canada"]]) {
      s = step(FLOW, s, { id, raw }).state;
    }
    const end = step(FLOW, s);
    expect(end.question).toBeNull();
    expect(end.missing).toEqual([]);
  });
});

describe("the count", () => {
  test("the denominator only ever shrinks", () => {
    let s = emptyState();
    let total = plannedTotal(FLOW, s.answers);
    for (const [id, raw] of [["title", "X"], ["kind", "tour"], ["when", "2027-04-16"]]) {
      s = step(FLOW, s, { id, raw }).state;
      const now = plannedTotal(FLOW, s.answers);
      expect(now).toBeLessThanOrEqual(total);
      total = now;
    }
  });

  test("a conditional question counts while its dependency is open", () => {
    expect(plannedTotal(FLOW, {})).toBe(5);
  });

  test("and drops out once the dependency rules it out", () => {
    expect(plannedTotal(FLOW, { kind: "tour" })).toBe(4);
    expect(askable(FLOW, { kind: "tour" }).map((x) => x.id)).not.toContain("physical");
  });
});

describe("language", () => {
  test("an answer can switch the language of the questions that follow", () => {
    const s = step(FLOW, emptyState(), { id: "markets", raw: "quebec, canada" });
    expect(s.state.lang).toBe("fr");
  });

  test("and leaves it alone when the answer does not call for it", () => {
    const s = step(FLOW, emptyState(), { id: "markets", raw: "canada" });
    expect(s.state.lang).toBe("en");
  });
});

describe("branches", () => {
  test("are deterministic — same answers, same branches", () => {
    const a = { kind: "album", physical: "vinyl" };
    expect(branchesFor(FLOW, a).sort()).toEqual(branchesFor(FLOW, a).sort());
    expect(branchesFor(FLOW, a).sort()).toEqual(["manufacturing", "press", "release"]);
  });

  test("an unanswered question opens nothing", () => {
    expect(branchesFor(FLOW, {})).toEqual([]);
  });
});

describe("normalize and validate", () => {
  test("a month becomes the first of that month", () => {
    expect(normalize(FLOW.questions[2], "2027-04")).toBe("2027-04-01");
  });

  test("\"I don't know\" is a real answer, in both languages", () => {
    expect(normalize(FLOW.questions[2], "je ne sais pas")).toBe("unknown");
    expect(normalize(FLOW.questions[2], "idk")).toBe("unknown");
    expect(validate(FLOW.questions[2], "unknown")).toBeNull();
  });

  test("multi splits on commas and whitespace alike", () => {
    expect(normalize(FLOW.questions[3], "quebec, canada")).toEqual(["quebec", "canada"]);
    expect(normalize(FLOW.questions[3], "quebec canada")).toEqual(["quebec", "canada"]);
  });

  test("a date that is not a date is refused with something the artist can act on", () => {
    expect(validate(FLOW.questions[2], "sometime in spring")).toContain("2027-04-16");
  });
});

describe("required", () => {
  test("an empty array does not count as an answer", () => {
    expect(missingRequired(FLOW, { title: "", kind: "album", when: "2027-04-16" })).toContain("title");
  });

  test("a question ruled out by showIf is never missing", () => {
    expect(missingRequired(FLOW, { title: "X", kind: "tour", when: "2027-04-16" })).toEqual([]);
  });
});

describe("offers", () => {
  test("are offered, never adopted", () => {
    const s = withOffers(emptyState(), { markets: { value: ["quebec"], from: "you're in QC" } });
    expect(s.answers.markets).toBeUndefined();
    expect(s.offered.markets?.from).toBe("you're in QC");
  });

  test("cannot overwrite an answer the artist already gave", () => {
    const answered = step(FLOW, emptyState(), { id: "markets", raw: "canada" }).state;
    const s = withOffers(answered, { markets: { value: ["quebec"], from: "you're in QC" } });
    expect(s.offered.markets).toBeUndefined();
    expect(s.answers.markets).toEqual(["canada"]);
  });

  test("answering a question clears its offer", () => {
    const s0 = withOffers(emptyState(), { title: { value: "Old", from: "on file" } });
    const s1 = step(FLOW, s0, { id: "title", raw: "New" });
    expect(s1.state.offered.title).toBeUndefined();
  });
});

describe("an adopted offer is not a question", () => {
  const FLOW: Flow = {
    name: "t",
    questions: [
      { id: "a", order: 1, ask: { en: "a?", fr: "a?" }, topic: { en: "a", fr: "a" }, type: "text", required: true, because: "" },
      { id: "b", order: 2, ask: { en: "b?", fr: "b?" }, topic: { en: "b", fr: "b" }, type: "multi", required: true, because: "" },
    ],
  };

  test("adopt lands in answers, so the question is never reached", () => {
    const s = withOffers(emptyState(), {
      b: { value: ["x", "y"], from: "your linked accounts", adopt: true },
    });
    expect(s.answers.b).toEqual(["x", "y"]);
    expect(step(FLOW, s).question?.id).toBe("a");
    expect(missingRequired(FLOW, s.answers)).toEqual(["a"]);
  });

  test("its provenance survives, so the summary can show what was assumed", () => {
    const s = withOffers(emptyState(), {
      b: { value: ["x"], from: "your linked accounts", adopt: true },
    });
    expect(s.offered.b?.from).toBe("your linked accounts");
  });

  test("a plain offer still asks — nothing is adopted silently", () => {
    const s = withOffers(emptyState(), { a: { value: "guess", from: "somewhere" } });
    expect(s.answers.a).toBeUndefined();
    expect(step(FLOW, s).question?.id).toBe("a");
  });

  test("an adopt offer never overwrites an answer the artist gave", () => {
    const given = { ...emptyState(), answers: { b: ["mine"] } };
    const s = withOffers(given, { b: { value: ["theirs"], from: "data", adopt: true } });
    expect(s.answers.b).toEqual(["mine"]);
  });
});
