/**
 * The conversation: the shared house voice wrapped around every department,
 * and the loop that runs it. The department supplies expertise; this file, manners.
 *
 * Author: Chloe Bibiane Pilon Vaillancourt
 */
import { stepCountIs, streamText, type ModelMessage } from "ai";
import type { Department } from "./agent";
import type { Config } from "./config";
import { offers, route } from "./greeting";
import { tierFor, type Tier } from "./models";
import { askable, emptyState, step, withOffers, type Flow as InterviewFlow, type Question, type State } from "./interview/core";
import { interpret } from "./interview/interpret";
import { extract } from "./interview/extract";
import { offersFor } from "./interview/offers";
import { persist, type Saved } from "./interview/persist";
import { loadFlow } from "./interview/load";
import { SERVED } from "./modes";
import { FLOWS, isComplete, renderFlow, stripToken, type Flow } from "./questions";
import { cacheOptions, explainProviderError, resolveModel } from "./providers";
import { buildTools, latestCampaignId, openSession, reconcileIfNeeded, renderIdeas, renderPlan, type Session } from "./tools";

/**
 * Rules for every staff member, in order of importance. Written as
 * prohibitions with reasons, since a model can check itself against a rule.
 */
const HOUSE_VOICE = `You work at this artist's label. You are talking to the artist directly.

HOW YOU TALK
- Plain language. Never use industry jargon without explaining it in the same breath — not "DSP", "mech royalties", "one-stop"; say what the thing is.
- One question per message. Never a numbered list of questions. An artist answers one thing well and five things badly.
- Plain language applies to what you WRITE DOWN as much as what you say: a task title, a step in a checklist and a heading are read on their own, weeks later, with none of the conversation around them. "Canvas for Fausse alerte" was a real task in a real plan and the artist's reply was "what is that?". Name the platform and say what the thing is.
- One reply, said once. You may speak, use a tool, then speak again — that is one message to the artist, not two. Do not re-introduce yourself, do not restate what you already said, and above all do not ask the same question twice in one reply.
- A DELIVERABLE IS THE EXCEPTION to short messages. A dated plan, a task list, a shortlist, a checklist — print it in full, every line. The rule about length is about how you TALK; it is not permission to summarise the thing they asked you to make. A department that wrote twenty dated tasks and then described them in a paragraph was obeying it, and the artist's reaction was "it didn't output any plan".
- Short messages. No markdown of any kind — no headings, no bullet-point walls, and never **stars** around a word. They are read in a terminal, which has no markdown and prints the stars as stars. Write the way a person types in a chat.
- Never open with a compliment about the question. Answer it.

WHAT YOU DO NOT DO
- Never refuse an answer. You are not the validator — the engine is, and it tells you when something genuinely cannot be used. If you were not told that, the answer was accepted: take it and move on. Telling an artist "that answer doesn't work" when it did is the fastest way to make them stop talking to you.
- Never treat a number in a question as a cap. "Which two matter most" invites two; three is an answer, not an error. Take what they gave you.
- Do not invent facts about the artist. If you need something, ask for it or read it.
- Do not invent facts about the industry. Open a knowledge page and say what it says. This binds hardest when you are about to say something is impossible or unaffordable — "there is no budget for ads", "that platform has a minimum", "you cannot pitch this late". A limit stated from memory that turns out to be wrong does not just misinform; it removes an option the artist actually had.
- Never ask for access to something you have no tool for. A folder link, a login, an export, a file upload, a screenshot — if nothing in your tool list can open it, asking wastes the artist's afternoon and ends the conversation on a task you cannot finish. One department spent five turns getting a Google Drive link so it could "audit the assets", having no way to read a Drive. Ask the artist to TELL you what they have; that is a sentence, and it is enough to plan with.
- Never narrate your own machinery. "Let me check what's on file", "I'll pull that up", "checking the project side" — the artist did not ask what you are doing, and reading it is like watching someone open a filing cabinet. Look things up silently and say what you FOUND. "Nothing scoped yet on the project side" is worse still — scoped, on file and project are our words for our tables, not theirs.
- Never promise a change you cannot make. You cannot add a question to your own interview, change what you get asked next time, or fix your own code. Saying "I'll note it so it gets asked going forward" is a promise that nothing keeps. Say instead that it is a good point, that you cannot change it yourself, and that they should tell whoever builds you.
- Do not claim you sent, submitted, or booked anything. You prepare things; the artist sends them.
- When a dataset is partial, say what you found — never "these are all of them".

WHAT YOU ALWAYS DO
- Read the artist's file before asking anything. Asking for something already on file is the fastest way to lose their trust.
- Save what they tell you the moment they tell you, using your tools. Saying "got it" without writing it down means asking again next month.`;

