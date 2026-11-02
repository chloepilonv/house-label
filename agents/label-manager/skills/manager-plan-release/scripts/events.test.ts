import { describe, expect, test } from "bun:test";
import { milestoneEvents, tagFor } from "./events";

const project = { title: "Nightdrive", street_date: "2026-11-13" };
const row = (o: Partial<Parameters<typeof milestoneEvents>[1][number]>) => ({
  id: "6d3f1a2b-0000-4000-8000-000000000001",
  milestone_key: "radio_serviced",
  title: "Radio serviced",
  detail: "Community and college first.",
  owner: "promotion",
  proposed_owner: null,
  offset_days: -49,
  basis: "promotion/knowledge/radio-pitch.md",
  status: "pending",
  ...o,
});

describe("plan → calendar events", () => {
  test("the title opens with the owning department, upper-cased, in the plan's language", () => {
    expect(tagFor(row({}), "en")).toBe("[PROMOTION]"); // known on the promotion branch, its own name until then
    expect(tagFor(row({ owner: "press" }), "en")).toBe("[PRESS AGENT]");
    expect(tagFor(row({ owner: "rights" }), "fr")).toBe("[DROITS]");
    expect(tagFor(row({ owner: null }), "en")).toBe("[YOU]");
    expect(tagFor(row({ owner: null, proposed_owner: "Sync" }), "en")).toBe("[SYNC]");
    expect(tagFor(row({ milestone_key: "release_day", owner: null }), "en")).toBe("[RELEASE]");
  });

  test("the date is the street date plus the offset, and the id is the row's", () => {
    const [e] = milestoneEvents(project, [row({})], "en");
    expect(e!.date).toBe("2026-09-25");
    expect(e!.id).toBe("6d3f1a2b-0000-4000-8000-000000000001");
    expect(e!.title).toBe("[PROMOTION] Radio serviced");
    expect(e!.description).toContain("Why this date: promotion/knowledge/radio-pitch.md");
    expect(e!.description).toContain("Project: Nightdrive");
  });

  test("an undated step is left off, a finished one is removed", () => {
    const events = milestoneEvents(project, [row({ offset_days: null }), row({ id: "b", status: "done" })], "en");
    expect(events).toHaveLength(1);
    expect(events[0]!.active).toBe(false);
  });

  test("the release day wears the label manager's colour; a department wears its own", () => {
    const [release, radio] = milestoneEvents(
      project,
      [row({ id: "a", milestone_key: "release_day", owner: null, offset_days: 0 }), row({ id: "b" })],
      "en",
    );
    expect(release!.colorId).toBe("11");
    expect(radio!.colorId).not.toBe("11");
  });
});
