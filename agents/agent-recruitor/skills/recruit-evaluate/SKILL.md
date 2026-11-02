---
name: recruit-evaluate
description: >
  Use when a department needs to be proven rather than assumed — runs its
  evals against an ablated baseline, grades every assertion, shows the real
  outputs for judgment, routes each failure to the file that caused it, and
  loops until the outputs are right. Also catches knowledge going stale.
  Triggers on "test this agent", "does the promotion agent actually work",
  "run the evals", "talk to it with the personas", "is our press knowledge
  still current?".
metadata:
  agent: recruit
  status: developed
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# recruit-evaluate

**Status:** developed — the spec is complete; no code behind it yet.

An agent never run against its own evals is a hypothesis. This is a **loop**,
not a report: one pass gives a score, and the score is not the point.

Two decays, two different fixes:

- **Correctness** — does the wrong thing. Fix `Guidelines`, `Process`, or
  `knowledge/`.
- **Freshness** — does the right thing with expired facts. Re-run
  [`recruit-research`](../recruit-research); rewording won't help.

## Input

| Field | From | Notes |
|---|---|---|
| target agent | conversation | which department |
| eval cases | `agents/<slug>/evals/evals.json` | prompts, expected output, assertions |
| case fixtures | the `given` key of each case | table → rows that must exist before the prompt runs; absent when the case needs no state |
| the agent itself | `agents/<slug>/` | `AGENT.md`, skills, knowledge |
| previous iteration | `evals/runs/iteration-<N-1>/` | regression comparison; absent on the first run |
| `last_verified` dates | `knowledge/*.md` frontmatter | drives the freshness half |
| the user-personas | [`evals/user-personas/`](../../../../evals/user-personas/) | simulated artists that hold a whole conversation with the department; **both**, every time |
| the artist's judgment | conversation | the acceptance test; nothing overrides it |

## Process

### 0. Talk to it first, before running a single eval case

```bash
bun run evals:converse <slug> --persona indie-persona --turns 20
bun run evals:converse <slug> --persona odile-ray   --turns 20
bun run evals:converse <slug> --persona portland-punk --turns 20
bun run evals:converse <slug> --persona ines-laval --turns 20
```

**All four, every time.** None substitutes for another. `indie-persona` has
never released anything and knows none of the words. `odile-ray` has three
records and will say "that's in my presskit". `portland-punk` is a US trio with
three writers per song and a pressing plant on the clock — a department that
assumes Canada or one writer fails there. `ines-laval` has a label, a
booking agency and $5,000 of her own, and a department that only knows how to
talk to a self-managed artist will propose work her label is already paid for.

**An eval case cannot see a bad conversation.** It fires one prompt and reads
one reply, which is structurally blind to everything that actually ships
broken. Every one of these was live in a department whose eval cases passed:

- a sixteen-turn interview that ran beautifully and wrote **nothing** to the
  database
- the first sentence recorded as the answer to question one
- the artist correcting a number, and the correction lost at save time
- a turn that returned no text at all, because the step budget went to tool
  calls
- twenty dated tasks **described in a paragraph** instead of listed
- a request for a Google Drive link the department had no way to open

None of those is a wrong answer to a question. They are a bad conversation, and
you cannot see one without having it.

Then read what came back with [`recruit-debrief`](../recruit-debrief) and fix
what it found. **A conversation that ends with nothing written is a failure
even if every reply was good.** Loop until both run clean; only then is a score
from the case grid worth anything.

Needs `EVAL_DATABASE_URL`, and refuses to run if it equals `DATABASE_URL` — the
department writes rows. Each persona ships a `.fixture.sql` seeded before every
run, so the artist in the database is the artist in the conversation.

### 0b. No API credit? Hold the conversation through subagents

`evals:converse` needs a provider with credit. When none has any, the
departments still run **on the Claude Code subscription**: every department is a
subagent in `.claude/agents/`, and a second subagent can play the persona. This
is how the twelve conversations of 2026-09-05 were held, and it found six bugs
`evals:converse` on Ollama did not. It tests the skills and knowledge at Claude
quality; it does **not** exercise the engine's greeting and interview core — use
`evals:converse` for that once a key has credit.

1. **Point the writes at a scratch database, never the artist's.** The
   `SubagentStart` hook and every `artist:*` write follow `DATABASE_URL` in
   `.env.local`. Back it up, then:
   ```bash
   cp .env.local /tmp/env.local.backup
   docker compose exec -T db psql -U postgres -c "drop database if exists music_label_subagent" -c "create database music_label_subagent"
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/music_label_subagent bun run artist:migrate
   docker compose exec -T db psql -U postgres -d music_label_subagent -f - < evals/user-personas/<persona>.fixture.sql
   sed -i '' 's#^DATABASE_URL=.*#DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/music_label_subagent#' .env.local
   ```