/**
 * The department's AGENT.md minus the `## Skills` table and `## Knowledge`
 * index, which the engine rebuilds from the files. Keeps the prompt within
 * free-tier request limits. `### Related data` is kept: it says which tables may be written.
 */
/**
 * Who else works here, one line each, so a department can hand off by name.
 */
function colleagueBlock(dept: Department, all: Department[]): string {
  const others = all.filter((d) => d.name !== dept.name);
  if (!others.length) return "";
  const lines = others
    .map((d) => `- **${d.staffMember}** (${d.name}) — ${d.description.split("Triggers on")[0].replace(/^\s*Use when\s*/i, "").trim().replace(/\s+/g, " ").slice(0, 150)}`)
    .join("\n");
  return `\n\n# The rest of the label\n\nYou are not the only one here. When what the artist needs next belongs to one of these, say so by name and stop — do not attempt their job.\n\n${lines}\n\nThe artist reaches them by typing /staff, or by asking you who handles it.`;
}

/**
 * The artist's brief, inlined in the prompt so the first turn needs no tool
 * round trip. The `artist_brief` tool remains for re-reads after a write.
 */
function briefBlock(brief?: string): string {
  if (!brief?.trim()) return "";
  return (
    `\n\n# The artist's file\n\nThis is what the label already knows. It is CURRENT as of the start of this conversation — ` +
    `do not call artist_brief to fetch it again, and never ask them for anything that is answered here.\n\n${brief.trim()}`
  );
}

/**
 * Today's date. Computed once per prompt build, not per request, so the
 * prompt cache stays valid.
 */
function todayBlock(locale?: string): string {
  const now = new Date();
  const day = now.toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { weekday: "long" });
  return `\n\n# Today\n\nToday is ${day}, ${now.toISOString().slice(0, 10)}. Every date you say is relative to that.`;
}

const ENGINE_SUPPLIES = ["## Skills", "## Knowledge"];

/**
 * Strips shell command blocks from skill `## Data` sections. The engine's
 * model has tools, not a shell. The surrounding prose stays.
 */
function withoutShellBlocks(body: string): string {
  return body
    .replace(/```(?:bash|sh|shell)\n[\s\S]*?```/g, "_(the tools do this; there is no shell here)_")
    .replace(/\n{3,}/g, "\n\n");
}

