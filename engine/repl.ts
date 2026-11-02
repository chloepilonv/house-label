/**
 * The interactive conversation loop. Uses readline, not inquirer: replies stream
 * token by token, and two libraries cannot share one process.stdin (inquirer
 * lives only in init.ts and profile.ts). The staff picker is a numbered list.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { createInterface, type Interface } from "node:readline/promises";
import { loadDepartment, listStaff, type Department } from "./agent";
import { banner, bold, dim, gold, nowPlaying } from "./banner";
import type { Config } from "./config";
import type { Lang } from "./interview/core";
import { renderGreeting } from "./greeting";
import { startConversation, type Conversation } from "./session";
import { strings } from "./strings";
import { openTranscript } from "./transcript";
import { openSession, readBriefFor, type Session } from "./tools";

const HELP = `  ${bold("/staff")}   switch to someone else at the label
  ${bold("/who")}     who you're talking to and what they can see
  ${bold("/note")}    say what was wrong with that last answer — it goes in the transcript
  ${bold("/exit")}    leave (or ctrl-d)`;

/** The greeting, printed the way a reply is: the staff member's name over it. */
const hello = (d: Department, lang: Lang): string =>
  `${INDENT}${bold(gold(d.staffMember))}\n${INDENT}${renderGreeting(d, lang)}`;

/**
 * The staff list, numbered, read through the caller's readline. Returns null
 * for "never mind" or anything unparseable.
 */
async function pickStaff(current: string, rl: Interface): Promise<string | null> {
  const staff = await listStaff();
  console.log("");
  staff.forEach((d, i) => {
    const here = d.name === current ? dim("  (here now)") : "";
    const what = d.description.split("Triggers on")[0].trim().slice(0, 72);
    console.log(`  ${bold(String(i + 1).padStart(2))}  ${d.staffMember}${here}\n      ${dim(what)}`);
  });
  console.log(dim("\n  a number, or anything else to stay put\n"));

  const answer = (await rl.question(gold("› "))).trim();
  const n = Number(answer);
  if (!Number.isInteger(n) || n < 1 || n > staff.length) return null;
  return staff[n - 1]!.name;
}

/**
 * Steady-rate printer: buffers bursty tokens and releases them on a fixed tick,
 * faster when the backlog grows. Non-TTY sessions get raw writes.
 */
