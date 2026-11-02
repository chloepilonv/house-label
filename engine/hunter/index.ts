/**
 * `houselabel connect hunter` · `disconnect hunter` · the Hunter line of
 * `connect --status`. The terminal half; engine/hunter/tools.ts is the
 * department half. Same shape as engine/buffer/index.ts.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { password } from "@inquirer/prompts";
import { bold, dim, gold } from "../banner";
import { remove, saveKey, status } from "../google/store";
import { HUNTER_KEY_URL, hunterCaller, type HunterCall } from "./client";

/** Ask for the key, prove it works (`account` is free), then save it. */
export async function connectHunter(
  opts: { key?: string; caller?: (key: string) => HunterCall } = {},
): Promise<boolean> {
  console.log(`\n  ${bold("Hunter")} — finds the journalist or music director behind a generic address.`);
  console.log(dim(`  1. Open ${HUNTER_KEY_URL} (the free plan gives 50 credits a month)`));
  console.log(dim("  2. Copy your API key and paste it below. It stays encrypted on this machine."));
  console.log(dim("  press and promotion always ask before spending a credit.\n"));

  const key = (opts.key ?? (await password({ message: "Hunter API key", mask: "*" }))).trim();
  if (!key) {
    console.log(dim("\n  Nothing entered. Nothing saved.\n"));
    return false;
  }

  let account: { email?: string; requests?: unknown };
  try {
    account = await (opts.caller ?? hunterCaller)(key)("account", {});
  } catch (err) {
    console.log(`\n  ✗ Hunter refused that key: ${(err as Error).message}\n`);
    process.exitCode = 1;
    return false;
  }

  await saveKey("hunter", key, account?.email ?? null);
  console.log(`\n  ${gold("✓")} Hunter connected${account?.email ? ` as ${bold(account.email)}` : ""}.`);
  const left = creditsLeft(account);
  if (left !== null) console.log(dim(`  ${left} credits left this month.`));
  console.log(dim("  Ask press or promotion to find the people behind your shortlist. `houselabel disconnect hunter` undoes it.\n"));
  return true;
}

/**
 * Search credits left, from `requests.searches` in Hunter's `account` reply.
 * Null when the shape is unexpected.
 */
export function creditsLeft(account: unknown): number | null {
  const s = (account as { requests?: { searches?: { available?: number; used?: number } } })?.requests?.searches;
  if (typeof s?.available !== "number" || typeof s?.used !== "number") return null;
  return Math.max(0, s.available - s.used);
}

export async function disconnectHunter(): Promise<void> {
  if (!(await remove("hunter"))) {
    console.log(dim("\n  No Hunter account was connected.\n"));
    return;
  }
  console.log(`\n  ${gold("✓")} Hunter disconnected. Delete the key itself at ${HUNTER_KEY_URL}`);
  console.log(dim("  Contacts already found stay in your database.\n"));
}

export async function printHunterStatus(): Promise<void> {
  const s = await status("hunter");
  if (!s.connected) {
    console.log(`  ${bold("Hunter")}  ${dim("not connected — `houselabel connect hunter` to link it.")}\n`);
    return;
  }
  console.log(`  ${bold("Hunter")}  ${gold("connected")}  ${dim(s.accountEmail ?? "")}`);
  console.log(dim("  asks before every lookup · `houselabel disconnect hunter` to undo it.\n"));
}
