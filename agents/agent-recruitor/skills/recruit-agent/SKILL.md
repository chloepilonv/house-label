---
name: recruit-agent
description: >
  Use when the label needs a new department or an existing one restructured —
  scopes the role against how real labels divide work, decides agent vs skill,
  then scaffolds a conforming agent folder (AGENT.md, skills, knowledge stubs,
  evals) and registers it in the staff table. Triggers on "we need an agent
  for X", "add a department", "should this be its own agent?".
metadata:
  agent: recruit
  status: developed
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# recruit-agent

**Status:** developed — the spec is complete; no code behind it yet.

Turn "we need someone who does X" into a department that reads like every other
department. The scaffolding is the easy half; the work is deciding whether X is
a department at all.

## Input

| Field | From | Notes |
|---|---|---|
| the request | conversation | usually a verb, rarely a role |
| artist situations | conversation | what the artist would type to reach it; if none can be named, stop |
| existing roster | `agents/*/AGENT.md` | every department, slug, and skill — read before proposing |
| the format contract | [`agents/README.md`](../../../README.md) | wins over memory of what an agent looks like |
| templates | [`assets/`](./assets) | `AGENT`, `SKILL`, `knowledge`, `evals.template` |
| industry map | [`label-departments.md`](../../knowledge/label-departments.md) | which real label function this maps to |

## Process

Six steps, five gates. **A gate means stop and get the user's word** — not
propose-and-proceed. Never run the steps end to end in one pass.

### How a gate is presented

A gate is a **wizard card**, not a paragraph. Fixed fields, filled from research,
ending in numbered choices. The shape never varies; only the content does.

```
┌─ GATE n/5 · <Name> ─────────────────────────────────
│ <FIELD>    <value>
│ <FIELD>    <value>   <source or check>
│
│ [1] <the default, stated as an action>
│ [2] <the realistic alternative>
│ [3] stop
└─────────────────────────────────────────────────────
```

Rules, because a wizard that drifts back into prose is not a wizard:

- **No paragraph inside a card.** Values are phrases; the longest is one line.
- **Every claim carries its source inline** — `file:line`, a URL, or a check
  mark. A value with no source is a value that was invented.
- **Options are numbered, exhaustive, and always include stop.** The user replies
  with a number, or overrides in their own words.
- **Never ask two things in one card.** One decision per gate.
- **The card is the whole message.** No preamble above it, no summary below.

### The five cards

