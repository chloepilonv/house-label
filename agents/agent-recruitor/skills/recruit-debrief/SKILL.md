---
name: recruit-debrief
description: >
  Use after the artist has talked to a department and something felt wrong —
  reads the latest `.transcripts/` session for that department, finds the turn
  it went wrong on, names the file that caused it, and fixes it. Triggers on
  "read the transcript", "debrief digital-marketing", "that conversation was bad",
  "check the last session".
metadata:
  agent: recruit
  status: developed
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# recruit-debrief

**Status:** developed — the spec is complete; no code behind it yet.

The artist talks to a department, something is wrong, and they say so in the
words anyone would use: *it's rigid*, *it's dumb*, *nothing happened*. None of
those name a file. This reads what actually happened instead.

**A transcript beats a report, and it is not close.** "Nothing happened" was one
turn with `phase: work`, an empty `replied`, and no error recorded —
which is not a crash, it is a model that spent its whole step budget on tool
calls and had nothing left to speak with. The artist could not have said that.
The file said it in three fields.

## Input

| Field | From | Notes |
|---|---|---|
| the department | the artist, or the newest file if they name none | one department per run |
| the session | `.transcripts/<dept>-<timestamp>.jsonl` | newest unless they point at one |
| what felt wrong | the artist, in their own words | a symptom, never a diagnosis |
| their notes | `event: "note"` lines in the same file | written mid-conversation, pinned to the turn above |

```bash
ls -t .transcripts/*.jsonl | head -5
```

**Recording is opt-in.** A real sitting is only written when the artist ran
`houselabel --log`; if there is no file, say the session was not recorded rather
than asking them to retype it. `evals:converse` always records — a simulated
artist has no privacy to protect.

Each line is one turn: `said` (the artist), `replied` (the department), plus
`phase`, `task`, and — when the engine was walking a checklist — `filled` and
`missing`, which are what the engine BELIEVED after that reply. A line with
`event: "note"` is the artist's own comment on the turn above it.

`filled` and `missing` are the half prose cannot show: "it asked me that twice"
is almost always a slot that never filled, and the words alone will not say so.

## Process

1. **Read the newest session for that department, every turn.** Not a sample.
   The turn that broke is often three before the one they complained about.
2. **Find the first turn that went wrong**, and say which number it is. The
   artist reports the last bad turn; the cause is usually earlier.
3. **Read the fields, not just the words.** `phase` says what the engine thought
   it was doing. `missing` says which slots were still open. An empty `replied`
   with no `✗` is not a crash. A reply that asks for something
   already in the brief is a prompt problem, not a model problem.
4. **Name the file.** Every finding routes to one:
   - asked for something already known → `scripts/offers.ts`, or the brief
   - rejected a reasonable answer → `scripts/questions.ts` (`options`, `type`)
   - marched through questions, would not adapt → [`extract.ts`](../../../../engine/interview/extract.ts)
     and [`interpret.ts`](../../../../engine/interview/interpret.ts) — the reply
     is read against every open slot, not just the question in front of it
   - answered but nothing saved → [`persist.ts`](../../../../engine/interview/persist.ts)
   - ended flat, no handoff → `HOUSE_VOICE` in
     [`engine/session.ts`](../../../../engine/session.ts)
   - empty reply, wrong model, slow first token → `engine/session.ts` (step
     budget, tier, what the prompt carries)
   - wrong industry fact → the department's `knowledge/`, with its source
5. **Fix it, then say what would prove it.** Run `bun run test` and
   `bun run agents:check`. Name the exact command the artist runs to see the
   fix, and what they should see.
6. **Turn the worst finding into an eval case.** One entry in the department's
   `evals/evals.json` — the artist's own words as `prompt`, what should have
   happened as `expected_output`, and assertions that would have caught it.
   A complaint fixed once is a complaint that comes back; a complaint with an
   eval behind it is a regression test.

## Output

Four things, in this order, and nothing else:

1. **The turn it broke on** — number, phase, and what the fields say.
2. **The cause** — one sentence, naming the file.
3. **The fix** — what changed, and the test result.
4. **What to run** — one command, and what they should see.

Never a transcript replay. The artist was there.

## Guidelines

- **Never ask them to paste anything.** The file exists so they do not have to.
  If it is missing, the artist did not run `houselabel --log` — say that, and
  ask them to re-run with it. Never ask for scrollback.
- **Never diagnose from the complaint alone.** "It's dumb" was the model tier;
  "it's rigid" was the interview being engine-driven; "nothing happened" was a
  step budget. Three different files, one vocabulary.
- **Never fix more than the transcript shows.** A conversation is evidence for
  what it contains. Anything else is a separate branch.
- **A finding with no file is not a finding yet.** Keep reading.
- **Say what still hurts.** A session usually has more than one defect, and the
  one the artist did not mention is often the worse one.
