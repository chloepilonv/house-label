import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { listExamples, readExample, toItems, toWorkspaceData } from "./example";

const AGENTS = join(import.meta.dir, "../../agents");

describe("example campaigns", async () => {
  const names = await listExamples();
  const agents = new Set((await readdir(AGENTS, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name));

  test("an empty examples folder is a valid state", async () => {
    expect(await listExamples("/nonexistent")).toEqual([]);
  });

  for (const name of names)
    test(`${name}: real dates, a real department, a known status, no amount in the plan`, async () => {
      const x = await readExample(name);
      expect(x.root).toBeTruthy();
      expect(x.root).not.toBe(`${x.profile.artist_name} — House Label`); // never the artist's own workspace
      for (const [date, action, agent, status, source] of x.plan) {
        expect(String(date)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(action).toBeTruthy();
        expect(agents.has(agent)).toBe(true);
        expect(["Done", "To do", "Won't do"]).toContain(status);
        expect(`${action} ${source}`).not.toMatch(/\$|€|\b(CAD|USD|EUR)\b/);
      }
      const data = toWorkspaceData(x);
      expect(data.projects[0]!.tasks.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.due_date))).toBe(true);
      expect(toItems(x).filter((i) => i.done).length).toBeGreaterThan(0);
    });
});
