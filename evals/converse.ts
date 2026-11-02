/**
 * Hold a real conversation with a department, with nobody in the room.
 *
 *   bun run evals:converse digital-marketing
 *   bun run evals:converse digital-marketing --task digital-marketing-plan --turns 20
 *   bun run evals:converse press --persona indie-persona
 *
 * WHY THIS EXISTS, AND WHAT `evals:run` CANNOT DO. The eval runner fires one
 * prompt and reads one reply. Every failure this department actually shipped
 * was multi-turn and invisible to it:
 *
 *   - the first sentence recorded as the answer to question one
 *   - "yes" to an offer rejected, because the value was not in `options`
 *   - the artist correcting the budget mid-interview, and the correction lost
 *     at save time
 *   - a turn that returned nothing at all, because the step budget was spent
 *   - twenty dated tasks described in a paragraph instead of listed
 *
 * None of those are a bad answer to a question. They are a bad conversation,
 * and you cannot see one without having it.
 *
 * So: a persona model plays the artist, the department answers, and the whole
 * exchange is written to `.transcripts/` in the same shape the terminal writes.
 * `recruit-debrief` reads it without caring which one produced it.
 *
 * TWO PERSONAS AT LEAST, AND THEY FAIL DIFFERENTLY. `indie-persona` has never
 * released anything and knows none of the words; `odile-ray` has three records
 * and will say "that's in my presskit". A department that passes one can fail
 * the other in the opposite direction — unexplained jargon on one side,
 * condescension on the other — and neither shows up without both.
 *
 * THE PERSONA IS NOT A HELPFUL USER. It is short, non-technical, asks what
 * words mean, gives two answers at once and changes its mind — because that is
 * what surfaced every bug above. A cooperative simulated user proves nothing:
 * it answers in the shape the prompt asked for and every question looks fine.
 *
 * NEVER POINT THIS AT THE ARTIST'S DATABASE. It talks to a department that
 * writes rows. `EVAL_DATABASE_URL` is required and `DATABASE_URL` is refused.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { generateText } from "ai";
import postgres from "postgres";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, listStaff, loadDepartment } from "../engine/agent";
import { lineFor, renderGreeting } from "../engine/greeting";
import { resolveConfig } from "../engine/config";
import { resolveModel } from "../engine/providers";
import { startConversation } from "../engine/session";
import { openSession, readBriefFor } from "../engine/tools";
import { openTranscript } from "../engine/transcript";

const argv = process.argv.slice(2);
const arg = (flag: string): string | undefined => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};

const dept = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1]?.startsWith("--") !== true);
const persona = arg("--persona") ?? "indie-persona";
const task = arg("--task");
const maxTurns = Number(arg("--turns") ?? 16);

/**
 * Seconds to wait between turns.
 *
 * A free tier is a rate limit, and a persona conversation is the worst shape
 * for one: every turn is TWO requests, the department's and the artist's.
 * Gemini's free tier allows five requests a minute, so an unpaced run dies on
 * turn three with a 429 — which reads like the department broke when nothing
 * did. Groq's free tier fails differently and earlier: 8,000 tokens a minute
 * against a 13,000-token system prompt, so no pacing saves it.
 */
const PACE: Record<string, number> = { google: 26, groq: 0, anthropic: 0 };
const pace = Number(arg("--pace") ?? PACE[process.env.HOUSELABEL_PROVIDER ?? "anthropic"] ?? 0);
const wait = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

if (!dept) {
  console.error("usage: bun run evals:converse <department> [--persona indie-persona] [--task <skill>] [--turns 16]");
  process.exit(1);
}

// The eval database, and only ever the eval database. A department writes rows
// mid-conversation; pointed at DATABASE_URL this would put a simulated artist's
// answers into the real artist's file.
const evalUrl = process.env.EVAL_DATABASE_URL;
if (!evalUrl) {
  console.error("✗ EVAL_DATABASE_URL is not set. This talks to a department that WRITES — it must never run against the artist's database.");
  process.exit(1);
}
if (evalUrl === process.env.DATABASE_URL) {
  console.error("✗ EVAL_DATABASE_URL and DATABASE_URL are the same database. Refusing: this writes.");
  process.exit(1);
}
process.env.DATABASE_URL = evalUrl;

