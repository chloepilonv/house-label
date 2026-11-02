---
name: recruit-overhaul
description: >
  Use when an existing department is brought up to standard — one department,
  one branch. Validates its skills, knowledge and data, wires its two modes
  (its tasks and its greeting), and climbs it from ✅ developed to 🚀 production. Triggers
  on "overhaul digital-marketing", "go through the press agent", "bring promotion up to
  standard", "which department is next".
metadata:
  agent: recruit
  status: beta
  author: Chloe Bibiane Pilon Vaillancourt
  version: "2.0"
---

# recruit-overhaul

One department. One branch: `feat-modes-<department>`. Ten steps, four stops.

The climb from ✅ `developed` to 🚀 `production` on the
[four rungs](../../../README.md#status). Not a new status — the roster has the
words already.

## Input

| Field | From |
|---|---|
| the department | the artist, by folder name — one per run |
| what they want it to be | the artist, at step 1, column by column |
| what it is | `scripts/audit.ts <department>` |
| prior art | the first House Label, if you have access (it is private) — evidence, and usually stale |
| what is true now | the web, via [`recruit-research`](../recruit-research), at step 3 — never skipped |
| what to update at the end | [`references/sweep.md`](./references/sweep.md) |

## Process

**Stops are 5, 7, 10 and 12.** Everything else is yours.

1. **Intake.** The artist says what they want, per staff-table column:
   Description · Input · Output · skills · knowledge · database. Write nothing.
2. **Audit.** `bun run .../scripts/audit.ts <department>`. Facts only — the row
   as published, claimed vs earned rung, each skill's mode and scripts, each
   knowledge page's `last_verified` and source count, live row counts, the
   prior-art paths. Read the prior art before step 3.
3. **Research the web, before discussing anything.** Run
   [`recruit-research`](../recruit-research) on the department and bring back
   sourced findings with URLs. This is not optional and it is not "if the
   knowledge looks thin":

   - **Prior art is a snapshot of what someone believed once.** The prior
     build's marketing corpus was a 2025 practitioner text with no citations.
     Ported whole, it read authoritative and was quietly out of date.
   - **Go to the primary publisher, not a blog quoting one.** IFPI, Luminate,
     the platform newsrooms, Spotify for Artists. A marketing blog citing "84%"
     without a link is a number with no owner. Read the PDF.
   - **Every figure carries its source and date beside it, in the sentence.**
     No `## What the numbers say` table, no `## Open questions` — a question is
     answered inline or cut, and where nobody publishes the answer, one
     sentence says so. `last_verified` is the day the page's claims were read
     off their sources, the only legal value; a page with nothing verified is
     not shipped. `agents:check` enforces all of it.

   The department was overhauled once without this step and the artist had to
   send the URLs herself, one at a time, after the knowledge was already
   written. That is the failure this gate exists to prevent.

4. **Discuss.** Step 1 against step 2 against step 3. Name both directions on
   the prior art: what it does that we don't, and what we do better. Say
   plainly where the research contradicts the prior art — that is the most
   valuable thing the pass produces.
5. **STOP — the plan.** Corrected Description · Input · Output, which asks become
   tasks, and what has to be built. **Input and Output decide everything after:**
   a task is a path from one to the other; the rest is the conversation.
6. **Build the data layer.** One `scripts/questions.ts` per task skill,
   **exporting `FLOW`** — that name is what [`engine/interview/load.ts`](../../../../engine/interview/load.ts)
   looks for, and the engine has no shell to find it any other way. Data only,
   every question carrying a `type`. **Options are lowercase, and a `multi`
   option is one token** — `normalize()` splits a multi answer on whitespace, so
   "what you keep" is a question with no legal answer; the readable phrasing
   goes in `ask:`. `load.test.ts` fails on any option the engine cannot accept. Any schema the plan needs and `data/`
   lacks. What a later step reads becomes a column, never a key in a blob
  . **Re-decide `google:` here too** — the pass just changed
   what this department produces, and a capability decided before it had skills
   was decided against nothing. A skill that now hands the artist a file wants
   `drive`; one that produces dates wants `calendar`; one that drafts an email
   wants `gmail`. `[]` stays right for a department whose output lives only in
   the artist's database. Adding a capability the engine does not build yet is
   four coordinated edits: [`engine/google/README.md`](../../../../engine/google/README.md).
7. **STOP — validate what was written.** The question sets and schemas, on
   screen, before anything is wired to them.
8. **Wire it.** The engine drives `FLOW` itself once the export exists — a
   terminal script is only needed where Claude Code or a human runs the skill
   directly (`runInterview({ flow, draft, here, offers, save })`). Then
   `mode: task` and `greeting:` / `greeting-fr:` in every task's frontmatter,
   and `discuss:` / `discuss-fr:` in `AGENT.md` — the sentence the artist
   hears. No `discuss` skill: the department answers questions itself, every
   claim sourced per
   [`agents/README.md` → What counts as a source](../../../README.md#what-counts-as-a-source).
9. **Run both user-personas, and read what they produce.** Before the artist
   is asked for anything:

   ```bash
   bun run evals:converse <dept> --persona indie-persona --turns 20
   bun run evals:converse <dept> --persona odile-ray   --turns 20
   bun run evals:converse <dept> --persona portland-punk --turns 20
   bun run evals:converse <dept> --persona ines-laval --turns 20
   ```

   All four, every time — they fail in different directions, and the one that
   catches your department is rarely the one you expected. Then read the
   transcripts with [`recruit-debrief`](../recruit-debrief) and fix what they
   found. **A conversation that ends with nothing written to the database is a
   failure even if every reply was good** — a sixteen-turn interview once ran
   beautifully and saved zero rows, and nobody would have known.

   Loop until both run clean. Only then step 10.

10. **STOP — the artist runs it.** Print the exact commands, copy-pasteable, and
    wait. The personas prove it works; the artist decides whether it is any
    good. A department is not proven by its author.
11. **Sweep.** [`references/sweep.md`](./references/sweep.md), every row. Then
   `agents:check` · `test` · `evals:run`. Then spawn `loop-verifier` with that
   table and report it verbatim, including the parts that hurt.
12. **STOP — the PR name.** Suggest one; the artist validates. AGENTS.md.

## Output

Four sentences: what the audit found, how it compares to the prior art, what
changed rung, what the verifier said. Not a transcript.

Done when `bun run test` prints the department inside `n / 10 in production`.

## Guidelines

- **Prior art is evidence, not a spec.** It is deployed; it is also wrong in
  places we have already found.
- **Never rewrite a department's voice here.** Mechanism and fact only — a
  register change is its own branch, or the diff is unreviewable.
- **Smaller is a good outcome.** Folding three thin skills into the conversation is a
  result. Skill count is not a measure.
- **Undeclared `mode:` is a blocker, not a default.** "Sort of both" means step 4
  is unfinished — usually because Output still names an activity, not an artifact.
- **No `discuss` skill.** A question is the department's own conversation; a
  skill for it is three rules copied, and `mode: discuss` is not a mode.
- **Never add to `SERVED` to green a test.** That list is what the runtime reads.
