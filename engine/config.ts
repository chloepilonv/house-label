/**
 * The artist's setup, in ~/.houselabel/config.json (not the repo, not a .env).
 * Written 0600 because it holds an API key. Environment variables override the
 * file. No `model` field: engine/models.ts picks per phase; `models` is a hand-edit pin.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Tier } from "./models";

/**
 * How OpenRouter picks the host that serves the model, per request.
 *
 *   quality     OpenRouter's default balance of price and uptime.
 *   price       the cheapest host serving that model right now.
 *   throughput  the host streaming the most tokens per second right now.
 *   latency     the host answering first right now.
 *
 * The model is still chosen by engine/models.ts; this picks the host. Other
 * providers ignore it.
 */
export type Routing = "quality" | "price" | "throughput" | "latency";
export const ROUTINGS: Routing[] = ["quality", "price", "throughput", "latency"];

export type ProviderId =
  | "anthropic"
  | "openai"
  | "google"
  | "openrouter"
  | "deepseek"
  | "moonshot"
  | "mistral"
  | "groq"
  | "ollama";

/**
 * The artist's own Claude subscription, through Claude Code. Not a ProviderId:
 * the departments are already Claude Code subagents, so `houselabel` only points there.
 */
export const SUBSCRIPTION = "claude-code" as const;
export type Provider = ProviderId | typeof SUBSCRIPTION;

export interface Config {
  provider: Provider;
  /** Held here only for self-hosting. The cloud passes ANTHROPIC_API_KEY etc. */
  apiKey?: string;
  /** Anthropic identity-linked keys must say which workspace a request acts
   *  in; the wizard asks for this only when the API demands it. */
  workspaceId?: string;
  /** Hand-edited escape hatch. Pin one tier, or all three. */
  models?: Partial<Record<Tier, string>>;
  /** Hand-edited escape hatch: point a provider at a different endpoint. */
  baseURL?: string;
  /** OpenRouter only: which host serves the model. Unset means `quality`. */
  routing?: Routing;
  /** The artist's own Postgres. */
  databaseUrl?: string;
  /**
   * The artist's own Google OAuth client. Stored here because `.env.local` is not
   * read outside the repo; the hosted service uses env vars. See engine/google/auth.ts.
   */
  google?: { clientId?: string; clientSecret?: string };
  /** The language the label speaks. Asked first, because it governs the rest. */
  locale: "en" | "fr";
}

export const CONFIG_DIR = join(homedir(), ".houselabel");
export const CONFIG_PATH = join(CONFIG_DIR, "config.json");

// Port 5433, matching docker-compose.yml (avoids a system Postgres on 5432).
// These defaults must work before any `.env.local` exists.
export const DEFAULT_DATABASE_URL = "postgres://postgres:postgres@localhost:5433/music_label_artist";

export async function readConfig(): Promise<Config | null> {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, "utf8")) as Config;
  } catch {
    return null;
  }
}

export async function writeConfig(cfg: Config): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
  // The file holds a key.
  await chmod(CONFIG_PATH, 0o600);
}

/**
 * The config the engine runs on: file, then environment on top. DB URLs are
 * exported to process.env because data/artist/client.ts and
 * data/catalog/client.ts read them there.
 */
export async function resolveConfig(): Promise<Config | null> {
  const file = await readConfig();
  const provider = (process.env.HOUSELABEL_PROVIDER as Provider | undefined) ?? file?.provider;
  if (!provider) return null;

  const cfg: Config = {
    provider,
    apiKey: (provider === SUBSCRIPTION ? undefined : apiKeyFor(provider)) ?? file?.apiKey,
    workspaceId: process.env.ANTHROPIC_WORKSPACE_ID ?? file?.workspaceId,
    models: file?.models,
    baseURL: process.env.HOUSELABEL_BASE_URL ?? file?.baseURL,
    routing: routingFrom(process.env.HOUSELABEL_ROUTING) ?? file?.routing,
    databaseUrl: process.env.DATABASE_URL ?? file?.databaseUrl ?? DEFAULT_DATABASE_URL,
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? file?.google?.clientId,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? file?.google?.clientSecret,
    },
    locale: file?.locale ?? "en",
  };

  if (cfg.databaseUrl) process.env.DATABASE_URL = cfg.databaseUrl;
  // engine/google/auth.ts reads these from the environment.
  if (cfg.google?.clientId) process.env.GOOGLE_CLIENT_ID = cfg.google.clientId;
  if (cfg.google?.clientSecret) process.env.GOOGLE_CLIENT_SECRET = cfg.google.clientSecret;
  return cfg;
}

/** A routing name if it is one we know; a typo is unset, not a crash. */
export const routingFrom = (value: string | undefined): Routing | undefined =>
  (ROUTINGS as string[]).includes(value ?? "") ? (value as Routing) : undefined;

/** The env var each provider's own SDK already looks for. */
/**
 * Other names for the same key, tried after the canonical one. Google's docs
 * say `GEMINI_API_KEY`; the Vercel package wants `GOOGLE_GENERATIVE_AI_API_KEY`.
 */
export const ENV_KEY_ALIASES: Partial<Record<ProviderId, string[]>> = {
  google: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  openrouter: ["OPEN_ROUTER_API_KEY"],
  moonshot: ["KIMI_API_KEY"],
};

/** The key for a provider, whichever of its accepted names it was set under. */
/** Providers that need no key, because nothing leaves the machine. */
export const KEYLESS: ProviderId[] = ["ollama"];

export const apiKeyFor = (provider: ProviderId): string | undefined =>
  [ENV_KEY[provider], ...(ENV_KEY_ALIASES[provider] ?? [])]
    .map((n) => process.env[n])
    .find((v) => v && v.trim().length > 0);

export const ENV_KEY: Record<ProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  moonshot: "MOONSHOT_API_KEY",
  mistral: "MISTRAL_API_KEY",
  groq: "GROQ_API_KEY",
  // Ollama needs no key; the entry keeps the map total and is never read.
  ollama: "OLLAMA_API_KEY",
};
