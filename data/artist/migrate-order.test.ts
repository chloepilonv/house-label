/**
 * Checks the FILES order in migrate.ts: the file that creates a table must come
 * before any file that references it. A wrong order only fails on a fresh
 * database. Reads the real migrate.ts and .sql files.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The applied order, parsed out of migrate.ts itself — never a second copy. */
const FILES: string[] = (() => {
  const src = readFileSync(join(HERE, "migrate.ts"), "utf8");
  const block = src.match(/const FILES = \[([\s\S]*?)\n\];/);
  if (!block) throw new Error("could not find the FILES array in migrate.ts");
  return [...block[1].matchAll(/"([^"]+\.sql)"/g)].map((m) => m[1]);
})();

const body = (f: string) => readFileSync(join(HERE, f), "utf8");

/** Strip -- line comments so prose about a table is not read as a reference. */
const code = (f: string) =>
  body(f).split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");

/** Which file creates each artist.<table>. */
const CREATED_BY = new Map<string, string>();
for (const f of FILES) {
  for (const m of code(f).matchAll(/create table if not exists\s+artist\.(\w+)/g)) {
    if (!CREATED_BY.has(m[1])) CREATED_BY.set(m[1], f);
  }
}

/** Every way a file can reach a table it may not have created. */
const REFERENCE = [
  /\bupdate\s+artist\.(\w+)/g,
  /\breferences\s+artist\.(\w+)/g,
  /\binsert\s+into\s+artist\.(\w+)/g,
  /\balter\s+table\s+artist\.(\w+)/g,
  /\bcreate\s+index\s+if\s+not\s+exists\s+\w+\s+on\s+artist\.(\w+)/g,
];

describe("data/artist migration order", () => {
  test("every .sql in FILES exists on disk", () => {
    for (const f of FILES) expect(() => body(f)).not.toThrow();
  });

  test("FILES lists each file exactly once", () => {
    expect(FILES.length).toBe(new Set(FILES).size);
  });

  test("no file touches a table created by a later file", () => {
    const broken: string[] = [];

    FILES.forEach((f, i) => {
      const seen = new Set<string>();
      for (const re of REFERENCE) {
        for (const m of code(f).matchAll(re)) {
          const table = m[1];
          if (seen.has(table)) continue;
          seen.add(table);

          const creator = CREATED_BY.get(table);
          if (!creator) continue;           // a view, or a table nothing creates here
          if (creator === f) continue;      // its own table

          if (FILES.indexOf(creator) > i) {
            broken.push(
              `${f} touches artist.${table}, created later by ${creator} ` +
                `(position ${FILES.indexOf(creator) + 1} vs ${i + 1})`,
            );
          }
        }
      }
    });

    expect(broken).toEqual([]);
  });

  test("memory.sql precedes label-project.sql", () => {
    // label-project.sql ends with `update artist.memory`.
    expect(FILES.indexOf("memory.sql")).toBeLessThan(FILES.indexOf("label-project.sql"));
  });
});