function departmentBody(body: string): string {
  const out: string[] = [];
  let skipping = false;
  for (const line of body.split("\n")) {
    if (/^## /.test(line)) skipping = ENGINE_SUPPLIES.includes(line.trim());
    if (skipping && line.trim().startsWith("### Related data")) skipping = false;
    if (!skipping) out.push(line);
  }
  return withoutShellBlocks(out.join("\n")).trim();
}

export function buildSystemPrompt(
  dept: Department,
  opts: {
    locale?: string;
    variant?: string;
    task?: string;
    /** The rest of the staff, so a reply can hand off by name. */
    colleagues?: Department[];
    /** The artist's file, already rendered. Preloaded, never fetched. */
    brief?: string;
  } = {},
): string {
  // A served department's interview runs in `engine/interview/`; giving the
  // model the question list too would make two competing interviews.
  const flow: Flow | null = SERVED.includes(dept.name) ? null : (FLOWS[dept.name] ?? null);

  // Only the picked skill is inlined in full (it is the procedure); the others
  // are listed by name. This keeps the prompt small and time to first token low.
  // With nothing picked, no skill is inlined.
  const inline = dept.skills.filter((s) => s.name === opts.task);
  const listed = dept.skills.filter((s) => s.name !== opts.task);
  const skills = dept.skills.length
    ? `\n\n# What you know how to do\n\n${[
        ...inline.map((s) => `## ${s.name}\n${s.description}\n\n${withoutShellBlocks(s.body)}`),
        listed.length
          ? `## Also yours, if it turns out to be what they need\n\n${listed
              .map((s) => `- **${s.name}** — ${s.description.replace(/\s+/g, " ").trim()}`)
              .join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n---\n\n")}`
    : "";

  // Titles only; the model opens a page with read_knowledge.
  const knowledge = dept.knowledge.length
    ? `\n\n# Your reference shelf\n\nOpen these with read_knowledge when a claim depends on one. Do not answer an industry question from memory when a page covers it.\n\n${dept.knowledge
        .map((k) => `- \`${k.file}\` — ${k.title}`)
        .join("\n")}`
    : "";

  const interview = flow ? `\n\n# ${renderFlow(flow, { variant: opts.variant })}` : "";

  // What they asked for, so the staff member does not ask again.
  const picked = opts.task
    ? `\n\n# What they asked for\n\nThey asked, in their own words, for \`${opts.task}\`. Start it. Do not ask them what they want — they have told you.`
    : "";

  // Nothing picked: the department answers directly. There is deliberately no
  // `discuss` skill.
  const jobs = offers(dept).map((o) => o.line);
  const asked = opts.task
    ? ""
    : `\n\n# When they ask a question\n\nAnswer it yourself, from your reference shelf and the artist's file. Open the page, say what it says, and name the page or the URL behind each claim — a claim with nothing behind it is said as an opinion, in those words, or not said. Never write anything while answering a question: no row, no memory, no draft.${
        jobs.length
          ? ` When the question turns out to be a job you can run — ${jobs.join("; ")} — offer it once, at the end, in those words. Do not start it yourself: if they say yes, it starts.`
          : ""
      }`;

  const language =
    opts.locale === "fr"
      ? "\n\nLANGUE : réponds uniquement en français. Ne mélange jamais les deux langues."
      : "\n\nLANGUAGE: answer in the artist's language. If they write in French, answer only in French.";

  return `${HOUSE_VOICE}

# Who you are

You are ${dept.staffMember}, the ${dept.department} department.

${departmentBody(dept.body)}${skills}${knowledge}${briefBlock(opts.brief)}${colleagueBlock(dept, opts.colleagues ?? [])}${todayBlock(opts.locale)}${interview}${picked}${asked}${language}`;
}

/**
 * The text of a stream, while watching tool calls. Reads `fullStream` because
 * `textStream` drops tool events, and inserts a paragraph break where text
 * resumes after a tool call so segments do not run together.
 */
async function* textWatched(
  result: { fullStream: AsyncIterable<{ type: string; toolName?: string }> },
  onPlanWrite: () => void,
): AsyncGenerator<string> {
  let said = false;
  let broke = false;
  for await (const part of result.fullStream) {
    if (part.type === "tool-call") {
      if (said) broke = true;
      const n = part.toolName ?? "";
      if (["artist_set", "reconcile_budget", "show_plan", "show_ideas", "pick_ideas"].includes(n)) onPlanWrite();
    }
    if (part.type === "text-delta") {
      const t = (part as unknown as { text?: string; textDelta?: string }).text
        ?? (part as unknown as { textDelta?: string }).textDelta ?? "";
      if (!t) continue;
      if (broke) {
        if (!/^\s/.test(t)) yield "\n\n";
        broke = false;
      }
      said = true;
      yield t;
    }
  }
}

export interface Turn {
  text: string;
  /** The interview flow signalled it has everything it needs. */
  complete: boolean;
  /** Which tier answered, so a caller can show or log it. */
  tier: Tier;
}

export interface Conversation {
  dept: Department;
  messages: ModelMessage[];
  /**
   * A served department starts in `greeting`; the first sentence routes to
   * `interview` (a task) or `chat`. In `chat`, a sentence asking for a task
   * starts it. A department not yet overhauled skips `greeting`.
   */
  phase: "greeting" | "interview" | "work" | "chat";
  /** The task the artist asked for, while one is running. */
  task?: string;
  /**
   * Leave the greeting. Async because a task loads its question set from
   * `agents/<dept>/skills/<task>/scripts/questions.ts`.
   */
  begin(choice: { task: string } | { chat: true }): Promise<void>;
  send(input: string, onChunk: (s: string) => void): Promise<Turn>;
  /**
   * What the checklist holds so far and what is still needed, so the artist
   * can review and correct it. Null when no interview is running.
   */
  progress(): { answers: Record<string, unknown>; missing: string[]; total: number } | null;
  close(): Promise<void>;
}

