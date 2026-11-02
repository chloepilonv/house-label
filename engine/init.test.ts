/**
 * `houselabel init` hands its environment to every setup command. Bun
 * snapshots env at startup, so a runtime DATABASE_URL needs explicit `env`.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { expect, test } from "bun:test";
import { step } from "./init";

test("a variable set at runtime reaches the child", async () => {
  process.env.HOUSELABEL_INIT_PROBE = "set-at-runtime";
  const ok = await step(["sh", "-c", 'test "$HOUSELABEL_INIT_PROBE" = set-at-runtime'], "probe");
  delete process.env.HOUSELABEL_INIT_PROBE;
  expect(ok).toBe(true);
});