2. **Spawn the persona** as a `general-purpose` subagent (Sonnet is enough):
   the persona `.md` verbatim as its instructions, then "You are about to talk
   to the label's <staff member> (<what it does>). Write your opening message.
   Reply with only the words you would say." The persona file must carry every
   fact the department will ask — a song's language, the distributor, the
   budget — or two departments hear two different artists.
3. **Spawn the department** subagent (`subagent_type: <slug>`) with "The artist
   says:" and the opener. Relay its reply to the persona agent with
   `SendMessage`, the persona's answer back to the department, and so on. Eight
   turns is a conversation; stop when the persona writes `[DONE]` or the
   department has delivered (a plan, a shortlist, a saved registration).
4. **Read the rows, not only the words.** After each department: `psql` the
   scratch database for what it claims to have saved. A department that says
   "recorded" and wrote nothing is the finding.
5. **Log every leak as you go** — table names, commands, file paths, ids in the
   artist-facing text — against the bullet every `AGENT.md` carries. Save the
   exchange to `.transcripts/<slug>-<persona>-subagent-<date>.md`.
6. **Restore `.env.local`** — `cp /tmp/env.local.backup .env.local` — before
   anything else runs. Between personas, reload the fixture (it wipes every
   artist table except `connections`).

Limits: the subscription's session cap lands after roughly twenty-five
subagent turns and resets on Anthropic's clock — resume the same agent ids with
`SendMessage`, nothing is lost. Two sessions must never share one eval or
scratch database; each run reseeds it and kills the other's conversation.

### 1. Load the case's `given` into `artist.*`

`given` is a map of table → the rows that must exist before the prompt runs. A
case with one and no load is worse than an untested case: assertions about state
the agent should reuse pass against an empty database, and report green.

- **Load into a scratch database, never the artist's.** `given` rows are
  fixtures; they are not the artist's data and must not outlive the case.
- **Truncate between cases.** Case 3's registrations leaking into case 4 is a
  pass nobody can reproduce.
- **A `given` that fails to load ends the case.** Report it as blocked; never
  grade against the state you meant to have.
- **No `given` means the case needs no state** — not that state was forgotten.
  Both arms get the same fixture.

`bun run evals:run <slug>` does all four, then runs both arms and writes the
iteration folder: [`scripts/run-evals.ts`](./scripts/run-evals.ts). It grades
nothing — verdicts land `null` and steps 3–6 fill them.

### 2. Run each case twice — with the department, and ablated

**The baseline is an ablation, not an empty room.** "No agent at all" is
unobtainable — `agents:sync` has published everything into `.claude/`. Run it
outside the repo and it loses `data/catalog/`, flattering the department for
having a database.

Hold the environment, remove only the department:

| | With | Ablated |
|---|---|---|
| `AGENT.md`, its `SKILL.md`s, its `knowledge/` | loaded | **withheld** |
| its `.claude/` symlinks and subagent | present | **withheld** |
| `data/catalog/` + `artist.*` | yes | yes |
| `evals.json` — the answer key | **hidden** | **hidden** |
| Tools, model, repo, `CLAUDE.md` | same | same |

The honest question: does this department's *writing* beat a capable model with
the same data? When improving an existing department, the ablated arm is the
version you started from — a snapshot, not a blank.

Four things the runner has to do for that question to mean anything, each
learned by watching it fail:

- **Grant `Skill`, which no department's frontmatter lists.** `tools:` says what
  a department may DO; reaching its own skills is how it is assembled at all,
  and Claude Code grants that in production without being asked. Without it the
  child could only `Read` a `SKILL.md` it happened to open, so every eval graded
  an improvisation of the skill rather than the skill. `manager-scope-project`
  prints its questions from `scripts/questions.ts`; the child invented its own
  order and the case scored it. The tool goes to BOTH arms — ablation parks the
  department's `skills/`, which breaks the symlinks pointing into it, so the arm
  loses the skills and not the tool.
- **Withhold the source, not just the symlinks.** Both arms run at the repo root
  with `Read, Grep, Glob, Bash`. A department folder left in place is a folder
  the ablated arm greps, and it did — quoting a knowledge file's URLs and
  figures back verbatim. The baseline was "loaded" versus "read it anyway".
- **Point the agent at the scratch database.** `given` rows load into
  `EVAL_DATABASE_URL`; the agent opens `DATABASE_URL`. Until the runner passed
  the scratch URL as `DATABASE_URL`, every fixture loaded into a database
  nothing read, and cases correctly reported they had no data.