export function startConversation(
  dept: Department,
  cfg: Config,
  opts: { variant?: string; session?: Session; colleagues?: Department[]; brief?: string } = {},
): Conversation {
  /**
   * What the staff member said last turn. The extractor needs it to read short
   * replies like "5k" against the question they answer.
   */
  let lastAsked = "";

  const session = opts.session ?? openSession();
  const tools = buildTools(dept, session, cfg);
  const served = SERVED.includes(dept.name);
  let system = buildSystemPrompt(dept, {
    locale: cfg.locale,
    variant: opts.variant,
    colleagues: opts.colleagues,
    brief: opts.brief,
  });
  const flow = served ? null : (FLOWS[dept.name] ?? null);
  const messages: ModelMessage[] = [];
  /** What the department asks for once the interview is over. */
  const workTier = tierFor(dept.front);

  /**
   * The interview the engine is walking for a served department. The model
   * never sees the set; it is handed one question per turn to phrase.
   */
  let run: { flow: InterviewFlow; state: State; pending: Question | null } | null = null;

  const convo: Conversation = {
    dept,
    messages,
    phase: served ? "greeting" : flow ? "interview" : "work",
    async begin(choice) {
      if (!("task" in choice)) {
        convo.phase = "chat";
        return;
      }
      convo.task = choice.task;
      system = buildSystemPrompt(dept, {
        locale: cfg.locale,
        variant: opts.variant,
        task: choice.task,
        colleagues: opts.colleagues,
        brief: opts.brief,
      });
      const loaded = await loadFlow(dept.name, choice.task);
      if (loaded) {
        let state = emptyState(cfg.locale === "fr" ? "fr" : "en");
        // Prefill questions that carry `from:` with what the artist's data
        // already says. A failure here degrades to a plain interview.
        const offered = await offersFor(loaded, await session.artist()).catch(() => ({}));
        if (Object.keys(offered).length) {
          state = withOffers(state, offered);

          // An offer that validates is adopted, not just suggested, so the
          // artist is not re-asked what their file already says. It still
          // appears in the closing summary for correction. `interpret` maps
          // column values onto option ids (e.g. "CA" to "canada").
          const model = resolveModel(cfg, "fast");
          for (const [id, offer] of Object.entries(offered)) {
            const q = loaded.questions.find((x) => x.id === id);
            if (!q) continue;
            const raw = Array.isArray(offer.value) ? offer.value.join(", ") : String(offer.value);
            const mapped = q.options?.length
              ? await interpret(model, q, raw, state.lang).catch(() => null)
              : raw;
            if (!mapped) continue;
            const r = step(loaded, state, { id, raw: mapped });
            if (!r.error) state = r.state;
          }
        }
        const first = step(loaded, state);
        run = { flow: loaded, state: first.state, pending: first.question };
      }
      // A task with no question set is not an error: the department is
      // mid-overhaul, and the model runs the skill.
      convo.phase = run ? "interview" : "work";
    },
    async send(input, onChunk) {
      // At the greeting and on every chat turn, a small model reads the
      // sentence once to decide task vs conversation. Done here, not in the
      // REPL, so the terminal and the persona harness agree.
      if (convo.phase === "greeting" || convo.phase === "chat") {
        const choice = await route(dept, input, { model: resolveModel(cfg, "fast"), lastSaid: lastAsked });
        if ("task" in choice) await convo.begin(choice);
        else convo.phase = "chat";
      }
      messages.push({ role: "user", content: input });

      // Tier is chosen per phase, never per turn, to keep the prompt cache
      // alive. Conversation (interview, chat) uses `standard`: it needs
      // judgment, and the fast tier failed at it.
      const tier: Tier = convo.phase === "interview" || convo.phase === "chat" ? "standard" : workTier;

      // The engine advances the interview before calling the model; the model
      // only phrases the acknowledgement and the chosen question.
      let turn = "";
      if (run && convo.phase === "interview") {
        // Checklist, not script: the reply is read against every open slot at
        // once. One sentence can fill several; a question fills none.
        const before = Object.keys(run.state.answers).length;

        // Two reads with different jobs. `interpret` is generous and maps the
        // reply onto options-type questions; `extract` is strict and fills the
        // other slots, where a wrong fill would never be re-asked.
        // We cannot know which question the model actually asked, so
        // `interpret` runs on every open question in parallel. It returns null
        // when unanswered; the first in flow order that validates wins, so the
        // result does not depend on call order.
        const open = askable(run.flow, run.state.answers).filter(
          (q) => run!.state.answers[q.id] === undefined,
        );
        const model = resolveModel(cfg, "fast");
        const guesses = await Promise.all(
          // Options questions only. Free-text slots are left to `extract`,
          // which must quote the words that justify a fill.
          open.map((q) =>
            q.options?.length
              ? interpret(model, q, input, run!.state.lang).catch(() => null)
              : Promise.resolve(null),
          ),
        );
        for (const [i, guess] of guesses.entries()) {
          if (!guess) continue;
          const r = step(run.flow, run.state, { id: open[i]!.id, raw: guess });
          if (!r.error) { run.state = r.state; break; }
        }

        const got = await extract(
          resolveModel(cfg, "fast"),
          run.flow,
          run.state.answers,
          input,
          run.state.lang,
          lastAsked,
        ).catch(() => ({ filled: {}, rejected: [] }));

        // Through `step`, one at a time, so `validate`, `langFrom` and the
        // branch logic run exactly as they do in the terminal.
        for (const [id, value] of Object.entries(got.filled)) {
          const raw = Array.isArray(value) ? value.join(", ") : String(value);
          const r = step(run.flow, run.state, { id, raw });
          if (!r.error) run.state = r.state;
        }

        const now = step(run.flow, run.state);
        run.pending = now.question;
        const learned = Object.keys(run.state.answers).length - before;

        // Save as answers arrive, since most interviews are abandoned. A save
        // failure must not end the turn.
        let saved: Saved[] = [];
        if (learned) {
          saved = await persist(run.flow, run.state.answers, await session.artist()).catch(() => []);
        }

        if (!now.question) {
          convo.phase = "work";
          turn = `\n\n# This turn\n\nYou have everything you need. Here it is:\n\n${JSON.stringify(run.state.answers, null, 2)}\n\nSay back in one short paragraph what you understood, then do the work.`;
        } else {
          // What is left, in the artist's words rather than as slot ids.
          const open = now.missing.length
            ? now.missing
            : askable(run.flow, run.state.answers).filter((q) => run!.state.answers[q.id] === undefined).map((q) => q.id);
          const topics = open
            .map((id) => run!.flow.questions.find((q) => q.id === id))
            .filter(Boolean)
            .map((q) => `${q!.id} — ${q!.ask[run!.state.lang]}`);

          // Show the model one item, never the list, so what it asks and what
          // the engine thinks it asked stay the same.
          const next = topics[0] ?? "";
          const left = Math.max(0, topics.length - 1);
          turn =
            `\n\n# This turn\n\n` +
            `DO NOT WRITE ANYTHING YOURSELF THIS TURN. While an interview is running the program owns the writing — it saves each answer as it arrives, keyed so a second run updates the same row. Calling a save tool as well produces TWO rows for one release, which is exactly the duplicate the artist asked about. Read freely; write nothing.\n\n` +
            (saved.length
              ? `SAVED, and you must say so in one clause — where it went and how they get it back: ${saved
                  .map((x) => `${x.table} (${x.columns.join(", ")}) — read it with \`${x.howToRead}\``)
                  .join("; ")}\nThey asked for this explicitly: a save nobody can find is the same as no save.\n\n`
              : "") +
            (learned
              ? `You just learned ${learned} thing(s) from that message. Do not thank them for each one and do not read the list back.\n\n`
              : `That message answered nothing you still need — which is fine. If they asked you something, answer it. If they changed the subject, follow them.\n\n`) +
            `THE ONE THING TO ASK ABOUT NOW:\n${next}\n\n` +
            `Ask about exactly that, in your own words, as one question in a conversation — not as a form field. Do not ask about anything else, do not stack a second question onto it, and do not list what is coming. ${left} other thing(s) remain and they are not yours to raise yet.\n\n` +
            `NEVER refuse an answer. NEVER say "that doesn't work", "I need to know", or "I can't tell". If a reply is unclear you may ask about it again later; you may not reject it. If they ask you something instead of answering, answer them — the list can wait.\n` +
            `If they want to skip something, skip it. ${now.missing.length ? `You cannot finish without: ${now.missing.join(", ")} — say so once, at the end, never as a refusal.` : `Everything left is optional; offer to stop whenever they like.`}`;

          const o = run.state.offered[now.question.id];
          if (o) {
            const v = Array.isArray(o.value) ? o.value.join(", ") : o.value;
            turn += `\n\nTheir file already says ${v} (${o.from}) for the first item. Put it to them to confirm rather than asking cold.`;
          }
        }
      }

      // Caught here so the SDK does not print the raw error object to the
      // artist's terminal; rethrown below as one line when the turn is empty.
      let failure: unknown;
      const result = streamText({
        onError: ({ error }) => { failure = error; },
        model: resolveModel(cfg, tier),
        ...(cacheOptions(cfg, convo.phase) ? { providerOptions: cacheOptions(cfg, convo.phase)! } : {}),
        system: system + turn,
        messages,
        tools,
        // Step cap: 12 for a conversation turn, 48 for work, which can write
        // 14-20 tasks (one tool call each) before replying.
        stopWhen: stepCountIs(convo.phase === "work" ? 48 : 12),
      });

      let text = "";
      // The sentinel must never reach the artist, and it arrives split across
      // chunks. Hold back a tail the length of the token.
      const hold = flow ? flow.token.length : 0;
      let pending = "";
      // Watched, not asked: whether the artifact reaches the screen must not
      // depend on the model choosing to put it there.
      let wrotePlan = false;
      for await (const chunk of textWatched(result, () => { wrotePlan = true; })) {
        text += chunk;
        pending += chunk;
        if (pending.length > hold) {
          const emit = pending.slice(0, pending.length - hold);
          pending = pending.slice(pending.length - hold);
          onChunk(emit);
        }
      }
      if (pending) onChunk(flow ? stripToken(pending, flow) : pending);

      // The written plan is printed by the engine, not left to the model to show.
      if (wrotePlan) {
        try {
          const artist = await session.artist();
          const id = await latestCampaignId(artist);
          if (id) {
            // Reconcile totals before printing, so no total shows as null.
            await reconcileIfNeeded(artist, id);
            for (const render of [renderIdeas, renderPlan]) {
              const out = await render(artist, id);
              if (!out) continue;
              const block = `\n\n${out}\n`;
              text += block;
              onChunk(block);
            }
          }
        } catch {
          // A plan that cannot be rendered must not end the turn that made it.
        }
      }

      // Never return an empty reply: if every step went to tool calls and
      // something failed, surface the error.
      if (!text.trim() && failure) throw new Error(explainProviderError(failure, cfg.locale));
      if (!text.trim()) {
        const said =
          cfg.locale === "fr"
            ? "J'ai fait le travail mais je me suis arrêté avant de te répondre. Redemande-moi — ou dis-moi « où on en est »."
            : "I did the work but stopped before answering you. Ask me again — or say \"where are we\" and I'll tell you what's saved.";
        text = said;
        onChunk(said);
      }

      messages.push(...(await result.response).messages);
      const complete = flow ? isComplete(text, flow) : false;
      // One way only: reopening the interview would change tier mid-plan.
      if (complete) convo.phase = "work";
      const shown = flow ? stripToken(text, flow) : text;
      // Remember what was asked, for the next turn's extraction.
      lastAsked = shown;
      return { text: shown, complete, tier };
    },
    progress() {
      if (!run) return null;
      const now = step(run.flow, run.state);
      return { answers: run.state.answers, missing: now.missing, total: now.progress.total };
    },
    close: () => session.close(),
  };

  return convo;
}
