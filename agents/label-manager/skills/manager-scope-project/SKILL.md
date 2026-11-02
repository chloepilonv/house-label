---
name: manager-scope-project
description: >
  Use when the artist names a project but no plan exists yet — asks a fixed
  question set, one question at a time, whose answers select which branches of
  the plan exist. Scopes only; produces no dates.
metadata:
  agent: manager
  status: beta
  greeting: scope a new release with you
  greeting-fr: cadrer une nouvelle sortie avec toi
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# manager-scope-project

**Status:** beta — the interview is
[`scripts/scope.ts`](./scripts/scope.ts). It holds the state, prints exactly one
question, and refuses to write anything until the artist says yes. The question
set and the branch rules are data in
[`scripts/questions.ts`](./scripts/questions.ts). Only the acknowledgement
between questions is prose.

A release plan branches on facts only the artist has, and guessing any of them
produces a confident plan for a project that doesn't exist. Always the same
questions, in the same order, before any date is computed.

## Data

```bash
bun run artist:brief label-manager
```

`Project` shows whether one is already scoped, and the `Artist` section answers
several of the ten questions before they are asked — country, markets, locale.

Persist as answers arrive:

```bash
bun run artist:set projects '{"title":"...","project_type":"album","physical":"vinyl","markets":["quebec"],"scope":{}}'
```

`scope` is free-shaped jsonb because the question set lives in
[`scripts/questions.ts`](./scripts/questions.ts) and is allowed to grow without
a migration. The columns lifted out of it — `physical`, `recording_status`,
`markets`, `lead_single_id` — are the ones the plan branches on, so they must
be set as columns and not left inside the blob.

A null `street_date` is a legitimate scoped state. Do not invent one to make
planning possible.

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| the whole interview | [`scripts/scope.ts`](./scripts/scope.ts) | **run it.** `next` · `answer <id> <value>` · `why <id>` · `save` · `reset` |
| the question set | [`scripts/questions.ts`](./scripts/questions.ts) | the only source; never restated in prose, and never counted in prose |
| prior answers | the draft file, then `artist.projects` | asked once per project; re-asked only on change |
| artist profile | `artist.profile` | offers `markets` and the language; still confirmed, never assumed |
| existing release | `artist.releases` | offers `title`, `project_type` and `street_date` when a row already exists |

## Process

1. **Run `scope.ts next`.** It reads the artist's own data on the first call,
   caches what it can offer, and prints the next unanswered question. It never
   prints the set.
   **A missing `.env` file is not evidence about a database.** `.env.local` is
   gitignored and a hosted deployment has no file at all; the connection string
   arrives in the environment. The script errors loudly when `DATABASE_URL` is
   genuinely unset, and that is the only thing that means no database.
2. **Relay the question, with one sentence of your own on top.** Acknowledge
   what they just told you in their terms — "four tracks, folk guitar, good,
   that's an EP" — then the question. One sentence, not a summary, and never a
   restatement of the answer as a row.
3. **Record with `scope.ts answer <id> <value>`.** That prints the next question
   in the same call, so one command per turn is enough. Nothing reaches the
   database.
4. **Lines starting with `#` are yours, not theirs.** They carry the next
   command. Everything else the script prints is artist-facing and may be
   relayed as-is.
5. **Say why on request, never unprompted.** `scope.ts why <id>` prints it.
6. **Accept "I don't know".** Optional questions record `unknown` and stay
   answerable later. A required question left unknown blocks the plan and the
   script names it.
6b. **Accept "not much" as the budget.** A number becomes the budget; "pas
   grand-chose", "tell me what it costs", or nothing at all stores no number,
   and that is not a gap — [`manager-plan-release`](../manager-plan-release)
   prices the plan in three tiers and asks which one. Never push for a figure
   the artist does not have.
7. **Ask before saving.** When the set is complete the script prints the
   answers, the branch set, and the question. Wait for the artist. On yes, run
   `scope.ts save`; on a change, `scope.ts answer` again.

## Output

The script's output, relayed, with one sentence of acknowledgement on top.
Saving also writes the project's row in `artist.releases` and links it
([`data/artist/release-link.ts`](../../../../data/artist/release-link.ts)), so
distribution, promotion, press and the credits work on this record and not on
the artist's newest old one. While
the interview runs that is one question and a count:

```
Question 4 of 11 — where it comes out

Where are you releasing — Quebec, rest of Canada, the US, or a mix?
  options: quebec · canada · usa
  suggested: quebec, canada — you're based in QC · say yes to take it, or give me another
```

At the end, the scope, the branch set, and the question that has to be asked:

```
That's everything I need.

  the name                 Les heures creuses
  what it is               ep
  the release date         2026-10-30
  ...

What this project contains: creation · rights · distribution · presskit · press · campaign · post_release

Want me to save this project?
```

- **One question on screen at a time.** No ANSWERED block, no STILL TO ASK
  block, no asterisks. The count is the whole progress display — and it only
  ever shrinks, because a conditional question counts until its dependency
  rules it out.
- **Unanswered required questions replace the save prompt**, naming each one in
  the artist's words rather than by column name.
- **`unknown` prints as `unknown`.** Never a default, never an inference.

## Guidelines

- **Never invent an answer.** A project's shape is the artist's to state; a
  guessed `physical` value moves the plan's start by two months.
- **Never reorder or drop a question.** The order is a dependency order: the
  name, the anchor (`project_type`, `street_date`), then `markets` because it
  sets the language of everything after it, then the long pole (`physical`).
- **Never state a count in prose.** The set grows — `title`, `masters_ready` and
  `lead_single_date` were all added after it shipped — and "the ten questions"
  written in four files is a rename waiting to be missed. The script counts.
- **Never produce dates here.** Scoping and planning are separate so the artist
  can change one answer without regenerating a plan they have started working.
- **Never write without being asked.** The draft is a file; `save` is a verb the
  artist authorises. This is the one rule that had to move out of prose and into
  the script, because prose asking is asking that gets skipped.
- **Lead times live in
  [`../../knowledge/release-path.md`](../../knowledge/release-path.md).**
  This skill names branches; it does not know how long any of them take.
