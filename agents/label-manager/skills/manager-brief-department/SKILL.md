---
name: manager-brief-department
description: >
  Use when the artist picks a phase or a department and wants to act on it —
  turns it into the exact ask, with real dates and the context that department
  needs. Hands the brief to the artist and records it on request; never
  dispatches.
metadata:
  agent: manager
  status: beta
  greeting: brief a department on the next phase
  greeting-fr: préparer le mandat d'un département pour la prochaine phase
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# manager-brief-department

**Status:** beta — [`scripts/brief.ts`](./scripts/brief.ts) loads the steps,
resolves every offset to a calendar date, and carries the row ids. It takes a
phase number **or** a department slug.

A phase name is not an instruction. "Build the story, W-12, presskit" tells the
artist where to go and nothing about what to ask for. This writes the ask, in
the artist's words, so the receiving department starts with context instead of
an interview.

## Data

```bash
bun run artist:brief label-manager
```

`Phases` gives the phase, its resolved dates and the department that owns it —
which is the ask being handed over.

Then read the receiving department's own brief, so the hand-off names what they
already have rather than repeating it back at them:

```bash
bun run artist:brief <owning-department>
```

A phase with `NO DEPARTMENT` cannot be briefed to anyone. Say which capability
the label is missing instead of routing it to the nearest department — that is
what `gap_reason` records.

This skill hands the brief to the **artist**. It never dispatches, so it writes
nothing.

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| the phase or the department | [`scripts/brief.ts`](./scripts/brief.ts) `<n \| slug>` | **run it first.** Reads the plan over `DATABASE_URL`; never answer a phase number from memory or git history |
| owner | [`../../knowledge/release-path.md`](../../knowledge/release-path.md) | each step names its owner; a phase with no owner is refused, not reassigned |
| scoping answers | `artist.projects` | the facts the department would otherwise ask for |
| readiness | [`manager-check-readiness`](../manager-check-readiness) | what is missing gets stated up front |
| the handoff record | `artist.project_handoffs` | `--send` writes one row per brief actually handed over, deadline frozen |

## Process

1. **Resolve the owner.** A phase can be shared: "build the story and pitch it"
   is presskit, press and marketing in one window. The script lists each
   department with its own steps and asks which one — naming one would be a
   guess, and briefing all three at once is the second intake this skill exists
   to prevent. `--dept=<slug>` picks. A step whose owner is "nobody" — merch, or
   the artist's own recording — returns the gap and stops.
2. **Pull only what that department needs.** `press` needs the release date,
   markets and language; it does not need the budget split. Over-briefing is how
   a handoff becomes a second intake.
3. **State every deadline as a date, not an offset.** The artist is leaving this
   department; `W-12` means nothing on the other side, and it meant nothing to
   the artist either.
4. **Lead with what is missing.** If readiness shows a blocker the receiving
   department will hit, it goes in the first line of the brief.
5. **Carry the row ids.** The brief prints the project id so the receiving
   department can open the rows instead of re-deriving them from prose. A brief
   that says "the long bio" starts a search; one that carries the id does not.
   That line is for the receiving agent — it is not read out to the artist.
6. **Record it only when the artist actually asks.** `--send` writes the
   handoff and moves the phase to in progress. Printing a brief is not the same
   as handing it over, and a row for a brief nobody sent is a pipeline that
   lies.
7. **Hand it over.** Print the brief and name the skill the artist should reach
   for — the first entry in that department's `skills:` frontmatter. Do not
   invoke it. A department with no skills yet is reported as having none.

## Output

The brief, then the handoff line.

```
press → Press Agent
2026-09-04 → 2026-11-06

  Les heures creuses — ep, out 2026-10-30.
  Markets: quebec, canada. Physical: none.

  What they need to deliver:
    2026-09-04  Advance listening link up
               One private link that will not expire. Exclaim! refuses download-only
               folders and CKRL bans WeTransfer by name.
    2026-09-11  Radio serviced
    2026-09-25  Press and media pitched
    ...

→ Ask Press Agent: press-compose-outreach
```

The whole budget is absent on purpose: `presskit` cannot use it. Only
`digital-marketing` receives it — see `WANTS_BUDGET` in
[`scripts/brief.ts`](./scripts/brief.ts). **Every department whose steps carry
a price gets its envelope instead** — one line, computed from the cost columns
the plan saved, the same arithmetic as the plan page:

```
  Your share of the budget: $309 CAD of $500 CAD (bare $35 CAD · decent $335 CAD).
```

With no budget set, the line says what that department's part costs bare and
decent, so the receiving desk still knows the range it is working in.

- **The brief is the artist's to send, edit or ignore.** It is written in their
  voice, not as a system message.
- **A phase with no owner returns the gap**, in the same shape, saying which
  department the label does not have.

## Guidelines

- **Never dispatch.** Naming the skill is the handoff; calling it is not this
  department's job and would skip the artist's decision. Recording a handoff is
  not dispatching — it is remembering what the artist chose to ask for.
- **The frozen deadline is deliberate.** It is the one absolute date this
  department stores, because it records what the artist was told. When the
  street date moves, that frozen date is how the stale brief is found.
- **Never re-answer the receiving department's questions.** The brief carries
  facts, not conclusions — `press` decides who to pitch, not this.
- **Never brief two departments at once.** A shared phase returns the list and
  the question, never a merged ask.
- **Name departments the way the artist hears them.** "Press Agent", not `press`;
  "Rights", not `rights`. The slug is a folder name.
- **This hands a *phase*, not a question.** A question about how something works
  is answered by that department itself; this hands a phase with its
  deadline and its blockers.