| Gate | Fields |
|---|---|
| **1 · Scope** | `REQUEST` · `MAPS TO` (label-departments row) · `TEST` (4 checks, ✓/✗) · `VERDICT` (department / skill on X / neither) · `PROPOSED` (slug, department, staff-member — or the skill name) · `CHECKS` (prefixed · no repeated word · unique across the roster) |
| **2 · Role** | `OUTCOME` (one sentence, artist's terms) · `ROLE` (≤3 lines) · `SPLIT?` (does it need an "and also" — yes means two departments) |
| **4 · Skills** | one row per skill: `NAME` · `DOES` · `LEANS ON` (the research finding or table) · `COUNT` (2–4) |
| **5 · Documentation** | `WROTE` (file tree) · `GUIDELINES` (the actual rules, verbatim) · `MEMORY` (the actual list) · `CHECK` (agents:check result) |
| **6 · Evals** | one row per case: `CASE` · `WITH` · `ABLATED` · `VERDICT` · plus the real outputs below the card |

### 1. Validate the agent name — **gate**

- Find the request in [`label-departments.md`](../../knowledge/label-departments.md).
  Maps to something the label doesn't do → say so and stop. Maps to nothing →
  name the closest real function and ask.
- Run the four-part test in [`AGENT.md`](../../AGENT.md). A new verb on an
  existing noun is a skill — propose it there and stop. Settled verdicts:

  | Request | Verdict | Why |
  |---|---|---|
  | radio or playlist pitching | **skill** on `promotion` | getting played is one desk; `press` is getting written about |
  | sync licensing | **agent**, once the data exists | own vocabulary (supervisors, cue sheets, one-stop clearance); blocked on a dataset, not on scoping |
  | better bios | **skill** on `presskit` | a verb on a noun that department owns |
  | mastering tracks | **neither** | crosses line 1 — no agent makes music |
  | filing registrations for you | **neither**, as stated | crosses line 3; the worksheet version is what we ship |
- Surviving both, propose the vocabulary: `slug` (short, unused across the
  roster and against `package.json` scripts), department name, staff-member
  name. **Wait.**

### 2. Validate the role description — **gate**

One sentence naming the outcome in the artist's terms, then the `## Role`
paragraph. If it needs an "and also", it's two departments — split and return to
step 1 with each half. **Wait.**

### 3. Search online for `knowledge/`

Hand off to [`recruit-research`](../recruit-research). Its findings become three
things:

| Finding | Becomes |
|---|---|
| how the job is done in QC, CA and US | `knowledge/` files — a `<slug>-fundamentals.md` plus the few files its skills read; every claim sourced and dated where it stands. A question research cannot close is one sentence saying nobody publishes it — never a list for later |
| tools practitioners use | `## Tools` — existing categories, plus a Proposed table |
| filter vs read verdict | a `catalog.<slug>_<noun>` table (+ a crawl source if it goes stale), or knowledge only |

**Stop if research says it can't work.** Data that is paywalled, login-walled,
or has no stable source ends the run. Name what would unblock it — a blocked
role is a `data/` branch first and a department second.

### 4. Validate the required skills — **gate**

Propose 2–4 skills, each one thing the artist asks for, each named
`<slug>-<verb-phrase>`: globally unique, no word repeated between halves. One
line each on what it does and which finding it leans on. More than four means
step 2 was too broad. **Wait** — last cheap moment to change the shape.

### 5. Complete the agent documentation — **gate**

Generate from [`assets/`](./assets), substituting every `{{placeholder}}`. Two
are decisions, not fill-ins: `tools:` follows from the approved skills, and
`data:` splits into tables that exist and `proposed:` for tables that don't. Add
the staff-table row. Run `agents:check`, then `agents:sync`.

**A knowledge file is written on the day its claims are read**, from
[`knowledge.template.md`](./assets/knowledge.template.md): `name` equals the
file name, `last_verified` is that date, every claim carries its source where
it stands, and every relative link resolves. `agents:check` refuses
`last_verified: never`, any `## Open questions`, `## Sources to answer them
from` or `## What the numbers say` section, any `- [ ]`, and a knowledge file
with no line under `## Knowledge` in `AGENT.md`. Spec the code enforces — score
weights, column names, flags — goes in the skill's `references/`, not in
`knowledge/`.

Then present **the two sections no gate has seen** — `## Guidelines and rules`
and `## Memory` — as text in the conversation, not a path to go read. This step
wrote fifteen files; the behaviour contract is the one that matters most and was
argued least. **Wait.**

Hand each `SKILL.md` to `skill-creator` for description triggering.

**A department that cannot read the artist is a department that asks twice.**
`data:` declares which `artist.*` tables the agent touches; declaring them is
not reaching them. Three things make the declaration real, and none is
optional:

1. **A `## Data` section in every skill** that reads or writes artist data,
   naming the exact command — `bun run artist:brief <slug>`, plus the
   `artist:get` / `artist:set` / `artist:remember` calls it needs. Never SQL,
   never a bare table name — a skill that only says which table it reads has
   told the agent nothing it can run.
2. **An entry in [`data/artist/brief/rules.ts`](../../../../data/artist/brief/rules.ts).**
   Add the slug to `RULES` — `rules.test.ts` fails until you do, because a
   department missing from that map falls through to the core brief and looks
   like it works. Write real sections when the department's first question has
   a shape worth encoding: which release, which deadline, which room. A
   core-only rule is a legitimate answer for a department that only explains,
   but it goes in `CORE_ONLY` so the choice is visible rather than a gap. Every selection rule
   needs a case in `rules.test.ts` — one left in prose is one the model
   re-decides every run, which is the defect this whole layer exists to remove.
3. **A `google:` line, decided rather than defaulted.** It says what this
   department may do with the artist's connected Google account: `drive` (a
   finished file lands in their Drive) · `calendar` (dated work lands on a
   calendar they picked) · `gmail` (outreach opens as a prefilled compose link
   — it cannot send). `[]` is the common and correct answer, and it means
   "considered, needs nothing" rather than "not looked at" — `agents:check`
   refuses a missing key for exactly that reason. Decide it against the skills
   just scoped: a skill promising a file in the artist's Drive under `google:
   []` is the drift [`recruit-audit`](../recruit-audit) reports.

`bun run artist:brief <slug>` must return something before this gate closes.

### 6. Run the evals and validate the result — **gate**

Write the cases from `evals.template.json`, including one that should fail
cleanly — what a department does when it can't deliver is half of whether it
works. Hand off to [`recruit-evaluate`](../recruit-evaluate) for the loop; a
single pass gives a score, not an answer.

**Wait** at each turn. Done is when the user says the outputs are right — not
when the files exist, not when the grid is green.

Only then promote `status:` to `developed` and re-run `agents:check`. Left at
`draft`, it waives the `## Tools` and `evals.json` rules this step just satisfied.

