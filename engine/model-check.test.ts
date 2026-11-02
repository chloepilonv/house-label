import { describe, expect, test } from "bun:test";
import { isLive, newerThan, parseId } from "./model-check";

describe("parseId", () => {
  test("drops date stamps, keeps the version", () => {
    expect(parseId("claude-haiku-4-5-20251001")).toEqual({ family: "claude-haiku", version: [4, 5] });
    expect(parseId("gpt-5-mini-2025-08-07")).toEqual({ family: "gpt-mini", version: [5] });
    expect(parseId("gemini-3.5-flash-lite")).toEqual({ family: "gemini-flash-lite", version: [3, 5] });
  });
});

describe("newerThan", () => {
  const anthropic = ["claude-opus-5", "claude-opus-5-5", "claude-opus-5-5-20260301", "claude-sonnet-5", "claude-haiku-4-5"];

  test("finds the next version of the same family, undated", () => {
    expect(newerThan("claude-opus-5", anthropic)).toBe("claude-opus-5-5");
  });
  test("nothing newer → null", () => {
    expect(newerThan("claude-sonnet-5", anthropic)).toBeNull();
  });
  test("a different size or a preview is not an upgrade", () => {
    expect(newerThan("gpt-5", ["gpt-5", "gpt-5-mini", "gpt-6-mini"])).toBeNull();
    expect(newerThan("gemini-3.6-flash", ["gemini-3.6-flash", "gemini-3.7-flash-preview"])).toBeNull();
  });
  test("minor versions compare numerically", () => {
    expect(newerThan("gemini-3.6-flash", ["gemini-3.10-flash", "gemini-3.7-flash"])).toBe("gemini-3.10-flash");
  });
  test("-latest aliases and unversioned ids are skipped", () => {
    expect(newerThan("gemini-pro-latest", ["gemini-pro-latest", "gemini-9-pro"])).toBeNull();
    expect(newerThan("deepseek-chat", ["deepseek-chat", "deepseek-chat-2"])).toBeNull();
  });
});

describe("isLive", () => {
  test("an alias is live when only its dated snapshot is listed", () => {
    expect(isLive("claude-haiku-4-5", ["claude-haiku-4-5-20251001"])).toBe(true);
  });
  test("a longer id of another model does not count", () => {
    expect(isLive("claude-haiku-4", ["claude-haiku-4-5-20251001"])).toBe(false);
    expect(isLive("gpt-5", ["gpt-5-mini"])).toBe(false);
  });
});
