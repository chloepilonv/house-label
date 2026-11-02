/**
 * The extractor with the model faked: the parse, the evidence check, and
 * `validate()` having the last word, so a bad extraction leaves a slot open.
 */
import { describe, expect, test } from "bun:test";
import { parseExtraction } from "./extract";
import type { Flow } from "./core";

const FLOW: Flow = {
  name: "test",
  questions: [
    { id: "pace", order: 1, ask: { en: "How many releases?", fr: "" }, topic: { en: "pace", fr: "" },
      type: "choice", options: ["just one", "2 or 3"], required: true, because: "" },
    { id: "who", order: 2, ask: { en: "Who are you with?", fr: "" }, topic: { en: "who", fr: "" },
      type: "text", required: false, because: "" },
    { id: "wants", order: 3, ask: { en: "What matters?", fr: "" }, topic: { en: "wants", fr: "" },
      type: "multi", options: ["price", "reach"], required: false, because: "" },
  ],
};

/** The slots still open, exactly as `extract` computes them before calling out. */
const open = (answers: Record<string, unknown> = {}) =>
  FLOW.questions.filter((q) => answers[q.id] === undefined);

const run = (reply: string, said: string, answers = {}) =>
  parseExtraction(open(answers), said, reply);

describe("extract", () => {
  test("fills a slot when the quoted words are really in the message", () => {
    const r = run('pace: 2 or 3 <- "EP + Album"', "EP + Album");
    expect(r.filled).toEqual({ pace: "2 or 3" });
  });

  test("DROPS a fill whose evidence is not in the message", () => {
    // An inference with no supporting words ("I apply to FACTOR" as "canada")
    // must not fill a slot.
    const r = run('wants: price <- "I care about cost"', "im in montreal and i apply to factor");
    expect(r.filled).toEqual({});
    expect(r.rejected).toContain("wants");
  });

  test("drops a value the pure core refuses, however well quoted", () => {
    const r = run('pace: seventeen <- "seventeen"', "seventeen");
    expect(r.filled).toEqual({});
    expect(r.rejected).toContain("pace");
  });

  test("fills several slots from one message", () => {
    const r = run(
      'pace: just one <- "one single"\nwho: Believe <- "I was at Believe"',
      "I was at Believe, putting out one single",
    );
    expect(r.filled).toEqual({ pace: "just one", who: "Believe" });
  });

  test("takes every value of a multi — three answers is three answers", () => {
    const r = run('wants: price, reach <- "cost and store coverage"', "cost and store coverage matter");
    expect(r.filled.wants).toEqual(["price", "reach"]);
  });

  test("NOTHING fills nothing, and a question is not an evasion", () => {
    const r = run("NOTHING", "wait, how much does DistroKid cost?");
    expect(r.filled).toEqual({});
    expect(r.rejected).toEqual([]);
  });

  test("never reopens a slot that is already answered", () => {
    const r = run('pace: 2 or 3 <- "two"', "two", { pace: "just one" });
    expect(r.filled).toEqual({});
  });

  test("a model that answers NOTHING useful fills nothing", () => {
    expect(run("I could not tell.", "hi").filled).toEqual({});
  });

  test("punctuation and case do not break the evidence check", () => {
    const r = run('who: Believe <- "at BELIEVE,"', "I was at Believe, then left");
    expect(r.filled).toEqual({ who: "Believe" });
  });
});