export function smoothWriter(out: NodeJS.WriteStream = process.stdout) {
  if (!out.isTTY) {
    return { write: (s: string) => void out.write(s), flush: async () => {} };
  }
  const TICK_MS = 16;
  let buf = "";
  let timer: ReturnType<typeof setInterval> | null = null;
  const drain = () => {
    // Let out a sliver per tick, scaled so a long backlog clears in ~15 ticks.
    const n = Math.max(2, Math.ceil(buf.length / 15));
    out.write(buf.slice(0, n));
    buf = buf.slice(n);
    if (!buf && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
  return {
    write(s: string) {
      buf += s;
      timer ??= setInterval(drain, TICK_MS);
    },
    /** Resolves once everything written has actually been printed. */
    async flush() {
      while (timer) await new Promise((r) => setTimeout(r, TICK_MS));
    },
  };
}

/** Everything the label says or the artist types sits in this gutter. */
const INDENT = "  ";

/**
 * Puts the speaker's name over every paragraph. A character scanner, because a
 * paragraph break can straddle two streamed chunks. Sits before smoothWriter.
 * Also drops every asterisk: the terminal shows markdown bold as literal stars.
 */
export function speakerWriter(name: string, write: (s: string) => void) {
  const label = `${INDENT}${bold(gold(name))}\n${INDENT}`;
  let first = true;
  let needLabel = true;
  let newlines = 0;
  return {
    write(chunk: string) {
      let out = "";
      for (const ch of chunk) {
        if (ch === "\n") {
          newlines++;
          continue;
        }
        // Before the label logic, so `**What's...` still opens on the W.
        if (ch === "*") continue;
        if (needLabel || newlines >= 2) {
          // Whitespace opening a paragraph would push the name off the gutter.
          if (ch === " " || ch === "\t") continue;
          if (!first) out += "\n\n";
          out += label;
          first = false;
          needLabel = false;
          newlines = 0;
        } else if (newlines > 0) {
          out += `\n${INDENT}`;
          newlines = 0;
        }
        out += ch;
      }
      if (out) write(out);
    },
  };
}

/**
 * The name over what the artist types. Read once, best-effort: a down database
 * must not block the conversation.
 */
async function artistName(session: Session, locale: "en" | "fr"): Promise<string> {
  const fallback = strings(locale).you!;
  try {
    const artist = await session.artist();
    const row = await artist.one<{ artist_name?: string }>("profile", { id: 1 });
    return row?.artist_name?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export async function repl(startDept: string, cfg: Config, opts: { log?: boolean } = {}): Promise<void> {
  const lang: Lang = cfg.locale === "fr" ? "fr" : "en";
  let dept: Department = await loadDepartment(startDept);
  // One set of database connections for the whole sitting, shared across departments.
  const session = openSession();
  const you = await artistName(session, lang);
  // Each department is told its colleagues so it can hand off.
  const colleagues = await listStaff();
  // Read here rather than by the model, to save a round trip before the first reply.
  let brief = await readBriefFor(dept.name, session);
  let convo: Conversation = startConversation(dept, cfg, { session, colleagues, brief });
  let tape = openTranscript(dept.name, !!opts.log);

  console.log(banner());
  console.log(nowPlaying(dept.staffMember, dept.department));
  console.log(dim("  type /staff to talk to someone else, /exit to leave\n"));
  if (tape) console.log(dim(`  recording this conversation to ${tape.path.replace(/^.*\/(?=\.transcripts)/, "")}\n`));
  // Every department greets the same way; session.ts reads the reply.
  console.log(`\n${hello(dept, lang)}\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.on("close", () => {});

  for (;;) {
    let line: string;
    try {
      line = (await rl.question(`\n${INDENT}${bold(gold(you))}\n${gold("› ")}`)).trim();
    } catch {
      break; // ctrl-d
    }
    if (!line) continue;

    if (line === "/exit" || line === "/quit") break;

    // `/note ...` pins the artist's words to the turn above.
    if (line.startsWith("/note")) {
      const text = line.slice(5).trim();
      if (!text) console.log(dim("\n  /note <what was wrong with that answer>\n"));
      else if (!tape) console.log(dim("\n  not recording — start with `houselabel --log` to keep notes\n"));
      else {
        tape.note(text);
        console.log(dim("\n  noted.\n"));
      }
      continue;
    }
    if (line === "/help" || line === "/?") {
      console.log(`\n${HELP}\n`);
      continue;
    }
    if (line === "/who") {
      console.log(
        `\n  ${bold(dept.staffMember)} — ${dept.department}\n` +
          dim(`  can read: ${[...dept.tables.artist.map((t) => `artist.${t}`), ...dept.tables.catalog.map((t) => `catalog.${t}`)].join(", ") || "nothing yet"}\n`) +
          dim(`  knows: ${dept.skills.map((s) => s.name).join(", ") || "no skills written yet"}\n`),
      );
      continue;
    }
    if (line === "/staff") {
      const picked = await pickStaff(dept.name, rl);
      if (!picked || picked === dept.name) continue;
      dept = await loadDepartment(picked);
      brief = await readBriefFor(dept.name, session);
      convo = startConversation(dept, cfg, { session, colleagues, brief });
      // One transcript file per department.
      tape = openTranscript(dept.name, !!opts.log);
      console.log(`\n${nowPlaying(dept.staffMember, dept.department)}`);
      console.log(`\n${hello(dept, lang)}\n`);
      continue;
    }
    if (line.startsWith("/")) {
      console.log(dim(`\n  no such command. ${line === "/staff" ? "" : "try /help"}\n`));
      continue;
    }

    const phase = convo.phase;

    process.stdout.write("\n");
    try {
      const writer = smoothWriter();
      const speaker = speakerWriter(dept.staffMember, (s) => writer.write(s));
      const turn = await convo.send(line, (s) => speaker.write(s));
      await writer.flush();
      process.stdout.write("\n");
      // Checklist state, `phase` and `task` per turn, which prose alone cannot show
      // (e.g. an empty `work` reply means the step budget went to tool calls).
      const p = convo.progress?.() ?? null;
      tape?.turn({
        said: line,
        replied: turn.text,
        filled: p?.answers,
        missing: p?.missing,
        phase,
        task: convo.task,
      });
    } catch (err) {
      const msg = (err as Error).message;
      // Errors are logged too, so the transcript can explain a failed turn.
      tape?.turn({ said: line, replied: `✗ ${msg}`, phase, task: convo.task });
      console.error(dim(`\n  ✗ ${msg}\n`));
    }
  }

  rl.close();
  await convo.close();
  if (tape) console.log(dim(`  transcript: ${tape.path}`));
  console.log(dim("\n  see you.\n"));
}
