/**
 * `houselabel init`: provider, key and database, nothing about the artist
 * (that is engine/profile.ts). It does not ask for a model (engine/models.ts
 * picks per phase) or where data lives, unless Docker is down.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { confirm, input, password, select } from "@inquirer/prompts";
import { openCatalog } from "../data/catalog/client";
import { ROOT } from "./agent";
import { banner, bold, dim, gold } from "./banner";
import {
  DEFAULT_DATABASE_URL, ENV_KEY, readConfig, writeConfig,
  type Config, type Provider, type ProviderId, KEYLESS, SUBSCRIPTION } from "./config";
import { ping, PROVIDERS, TESTED } from "./providers";
import { strings, type Locale } from "./strings";

/**
 * Run one setup command and print ✓ or its last error lines. `env` is passed
 * explicitly: Bun snapshots the environment at startup, so the DATABASE_URL
 * set at runtime would not reach the child otherwise.
 */
export const step = async (cmd: string[], label: string): Promise<boolean> => {
  process.stdout.write(dim(`  ${label}… `));
  const p = Bun.spawn(cmd, { cwd: ROOT, env: { ...process.env }, stdout: "pipe", stderr: "pipe" });
  const ok = (await p.exited) === 0;
  console.log(ok ? gold("✓") : dim("✗"));
  if (!ok) {
    const err = (await new Response(p.stderr).text()).trim().split("\n").slice(-2).join("\n    ");
    if (err) console.log(dim(`    ${err}`));
  }
  return ok;
};

export async function init(opts: { local?: boolean; db?: string } = {}): Promise<void> {
  console.log(banner());

  // ── 1. language ──────────────────────────────────────────────────────────
  const locale = (await select({
    message: "Language / Langue",
    choices: [
      { name: "English", value: "en" },
      { name: "Français", value: "fr" },
    ],
  })) as Locale;
  const t = strings(locale);

  const existing = await readConfig();
  if (existing && !(await confirm({ message: t.redo, default: false }))) return;

  // ── 2. who answers ───────────────────────────────────────────────────────
  console.log(bold(`\n  ${t.providerHead}\n`));
  let provider = await askProvider(t);
  let apiKey = await askKey(provider, t);
  let workspaceId: string | undefined;

  // Check the key and model now, not on the first question. A subscription
  // has nothing to check.
  for (;;) {
    if (provider === SUBSCRIPTION) {
      if (!Bun.which("claude")) console.log(dim(`\n  ${t.claudeMissing}: https://claude.com/claude-code\n`));
      break;
    }
    process.stdout.write(dim(`\n  ${t.checking}… `));
    const result = await ping({ provider, apiKey, workspaceId, locale });
    if (result.ok) {
      console.log(gold("✓"));
      break;
    }
    console.log(dim("✗"));
    // Anthropic's identity-linked keys need a workspace id, not a new key.
    if (provider === "anthropic" && /workspace/i.test(result.error) && !workspaceId) {
      console.log(dim(`  ${t.workspaceWhy}`));
      console.log(dim(`  ${t.workspaceGet}: https://console.anthropic.com/settings/workspaces\n`));
      workspaceId = (await input({
        message: t.workspaceQ!,
        validate: (v) => (v.trim() ? true : t.keyRequired!),
      })).trim();
      continue;
    }
    // Ollama has no key: a failed check means it is not running.
    const keyless = KEYLESS.includes(provider as ProviderId);
    console.log(dim(`  ${keyless ? t.ollamaDown : `${t.keyBad}: ${result.error}`}\n`));
    const next = await select({
      message: t.keyRetry,
      choices: [
        ...(keyless ? [{ name: t.retryOllama!, value: "key" }] : [{ name: t.retryKey, value: "key" }]),
        { name: t.retryProvider, value: "provider" },
        { name: t.skipCheck, value: "skip" },
      ],
    });
    if (next === "skip") break;
    if (next === "provider") {
      provider = await askProvider(t);
      workspaceId = undefined;
    }
    apiKey = await askKey(provider, t);
  }

  const cfg: Config = {
    provider,
    apiKey: apiKey.trim() || undefined,
    workspaceId,
    databaseUrl: opts.db ?? DEFAULT_DATABASE_URL,
    locale,
  };
  await writeConfig(cfg);
  process.env.DATABASE_URL = cfg.databaseUrl;

  // ── 3. the database, without asking ──────────────────────────────────────
  console.log(bold(`\n  ${t.dbHead}\n`));
  if (!(await setUpDatabase(cfg, t, { managed: !opts.db }))) return;

  // ── 4. hand over ─────────────────────────────────────────────────────────
  // `houselabel profile` is listed first: every department reads that row
  // before it says anything.
  const talk =
    provider === SUBSCRIPTION
      ? `  ${bold("claude").padEnd(30)} ${dim(t.cmdClaude)}\n`
      : `  ${bold("houselabel").padEnd(30)} ${dim(t.cmdManager)}\n` +
        `  ${bold("houselabel press").padEnd(30)} ${dim(t.cmdDept)}\n`;
  console.log(
    `\n  ${gold(t.ready)}\n\n` +
      `  ${gold(bold("houselabel profile").padEnd(30))} ${dim(t.cmdProfile)}\n` +
      talk +
      `  ${bold("houselabel --staff").padEnd(30)} ${dim(t.cmdStaff)}\n\n` +
      dim(`  ${t.outro}\n`),
  );
}

