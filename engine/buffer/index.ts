/**
 * `houselabel connect buffer` · `disconnect buffer` · the Buffer line of
 * `connect --status`. The terminal half; engine/buffer/tools.ts is the
 * department half.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { password } from "@inquirer/prompts";
import { bold, dim, gold } from "../banner";
import { remove, saveKey, status } from "../google/store";
import { BUFFER_KEY_URL, bufferCaller, type BufferCall } from "./client";

/** Ask for the key, prove it works, then save it, so a typo is caught here. */
export async function connectBuffer(
  opts: { key?: string; caller?: (key: string) => BufferCall } = {},
): Promise<boolean> {
  console.log(`\n  ${bold("Buffer")} — your posts, saved as drafts you schedule yourself.`);
  console.log(dim(`  1. Open ${BUFFER_KEY_URL}`));
  console.log(dim("  2. Create a key and paste it below. It stays encrypted on this machine."));
  console.log(dim("  The label only ever saves DRAFTS. Nothing posts until you schedule it in Buffer.\n"));

  const key = (opts.key ?? (await password({ message: "Buffer API key", mask: "*" }))).trim();
  if (!key) {
    console.log(dim("\n  Nothing entered. Nothing saved.\n"));
    return false;
  }

  let account: string;
  try {
    account = await (opts.caller ?? bufferCaller)(key)("get_account", {});
  } catch (err) {
    console.log(`\n  ✗ Buffer refused that key: ${(err as Error).message}\n`);
    process.exitCode = 1;
    return false;
  }

  await saveKey("buffer", key, accountLabel(account));
  console.log(`\n  ${gold("✓")} Buffer connected${accountLabel(account) ? ` as ${bold(accountLabel(account)!)}` : ""}.`);
  console.log(dim("  Ask digital-marketing to draft your posts. `houselabel disconnect buffer` undoes it.\n"));
  return true;
}

/** The email in Buffer's account reply, if there is one. Shown, never the key. */
export function accountLabel(account: string): string | null {
  return account.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? null;
}

export async function disconnectBuffer(): Promise<void> {
  if (!(await remove("buffer"))) {
    console.log(dim("\n  No Buffer account was connected.\n"));
    return;
  }
  console.log(`\n  ${gold("✓")} Buffer disconnected. Delete the key itself at ${BUFFER_KEY_URL}`);
  console.log(dim("  Drafts already in Buffer stay there.\n"));
}

export async function printBufferStatus(): Promise<void> {
  const s = await status("buffer");
  if (!s.connected) {
    console.log(`  ${bold("Buffer")}  ${dim("not connected — `houselabel connect buffer` to link it.")}\n`);
    return;
  }
  console.log(`  ${bold("Buffer")}  ${gold("connected")}  ${dim(s.accountEmail ?? "")}`);
  console.log(dim("  drafts only · `houselabel disconnect buffer` to undo it.\n"));
}
