/**
 * Parsing of artist.profile.members, the testable part of the profile form.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { parseMembers, readMembers, renderMembers } from "./members";

describe("parseMembers", () => {
  test("name only", () => {
    expect(parseMembers("Ali")).toEqual([{ name: "Ali", role: null }]);
  });

  test("names with roles", () => {
    expect(parseMembers("Ali (drums), Jo (bass)")).toEqual([
      { name: "Ali", role: "drums" },
      { name: "Jo", role: "bass" },
    ]);
  });

  test("a role may contain a comma", () => {
    expect(parseMembers("Jo (bass, backing vocals), Ali")).toEqual([
      { name: "Jo", role: "bass, backing vocals" },
      { name: "Ali", role: null },
    ]);
  });

  test("empty parens are no role, not an empty role", () => {
    expect(parseMembers("Ali ()")).toEqual([{ name: "Ali", role: null }]);
  });

  test("blank input and stray commas produce no members", () => {
    expect(parseMembers("")).toEqual([]);
    expect(parseMembers("  ,  , ")).toEqual([]);
  });

  test("accents and hyphens survive", () => {
    expect(parseMembers("Marie-Ève Côté (violoncelle)")).toEqual([
      { name: "Marie-Ève Côté", role: "violoncelle" },
    ]);
  });
});

describe("renderMembers", () => {
  // The edit screen prefills with this, so it must round-trip exactly.
  test("round-trips through parseMembers", () => {
    const line = "Jo (bass, backing vocals), Ali (drums), Sam";
    expect(renderMembers(parseMembers(line))).toBe(line);
  });
});

describe("readMembers", () => {
  test("reads jsonb that postgres already parsed", () => {
    expect(readMembers([{ name: "Ali", role: "drums" }])).toEqual([{ name: "Ali", role: "drums" }]);
  });

  test("reads a json string", () => {
    expect(readMembers('[{"name":"Ali"}]')).toEqual([{ name: "Ali", role: null }]);
  });

  test("a null column, bad json, or a nameless entry is no members", () => {
    expect(readMembers(null)).toEqual([]);
    expect(readMembers("not json")).toEqual([]);
    expect(readMembers([{ role: "drums" }])).toEqual([]);
  });
});
