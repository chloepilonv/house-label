/**
 * Three tiers per provider, never asked of the artist:
 *
 *   fast      interviews, chat turns, routing.
 *   standard  a department doing its normal job.
 *   deep      the generation phase: a release plan, a presskit, a pitch.
 *
 * Tiers switch only at the sentinel boundary in questions.ts, never per turn:
 * a model change invalidates the prompt cache. `houselabel init` pings the
 * provider to catch stale ids.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import type { ProviderId } from "./config";

export type Tier = "fast" | "standard" | "deep";

export const TIERS: Tier[] = ["fast", "standard", "deep"];

export const TIER_LABEL: Record<Tier, string> = {
  fast: "quick back-and-forth",
  standard: "everyday work",
  deep: "the heavy thinking",
};

export const MODELS: Record<ProviderId, Record<Tier, string>> = {
  anthropic: {
    fast: "claude-haiku-4-5",
    standard: "claude-sonnet-5",
    deep: "claude-opus-5",
  },
  openai: {
    fast: "gpt-5-mini",
    standard: "gpt-5",
    deep: "gpt-5",
  },
  google: {
    // `gemini-2.5-pro` is listed but refused for new keys. `-latest` on the pro rung.
    fast: "gemini-3.5-flash-lite",
    standard: "gemini-3.6-flash",
    deep: "gemini-pro-latest",
  },
  openrouter: {
    fast: "anthropic/claude-haiku-4.5",
    standard: "anthropic/claude-sonnet-4.5",
    deep: "anthropic/claude-opus-4.1",
  },
  deepseek: {
    fast: "deepseek-chat",
    standard: "deepseek-chat",
    deep: "deepseek-reasoner",
  },
  moonshot: {
    fast: "kimi-k2-turbo-preview",
    standard: "kimi-k2-0905-preview",
    deep: "kimi-k2-0905-preview",
  },
  mistral: {
    fast: "mistral-small-latest",
    standard: "mistral-large-latest",
    deep: "mistral-large-latest",
  },
  ollama: {
    // Sized for a 24 GB machine; `ollama pull <name>`. `houselabel init` checks
    // the name against the running server.
    fast: "qwen3:8b",
    standard: "qwen3:14b",
    deep: "qwen3:14b",
  },
  groq: {
    fast: "openai/gpt-oss-20b",
    standard: "openai/gpt-oss-120b",
    deep: "openai/gpt-oss-120b",
  },
};

/**
 * A department's tier, from its AGENT.md `tier:` field. Not `model:`, which
 * belongs to Claude Code (agents/sync.ts copies it to .claude/agents/).
 * Defaults to `standard`; agents/sync.ts --check refuses a missing tier.
 */
export function tierFor(front: Record<string, string>): Tier {
  const declared = (front.tier ?? "").trim().toLowerCase();
  return (TIERS as string[]).includes(declared) ? (declared as Tier) : "standard";
}

/** The model id for a provider at a tier, honouring a hand-edited override. */
export function modelFor(provider: ProviderId, tier: Tier, overrides?: Partial<Record<Tier, string>>): string {
  return overrides?.[tier] ?? MODELS[provider][tier];
}