`status_frontend:` stays `draft`. It is the second, ungated ladder — a
department with no GUI is `draft` on it however good its markdown is, and only
the artist moves it.

## Output

**A complete department**, written at step 5:

```
agents/<slug>/
├── AGENT.md                       # six sections; tools: and data: decided, not defaulted
├── knowledge/<topic>.md           # sourced, dated facts; last_verified = the day they were read; no open questions
├── skills/<slug>-<verb-phrase>/
│   └── SKILL.md                   # Data · Input · Process · Output · Guidelines
└── evals/evals.json               # a case per skill, one of them a should-fail
```

Plus, outside the folder:

| | |
|---|---|
| `agents/README.md` | its row in the staff table, tables mirroring `data:` |
| `.claude/skills/`, `.claude/agents/` | its symlinks and subagent, via `agents:sync` |
| `data/catalog/catalog.sqlite` (`tools`) | any tool research proposed |
| `data/artist/brief/rules.ts` | its `Rule` in `RULES`, plus cases in `rules.test.ts` |

Every `{{placeholder}}` substituted, `agents:check` passing — plus a handoff note
of what still needs a human: any schema and crawl source, the `skill-creator`
pass, and any claim the files state as "nobody publishes it", so a human can
decide whether to ask the institution.

Gates output a proposal and a question, nothing on disk. Failing step 1: one
paragraph and a concrete alternative, no files.

## Guidelines

- **A gate is a stop, not a checkpoint.** Presenting a proposal and acting on it
  in the same turn is the failure this process exists to prevent.
- **A new skill on an existing department is also this skill's job.** Refusing a
  folder is not declining the work: run steps 3–6 against the existing agent,
  skipping step 1's naming and step 5's folder generation.
- **Promoting a draft runs the same steps** from step 2. Never regenerate a
  draft's folder from `assets/` — it would overwrite the scoping in its
  `AGENT.md`.
- **A Proposed tool becomes a `catalog.tools` row, or it becomes drift.** Write
  it into the `tools` table of `data/catalog/catalog.sqlite` in the same pass.
- **Never invent industry knowledge.** Structure is generated; domain fact is
  researched and carries URLs.
- **Never generate from memory.** Read `assets/` and the contract at scaffold
  time; where they disagree with you, they win.
- **Refuse gracefully.** "This is a skill on the Press Agent" is a successful
  outcome of this skill.
- **One department, one commit** — folder, staff-table row, synced output.
- **Don't write SQL.** Naming a table is in scope; designing it is `data/`'s job.
- **Every department inherits `i-have-adhd`.** The scaffold carries the rule;
  don't restate it per skill. A department that opens with "Great question!"
  or closes with "let me know if you need anything else" is a bug.
- **Write in bullets.** House style is in [`agents/README.md`](../../../README.md);
  a new department that reads like an essay is a rewrite, not a draft.
