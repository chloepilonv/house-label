/**
 * The catalog is one file, and nothing reaches past it.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { expect, test } from "bun:test";
import { SHIPPED_CATALOG, openCatalog } from "./client";

test("the catalog opens from data/catalog/catalog.sqlite", async () => {
  expect(SHIPPED_CATALOG.endsWith("data/catalog/catalog.sqlite")).toBe(true);
  const c = await openCatalog();
  expect((await c.query("tools", {}, 1)).length).toBe(1);
  expect(c.query("no_such_table")).rejects.toThrow(/unknown dataset/);
  await c.close();
});

test("no tracked file names a hosted catalog database", async () => {
  const p = Bun.spawn(["git", "grep", "-l", "-I", "-i", "-E", "neon\\.tech|neon db|on neon|\\bneon\\b|CATALOG_PROD_URL|catalog_public"], { cwd: `${import.meta.dir}/../..`, stdout: "pipe" });
  const hits = (await new Response(p.stdout).text()).split("\n").filter((f) => f && f !== "data/catalog/catalog.test.ts");
  expect(hits).toEqual([]);
});
