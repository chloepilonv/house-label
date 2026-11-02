/**
 * Which company's model answers the artist. The only file that knows; the rest
 * of engine/ takes a tier. OpenAI-shaped providers (DeepSeek, Moonshot,
 * Mistral, Groq) are just a known base URL.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { SUBSCRIPTION, type Config, type ProviderId, type Routing } from "./config";
import { modelFor, type Tier } from "./models";

export interface ProviderInfo {
  label: string;
  /** Shown before the key prompt so the artist knows where to get one. */
  keyUrl: string;
  /** OpenAI-compatible providers: the endpoint we already know. */
  baseURL?: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    label: "Anthropic — Claude",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    label: "OpenAI — GPT",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  google: {
    label: "Google — Gemini",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  openrouter: {
    label: "OpenRouter — one key, most models",
    keyUrl: "https://openrouter.ai/keys",
  },
  deepseek: {
    label: "DeepSeek",
    keyUrl: "https://platform.deepseek.com/api_keys",
    baseURL: "https://api.deepseek.com/v1",
  },
  moonshot: {
    label: "Moonshot — Kimi",
    keyUrl: "https://platform.moonshot.ai/console/api-keys",
    baseURL: "https://api.moonshot.ai/v1",
  },
  mistral: {
    label: "Mistral",
    keyUrl: "https://console.mistral.ai/api-keys",
    baseURL: "https://api.mistral.ai/v1",
  },
  ollama: {
    label: "Ollama — on your own machine, no key, no bill",
    keyUrl: "https://ollama.com/download",
    baseURL: "http://localhost:11434/v1",
  },
  groq: {
    label: "Groq — fast, open models",
    keyUrl: "https://console.groq.com/keys",
    baseURL: "https://api.groq.com/openai/v1",
  },
};

/**
 * Whether this provider was tested against the departments. Skills are tuned
 * on Claude, so the CLI tells the artist when a provider is untested.
 */
export const TESTED: ProviderId[] = ["anthropic"];

/**
 * The provider-routing block OpenRouter reads from a request. `quality` is
 * OpenRouter's own default, so it sends nothing rather than restating it.
 */
export function openRouterSettings(routing: Routing | undefined): { provider: { sort: Routing } } | undefined {
  return routing && routing !== "quality" ? { provider: { sort: routing } } : undefined;
}

/** Turn config plus a tier into the model object the engine calls. */
export function resolveModel(cfg: Config, tier: Tier): LanguageModel {
  // A subscription runs in Claude Code, never through this engine.
  if (cfg.provider === SUBSCRIPTION)
    throw new Error("This label runs in Claude Code. Open Claude Code in the label's folder and talk to it there.");
  const apiKey = cfg.apiKey ?? "";
  const id = modelFor(cfg.provider, tier, cfg.models);
  const baseURL = cfg.baseURL ?? PROVIDERS[cfg.provider].baseURL;

  switch (cfg.provider) {
    case "anthropic":
      // Identity-linked keys are refused without the workspace they act in.
      return createAnthropic({
        apiKey,
        ...(baseURL ? { baseURL } : {}),
        ...(cfg.workspaceId ? { headers: { "anthropic-workspace-id": cfg.workspaceId } } : {}),
      })(id);
    case "google":
      return createGoogleGenerativeAI({ apiKey, ...(baseURL ? { baseURL } : {}) })(id);
    case "openrouter":
      // `.chat` because the settings argument lives there; same endpoint.
      return createOpenRouter({ apiKey }).chat(id, openRouterSettings(cfg.routing));
    // Everything else speaks OpenAI, including Ollama on localhost. Ollama
    // ignores the key, but the SDK needs a non-empty one.
    default: {
      // Bun aborts a fetch after five idle minutes, and local reasoning models
      // can take longer before the first byte. `timeout: false` disables that
      // (oven-sh/bun#16682). Local only: a silent hosted model is down.
      const patient: typeof fetch = (input, init) =>
        fetch(input, { ...init, timeout: false } as RequestInit);
      const openai = createOpenAI({
        apiKey: apiKey || "ollama",
        ...(baseURL ? { baseURL } : {}),
        ...(cfg.provider === "ollama" ? { fetch: patient } : {}),
      });
      // OpenAI gets the Responses API. Other hosts here speak Chat Completions
      // only; Ollama's /v1/responses fails from the second turn on.
      return cfg.provider === "openai" ? openai(id) : openai.chat(id);
    }
  }
}

/**
 * A provider failure in one line an artist can act on, instead of the SDK's
 * full error object. The status code says what to do.
 */
export function explainProviderError(err: unknown, locale: "en" | "fr" = "en"): string {
  const e = err as { statusCode?: number; message?: string; lastError?: { statusCode?: number } };
  const status = e?.statusCode ?? e?.lastError?.statusCode;
  const fr = locale === "fr";
  if (status === 429)
    return fr
      ? "Ton fournisseur refuse : quota dépassé (429). Attends un peu, ajoute du crédit, ou passe à Ollama avec HOUSELABEL_PROVIDER=ollama."
      : "Your provider refused: quota exceeded (429). Wait a bit, add credit, or switch to Ollama with HOUSELABEL_PROVIDER=ollama.";
  if (status === 401 || status === 403)
    return fr
      ? `Ton fournisseur refuse la clé (${status}). Relance houselabel init pour en coller une autre.`
      : `Your provider rejected the key (${status}). Run houselabel init to paste another one.`;
  const first = (e?.message ?? String(err)).split("\n")[0]!.slice(0, 200);
  return status ? `${first} (${status})` : first;
}

/**
 * One cheap call at the end of `init` to check the model names in models.ts
 * still exist for this provider, so a rename fails here, not on the first question.
 */
export async function ping(cfg: Config, tier: Tier = "fast"): Promise<{ ok: true } | { ok: false; error: string }> {
  const { generateText } = await import("ai");
  try {
    await generateText({ model: resolveModel(cfg, tier), prompt: "Say ok.", maxOutputTokens: 5 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message.split("\n")[0] ?? "unknown error" };
  }
}

/**
 * Provider options for one request: caching, Anthropic only.
 *
 * Top-level `cacheControl` caches the last cacheable block, which covers tools
 * and the whole system prompt. The cache is a prefix match, so nothing volatile
 * may enter the system prompt: `todayBlock` and the artist's file are read once
 * per session, and the tier changes per phase, never per turn.
 */
export function cacheOptions(
  cfg: Config,
  phase?: "greeting" | "interview" | "work" | "chat",
): Record<string, Record<string, unknown>> | undefined {
  if (cfg.provider !== "anthropic") return undefined;

  // Thinking does not stream as text, so it delays the first visible token.
  // `effort: "low"` still produced no text; only `disabled` removes the pause.
  // Talking phases run on the standard tier, which accepts disabled thinking;
  // the work phase keeps it.
  const talking = phase === "interview" || phase === "chat" || phase === "greeting";
  return {
    anthropic: {
      cacheControl: { type: "ephemeral", ttl: "1h" },
      ...(talking ? { thinking: { type: "disabled" } } : {}),
    },
  };
}
