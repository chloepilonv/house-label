/**
 * The roster and the question flows must agree, like data/artist/brief/rules.test.ts.
 * `null` is allowed but must be written explicitly.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { listDepartments } from "./agent";
import { FLOWS, isComplete, renderFlow, stripToken, type Flow } from "./questions";

const departments = await listDepartments();

describe("FLOWS covers the roster", () => {
  test("every department under agents/ has an entry", () => {
    const missing = departments.filter((d) => !(d in FLOWS));
    expect(missing).toEqual([]);
  });

  test("no entry names a department that does not exist", () => {
    const orphans = Object.keys(FLOWS).filter((d) => !departments.includes(d));
    expect(orphans).toEqual([]);
  });
});

describe("each flow is usable", () => {
  const flows = Object.entries(FLOWS).filter(([, f]) => f !== null) as [string, Flow][];

  test.each(flows)("%s asks real questions and ends on the mandatory one", (_name, flow) => {
    expect(flow.questions.length).toBeGreaterThan(2);
    expect(flow.final).toMatch(/\?$/);
    expect(flow.token).toBeTruthy();
    // A statement here becomes an instruction the model narrates instead of asks.
    for (const q of flow.questions) expect(q).toMatch(/\?/);
  });

  test.each(flows)("%s renders its flow numbered, with the token named", (_name, flow) => {
    const rendered = renderFlow(flow);
    expect(rendered).toContain("1. ");
    expect(rendered).toContain(flow.final);
    expect(rendered).toContain(flow.token);
    expect(rendered).toContain("ONE question per turn");
  });

  test.each(flows)("%s variants are extra questions, never replacements", (_name, flow) => {
    for (const [variant, extra] of Object.entries(flow.variants ?? {})) {
      const rendered = renderFlow(flow, { variant });
      for (const q of [...extra, ...flow.questions]) expect(rendered).toContain(q);
    }
  });
});

describe("the sentinel", () => {
  const flow = FLOWS.press!;

  test("is detected only when the model actually writes it", () => {
    expect(isComplete("Got it. What province?", flow)).toBe(false);
    expect(isComplete(`Here is what I have.\n${flow.token}`, flow)).toBe(true);
  });

  test("never survives into what the artist reads", () => {
    expect(stripToken(`All set.\n${flow.token}`, flow)).toBe("All set.");
  });
});

describe("known facts suppress questions", () => {
  test("the do-not-ask block names them", () => {
    const rendered = renderFlow(FLOWS.press!, { known: ["lives in Montréal, QC"] });
    expect(rendered).toContain("do NOT ask");
    expect(rendered).toContain("lives in Montréal, QC");
  });
});