async function askProvider(t: Record<string, string>): Promise<Provider> {
  // The subscription comes first: most Claude subscribers have no API account.
  const provider = (await select({
    message: t.providerQ!,
    choices: [
      { name: t.subscription! + gold(t.recommended!), value: SUBSCRIPTION as Provider },
      ...(Object.keys(PROVIDERS) as ProviderId[]).map((id) => ({ name: PROVIDERS[id].label, value: id as Provider })),
    ],
  })) as Provider;
  if (provider === SUBSCRIPTION) console.log(dim(`\n  ${t.subscriptionHow}\n`));
  else if (!TESTED.includes(provider)) console.log(dim(`\n  ${t.untested}\n`));
  return provider;
}

async function askKey(provider: Provider, t: Record<string, string>): Promise<string> {
  if (provider === SUBSCRIPTION) return "";
  // A local provider needs no key.
  if (KEYLESS.includes(provider)) {
    console.log(dim(`\n  ${PROVIDERS[provider].label}`));
    console.log(dim(`  No key needed — it runs on this machine.`));
    console.log(dim(`  If it is not installed yet: ${PROVIDERS[provider].keyUrl}\n`));
    return "";
  }
  console.log(dim(`\n  ${t.keyStored}`));
  console.log(dim(`  ${t.keyGet}: ${PROVIDERS[provider].keyUrl}\n`));
  return password({
    message: `${t.keyQ} (${ENV_KEY[provider]})`,
    mask: "•",
    validate: (v) => (v.trim() ? true : t.keyRequired!),
  });
}

/**
 * Start Postgres and migrate. The artist is asked nothing unless Docker is down.
 */
async function setUpDatabase(cfg: Config, t: Record<string, string>, opts: { managed: boolean }): Promise<boolean> {
  if (opts.managed) {
    while (!(await step(["docker", "compose", "up", "-d", "--wait"], t.dbStart!))) {
      console.log(dim(`\n  ${t.dockerOff}\n`));
      const choice = await select({
        message: t.dockerQ!,
        choices: [
          { name: t.dockerRetry!, value: "retry" },
          { name: t.dockerUrl!, value: "url" },
          { name: t.dockerQuit!, value: "quit" },
        ],
      });
      if (choice === "quit") return false;
      if (choice === "url") {
        const url = await input({
          message: t.urlQ!,
          validate: (v) => (v.startsWith("postgres") ? true : t.urlBad!),
        });
        cfg.databaseUrl = url;
        process.env.DATABASE_URL = url;
        await writeConfig(cfg);
        break;
      }
    }
  }
  if (!(await step(["bun", "run", "artist:migrate"], t.dbTables!))) return false;
  // The catalog ships as data/catalog/catalog.sqlite. Checked, not set up:
  // a failure is reported, not fatal.
  process.stdout.write(dim(`  ${t.dbCatalog}… `));
  try {
    const catalog = await openCatalog();
    await catalog.query("tools", {}, 1);
    await catalog.close();
    console.log(gold("✓"));
  } catch (err) {
    console.log(dim("✗"));
    console.log(dim(`    ${(err as Error).message.split("\n")[0]}\n    ${t.catalogLater}`));
  }
  return true;
}
