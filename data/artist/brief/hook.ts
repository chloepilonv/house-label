/**
 * SubagentStart hook (wired in .claude/settings.json): reads the event JSON on
 * stdin and prints the department's brief as `additionalContext`, so the
 * profile is present without the agent asking. `artist:brief` still works alone.
 * Never blocks: any failure exits 0 with no context.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { openArtist } from "../client";
import { buildBrief, renderBrief } from "./rules";

/**
 * The summoned agent's name. SubagentStart names it directly; PreToolUse/Task
 * carries it in tool_input. Both are checked so the event can be swapped.
 */
function agentName(payload: Record<string, any>): string | null {
  const candidates = [
    payload.agent_type,
    payload.subagent_type,
    payload.agent,
    payload.agent_name,
    payload.tool_input?.subagent_type,
    payload.tool_input?.agent_type,
  ];
  const found = candidates.find((c) => typeof c === "string" && c.length);
  return found ?? null;
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Bun.stdin.stream()) chunks.push(chunk);
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function main() {
  const raw = (await readStdin()).trim();
  if (!raw) return; // fired with no payload — nothing to route on.

  let payload: Record<string, any>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return; // never block on a payload we cannot parse.
  }

  const agent = agentName(payload);
  if (!agent) {
    // Payload shape varies by event and version; the keys show under `claude --debug`.
    console.error(
      `[artist-brief] no agent name in the ${payload.hook_event_name ?? "hook"} payload. ` +
        `Keys present: ${Object.keys(payload).join(", ")}`,
    );
    return;
  }

  let text: string;
  try {
    const artist = await openArtist();
    try {
      text = renderBrief(await buildBrief(artist, agent));
    } finally {
      await artist.close();
    }
  } catch (err) {
    // Database unreachable: let the agent work without a brief.
    console.error(`[artist-brief] skipped: ${(err as Error).message.split("\n")[0]}`);
    return;
  }

  console.log(
    JSON.stringify({
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: payload.hook_event_name ?? "SubagentStart",
        additionalContext: text,
      },
    }),
  );
}

await main();