- **Hide the cases from both arms.** An agent that finds `evals.json` answers the
  test rather than the artist — one run offered to write its own `with-agent.md`
  and launch its own ablated arm. Parking the file is not enough; a parked copy
  is a copy that can be found.

**This is not a sandbox.** Everything above raises the cost of contamination on
a filesystem the agent can read. An agent that goes looking will still find
things; read the transcript, not only the output, when a baseline looks too
good.

### 3. Grade every assertion, with evidence

Pass/fail plus the span of output that justifies it. Anything mechanically
checkable — a section is present, a placeholder is uppercase-bracketed, a CSV
has CRLF endings — gets a script; it doesn't drift between runs and it's
reusable next iteration.

### 4. Flag the assertions that don't discriminate

An assertion passing in **both** arms isn't testing this agent. Say so rather
than counting it. Rewrite it against department-specific behaviour, or drop it.

### 5. Show the real outputs

The actual pitch, shortlist, or worksheet — not a summary, not the grade alone.
Assertions catch what we knew to check; the human catches what nobody asserted.

### 6. Route each failure to the file that caused it

| Symptom | The bug is in | Note |
|---|---|---|
| Did something it was told never to do | Guidelines — the **`SKILL.md`** if one skill does it, `AGENT.md` if all would | a one-skill rule in `AGENT.md` makes six others carry it |
| Two runs of the same case disagree | `SKILL.md` → Process | ambiguous step, or a script waiting to be written |
| Stated something that **was never true** | `knowledge/*.md` | if it *was* true and expired, that's step 7, not this |
| Answered a question that isn't its job | `AGENT.md` → description | over-triggering |
| Missed a question that is its job | the **`SKILL.md`** description | Claude matches on the skill's description, not the department's |
| Couldn't answer for lack of a **tool** | `AGENT.md` → `tools:` | capability gap. Never "fix" it by writing knowledge |
| The **wrong skill** fired | both descriptions | overlapping triggers; separate them |
| Data it needed wasn't there | `data/` — **exits this loop** | report it and stop the case |
| The **case itself** is wrong | `evals/evals.json` | fixing the test is legitimate — say so out loud |

A failure filed against the wrong file gets papered over with a new rule, and
the real bug survives to the next iteration.

### 7. Notice the repeated work

Read the transcripts, not just the outputs. Several runs writing the same helper
— recomputing a score, reformatting a CSV — is the signal to bundle a script
into `scripts/` and point `SKILL.md` at it.

### 8. Check freshness separately

Any `knowledge/` file whose `last_verified` is older than the clock its claims
run on — statutory rates yearly, program deadlines per intake, platform figures
continuously, structure rarely ([`agents/README.md` → What counts as a
source](../../../README.md#what-counts-as-a-source)) — is a re-research task,
and so is any sentence that says "nobody publishes it" where a publisher now
does. An agent can pass every eval and still describe a program that closed.
Report these as their own list, oldest first.

### 9. Apply, re-run, compare

Re-run the whole suite into a new iteration and diff. Regressions matter more
than the headline: a change that fixes case 2 and breaks case 4 is a worse agent
with a better score.

Loop until the user says the outputs are right, feedback comes back empty, or
two iterations produce no movement. Past that, the edits fit the eval prompts
rather than the job.

## Output

Everything lands in the department's own `evals/runs/`, next to the cases that
produced it:

```
agents/<slug>/evals/
├── evals.json                   # the cases (committed)
└── runs/iteration-<N>/
    ├── case-<id>/
    │   ├── with-agent.md        # the real output
    │   ├── ablated.md           # same prompt, department withheld
    │   └── grading.json         # assertion → {passed, evidence}
    └── summary.json             # both arms' pass rates, regressions vs N-1
```

`runs/` is gitignored. Never write results elsewhere — a workspace outside
`evals/` is one nobody finds next time.

In conversation:

- **Per iteration** — the assertion × case grid with both arms, the real
  outputs, non-discriminating assertions, failures routed to files, any script
  the repeated-work pass found, the freshness list.
- **Across iterations** — the diff, regressions first.
- **At the end** — what is proven, what is still assumed, what was deliberately
  left failing.

## Guidelines

- **Never report a pass rate without its baseline.** A number with nothing to
  compare against is green that hides a broken agent.
- **Never fix a failure by adding a MUST.** Escalating emphasis is what you do
  instead of finding the cause.
- **Never overfit.** Five cases stand in for every artist who will ask; a change
  that only helps case 3 made the agent worse.
- **Never let assertions replace the human.** Their judgment overrides a green
  grid.
- **Never conflate stale with wrong.** An expired deadline is research, not
  rewording.
- **Keep every iteration** — a regression is invisible without the previous run.
- **Hand skill-craft to `skill-creator`.** This skill owns whether the
  *department* does its job.