const personaPath = join(ROOT, "evals", "user-personas", `${persona}.md`);
if (!existsSync(personaPath)) {
  console.error(`✗ No persona at ${personaPath}`);
  process.exit(1);
}
const personaPrompt = readFileSync(personaPath, "utf8");

// THE PERSONA AND THE DATABASE HAVE TO MATCH. Run indie-persona against a
// database seeded with Odile Ray and the department greets a first-time
// artist by the wrong name and offers them three albums they have not made —
// which is a harness bug wearing the costume of a department bug. Each persona
// ships a fixture beside it; loading it is not optional.
const fixturePath = join(ROOT, "evals", "user-personas", `${persona}.fixture.sql`);
if (!existsSync(fixturePath)) {
  console.error(
    `✗ No fixture at ${fixturePath}\n` +
      `  A persona without one would run against whatever the last run left behind.`,
  );
  process.exit(1);
}
{
  const sql = postgres(evalUrl, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(readFileSync(fixturePath, "utf8"));
    console.log(`\n  seeded ${persona} into ${evalUrl.split("/").pop()}`);
  } catch (err) {
    console.error(`✗ fixture failed: ${(err as Error).message}`);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

const cfg = await resolveConfig();
if (!cfg) {
  console.error("✗ Not configured. Run `houselabel init`.");
  process.exit(1);
}

const session = openSession();
const department = await loadDepartment(dept);
const convo = startConversation(department, cfg, {
  session,
  colleagues: await listStaff(),
  brief: await readBriefFor(dept, session),
});

// Recorded exactly like a terminal session, so `recruit-debrief` cannot tell
// the difference and does not need to.
// ALWAYS ON HERE, and only here. Recording is opt-in for a real artist —
// `houselabel --log` — because a transcript is them talking to their own label
// about what they earn. A simulated artist has no privacy to protect, and a
// persona run whose transcript was not kept is a run that proved nothing.
const rec = openTranscript(`${dept}-${persona}`, true);

console.log(`\n  ${department.staffMember} · ${department.department}  ×  ${persona}`);
console.log(`  ${maxTurns} turns max · ${evalUrl.split("/").pop()}\n`);

/** What the artist says next, given everything said so far. */
const history: { role: "user" | "assistant"; content: string }[] = [];
async function artistSays(lastFromLabel: string): Promise<string> {
  history.push({ role: "user", content: lastFromLabel });
  const { text } = await generateText({
    // The persona says one short thing, so 300 output tokens felt generous.
    // It is not: on a reasoning model the whole budget goes to thinking and
    // the text comes back EMPTY. That produced a twenty-turn transcript where
    // the artist said nothing and the department re-asked the same question
    // into silence — and it reads exactly like a department stuck in a loop.
    //
    // The cap is a ceiling, not a spend: a persona reply is two sentences, so
    // raising it costs nothing on a model that does not think and rescues the
    // run on one that does.
    model: resolveModel(cfg!, "fast"),
    system: personaPrompt,
    messages: history,
    maxOutputTokens: 2000,
  });
  history.push({ role: "assistant", content: text });
  return text.trim();
}

let done = false;
let turn = 0;
let retries = 0;

// The staff member says hello first, the way it does in the terminal, and the
// persona answers it in a sentence — which `session.ts` reads the way it
// reads a real artist's. `--task` skips the hello and starts that task
// directly, for a run that is testing the interview rather than the routing.
let next: string;
if (task) {
  await convo.begin({ task });
  const skill = department.skills.find((s) => s.name === task);
  next = skill ? lineFor(skill, "en") : task;
} else {
  const greeting = renderGreeting(department, cfg.locale === "fr" ? "fr" : "en");
  console.log(`\x1b[2m── hello\x1b[0m\n${greeting}\n`);
  rec?.turn({ said: "", replied: greeting, phase: convo.phase });
  next = await artistSays(greeting);
}

while (!done && turn < maxTurns) {
  turn += 1;
  const phase = convo.phase;
  let said = "";
  let complete = false;
  try {
    const t = await convo.send(next, (c) => {
      said += c;
    });
    complete = t.complete;
  } catch (err) {
    said = `✗ ${(err as Error).message}`;
  }
  // A provider error is not something to tell the artist about. Feeding
  // "✗ No output generated" to the persona produced a conversation where it
  // kept replying "Where are we?" to a rate limiter.
  if (said.startsWith("✗") || !said.trim()) {
    if (retries < 2) {
      retries += 1;
      console.log(`\x1b[33m   … ${said.slice(0, 90) || "empty reply"} — waiting 60s and retrying turn ${turn}\x1b[0m`);
      turn -= 1;
      await wait(60);
      continue;
    }
    console.log(`\x1b[31m  ⚠ the department failed twice in a row. Stopping.\x1b[0m\n`);
    break;
  }
  retries = 0;

  rec?.turn({ said: next, replied: said, phase, task: convo.task });
  console.log(`\x1b[2m── turn ${turn} · ${phase}\x1b[0m`);
  console.log(`\x1b[36m  artist ›\x1b[0m ${next}`);
  console.log(`  ${said.replace(/\n/g, "\n  ")}\n`);

  // THE WORK IS THE POINT, AND THE ARTIST WILL END THE CONVERSATION BEFORE IT
  // HAPPENS. A sixteen-turn interview with Odile Ray ran beautifully, she said
  // "that's the plan", and the run stopped with zero campaigns, zero ideas and
  // zero tasks in the database — because the phase had only just turned to
  // `work` and the loop handed control back to a persona that was finished.
  //
  // A real artist presses enter again. So when the interview signals complete,
  // the harness does too: it says yes on the artist's behalf and lets the
  // department build the thing, and only then asks the persona what it thinks.
  if (complete) {
    console.log(`\x1b[2m   … interview complete — letting the department do the work\x1b[0m`);
    next = "Yes, go ahead — build it.";
    continue;
  }

  const reply = await artistSays(said);

  // AN ARTIST WHO SAYS NOTHING IS NOT AN ARTIST. A silent persona turns the
  // run into a department talking to itself, and every turn after that is
  // noise that looks like a department bug.
  if (!reply.trim()) {
    if (retries < 2) {
      retries += 1;
      console.log(`\x1b[33m   … the persona returned nothing — retrying turn ${turn}\x1b[0m`);
      turn -= 1;
      history.splice(-2);
      continue;
    }
    console.log(`\x1b[31m  ⚠ the persona returned nothing twice. Stopping — this is a harness fault, not the department's.\x1b[0m\n`);
    break;
  }

  // [DONE] IS NOT AVAILABLE UNTIL THE INTERVIEW COULD PLAUSIBLY BE OVER. A
  // persona on an eager model ended a run after ONE answer — it had given the
  // campaign a name and decided that was the job. A department that asks twelve
  // questions cannot be finished in one, so an early [DONE] is the persona
  // breaking character, not a conversation reaching its end.
  const MIN_TURNS_BEFORE_DONE = 8;
  if (reply.includes("[DONE]") && turn < MIN_TURNS_BEFORE_DONE) {
    console.log(`\x1b[33m   … persona said [DONE] on turn ${turn}; too early to be real, continuing\x1b[0m`);
    next = reply.replaceAll("[DONE]", "").trim() || "Keep going.";
    if (pace) await wait(pace);
    continue;
  }

  if (reply.includes("[DONE]")) {
    done = true;
    const last = reply.replaceAll("[DONE]", "").trim();
    if (last) console.log(`\x1b[36m  artist ›\x1b[0m ${last}\n`);
    break;
  }
  next = reply;
  if (pace) await wait(pace);
}

await convo.close();
await session.close();

console.log(
  done
    ? `\x1b[32m✓ the artist ended it after ${turn} turns\x1b[0m`
    : `\x1b[33m! stopped at the ${turn}-turn cap — the conversation had not finished\x1b[0m`,
);
console.log(`\n  transcript: ${rec?.path ?? "(not recorded)"}`);
console.log(`  read it with /recruit-debrief\n`);
