/**
 * Routing reaches OpenRouter and nobody else.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { describe, expect, test } from "bun:test";
import { ROUTINGS, routingFrom } from "./config";
import { explainProviderError, openRouterSettings } from "./providers";

describe("routingFrom", () => {
  test("accepts every routing and nothing else", () => {
    for (const r of ROUTINGS) expect(routingFrom(r)).toBe(r);
    expect(routingFrom("cheapest")).toBeUndefined();
    expect(routingFrom(undefined)).toBeUndefined();
  });
});

describe("openRouterSettings", () => {
  test("quality and unset send nothing — OpenRouter's own default", () => {
    expect(openRouterSettings(undefined)).toBeUndefined();
    expect(openRouterSettings("quality")).toBeUndefined();
  });

  test("price, throughput and latency become the provider sort", () => {
    expect(openRouterSettings("price")).toEqual({ provider: { sort: "price" } });
    expect(openRouterSettings("throughput")).toEqual({ provider: { sort: "throughput" } });
    expect(openRouterSettings("latency")).toEqual({ provider: { sort: "latency" } });
  });
});

describe("explainProviderError", () => {
  test("a quota refusal is one line that says what to do", () => {
    const msg = explainProviderError({ statusCode: 429, message: "You exceeded your current quota…\n{ huge body }" });
    expect(msg).toContain("429");
    expect(msg).toContain("HOUSELABEL_PROVIDER=ollama");
    expect(msg).not.toContain("\n");
  });

  test("a rejected key points at init, in French too", () => {
    expect(explainProviderError({ statusCode: 401 })).toContain("houselabel init");
    expect(explainProviderError({ statusCode: 401 }, "fr")).toContain("houselabel init");
  });

  test("anything else keeps only its first line", () => {
    expect(explainProviderError(new Error("boom\nstack…"))).toBe("boom");
  });
});
