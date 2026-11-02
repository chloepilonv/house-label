/**
 * `bun run models:check`: is the pinned MODELS table in engine/models.ts still
 * current? Run monthly by .github/workflows/models.yml, for every provider whose
 * key is set:
 *
 *   gone    a pinned id the provider no longer serves. Exits 1.
 *   newer   a higher version of the same family, e.g. claude-opus-5 →
 *           claude-opus-5-5. A suggestion only; exits 0.
 *
 * It never edits the table; upgrades go through evals. "Same family" is the id
 * minus version numbers and dates, so a preview or a different size never matches.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { apiKeyFor, type ProviderId } from "./config";
import { MODELS, TIERS, type Tier } from "./models";
import { PROVIDERS } from "./providers";

/** An id split into what it is (family) and which one it is (version). */
export function parseId(id: string): { family: string; version: number[] } {
  const bare = id
    .replace(/-\d{4}-\d{2}-\d{2}$/, "") // gpt-5-mini-2025-08-07
    .replace(/-\d{8}$/, "") //              claude-haiku-4-5-20251001
    .replace(/-\d{4}$/, ""); //             kimi-k2-0905
  const family: string[] = [];
  const version: number[] = [];
  for (const part of bare.split(/[-.]/)) {
    if (/^\d{1,2}$/.test(part)) version.push(Number(part));
    else family.push(part);
  }
  return { family: family.join("-"), version };
}

const compare = (a: number[], b: number[]): number => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
};

/** The highest-versioned live id of the same family as `pinned`, if it is newer. */
export function newerThan(pinned: string, live: string[]): string | null {
  const p = parseId(pinned);
  // `-latest` aliases move by themselves, and an unversioned id
  // (deepseek-chat) has nothing to compare.
  if (/latest/.test(pinned) || p.version.length === 0) return null;
  let best: { id: string; version: number[] } | null = null;
  for (const id of live) {
    const c = parseId(id);
    if (c.family !== p.family || compare(c.version, p.version) <= 0) continue;
    // Among equal versions prefer the undated alias: claude-opus-5-5 over
    // claude-opus-5-5-20260301.
    if (!best || compare(c.version, best.version) > 0 || (compare(c.version, best.version) === 0 && id.length < best.id.length))
      best = { id, version: c.version };
  }
  return best?.id ?? null;
}

/**
 * Whether a pinned id is served. Anthropic lists only the dated snapshot
 * (claude-haiku-4-5-20251001) while still answering to its alias
 * (claude-haiku-4-5), so an alias counts as live when a dated id extends it.
 */
export const isLive = (pinned: string, live: string[]): boolean =>
  live.some((id) => id === pinned || (id.startsWith(`${pinned}-`) && /^\d{8}$|^\d{4}-\d{2}-\d{2}$/.test(id.slice(pinned.length + 1))));

/** Each provider's own "list models" endpoint. Ollama is skipped: it is the artist's machine. */
async function listModels(provider: ProviderId, key: string): Promise<string[]> {
  const get = async (url: string, headers: Record<string, string> = {}) => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.json() as Promise<any>;
  };
  switch (provider) {
    case "anthropic": {
      const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
      const json = await get("https://api.anthropic.com/v1/models?limit=1000", {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        ...(workspace ? { "anthropic-workspace-id": workspace } : {}),
      });
      return json.data.map((m: { id: string }) => m.id);
    }
    case "google": {
      const json = await get(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${key}`);
      return json.models.map((m: { name: string }) => m.name.replace(/^models\//, ""));
    }
    case "openrouter": {
      const json = await get("https://openrouter.ai/api/v1/models", { authorization: `Bearer ${key}` });
      return json.data.map((m: { id: string }) => m.id);
    }
    default: {
      // Every other provider in the table speaks OpenAI's /models.
      const base = PROVIDERS[provider].baseURL ?? "https://api.openai.com/v1";
      const json = await get(`${base}/models`, { authorization: `Bearer ${key}` });
      return json.data.map((m: { id: string }) => m.id);
    }
  }
}

type Finding = { provider: ProviderId; tier: Tier; pinned: string; kind: "gone" | "newer"; live?: string };

async function main() {
  const findings: Finding[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];
  let checked = 0;

  for (const provider of Object.keys(MODELS) as ProviderId[]) {
    if (provider === "ollama") continue;
    const key = apiKeyFor(provider);
    if (!key) {
      skipped.push(provider);
      continue;
    }
    let live: string[];
    try {
      live = await listModels(provider, key);
    } catch (err) {
      failed.push(`${provider}: ${(err as Error).message}`);
      continue;
    }
    checked++;
    // A tier pinned to the same id twice (openai standard = deep) is reported once.
    const seen = new Set<string>();
    for (const tier of TIERS) {
      const pinned = MODELS[provider][tier];
      if (seen.has(pinned)) continue;
      seen.add(pinned);
      if (!isLive(pinned, live)) findings.push({ provider, tier, pinned, kind: "gone" });
      else {
        const next = newerThan(pinned, live);
        if (next) findings.push({ provider, tier, pinned, kind: "newer", live: next });
      }
    }
  }

  const gone = findings.filter((f) => f.kind === "gone");
  const newer = findings.filter((f) => f.kind === "newer");
  const lines = [`## Model check — ${new Date().toISOString().slice(0, 10)}`, ""];
  lines.push(`Checked ${checked} provider(s) against \`engine/models.ts\`.`, "");
  if (gone.length) {
    lines.push("### ❌ Gone — artists on these get a 404", "");
    for (const f of gone) lines.push(`- **${f.provider}** \`${f.tier}\`: \`${f.pinned}\` is no longer listed`);
    lines.push("");
  }
  if (newer.length) {
    lines.push("### ⬆️ Newer version available — upgrade after the evals pass", "");
    for (const f of newer) lines.push(`- **${f.provider}** \`${f.tier}\`: \`${f.pinned}\` → \`${f.live}\``);
    lines.push("");
  }
  if (!findings.length && checked) lines.push("✅ Every pinned model is live and current.", "");
  if (failed.length) lines.push("### Could not list", "", ...failed.map((f) => `- ${f}`), "");
  if (skipped.length) lines.push(`Not checked (no key set): ${skipped.join(", ")}`, "");
  const report = lines.join("\n");
  console.log(report);

  // The workflow opens an issue from this file when it has something in it.
  const out = process.env.MODEL_CHECK_REPORT;
  if (out && findings.length) await Bun.write(out, report);

  // Fails when nothing was checked, a key is bad, or a pinned model is gone.
  if (!checked || failed.length || gone.length) process.exit(1);
}

if (import.meta.main) await main();
