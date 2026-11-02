---
name: manager-check-readiness
description: >
  Use when the artist asks what they are missing, or before a phase is handed
  off — reports which deliverables exist, which are missing, and which gate is
  blocked as a result. Reads by default; keeps the checklist on request, and
  never asks twice about something the artist has already answered.
metadata:
  agent: manager
  status: beta
  greeting: tell you what your release is still missing
  greeting-fr: te dire ce qui manque encore à ta sortie
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# manager-check-readiness

**Status:** beta — the check is code:
[`scripts/readiness.ts`](./scripts/readiness.ts) derives the required set from
the project's branches, counts what exists, and prints the gates.

Every release stalls on the same thing: one missing asset nobody was tracking.
This is the gate, not the wish list — it reports what blocks a phase, not
everything that could theoretically be improved.

## Data

The readiness check is a cross-department read. Each department's own brief is
the authoritative answer for what it holds:

```bash
bun run artist:brief label-manager     # the phases and what they are blocked on
bun run artist:brief presskit          # which presskit fields are MISSING
bun run artist:brief rights         # registrations, share hygiene
```

Reading each department's brief rather than querying its tables directly is
what keeps this skill honest: the selection rules stay in one place, and a
deliverable is "missing" by the owning department's definition, not this one's.

Record only blockers with a real gate behind them:

```bash
bun run artist:set project_phases '{"project_id":"<uuid>","sort_order":3,"title":"...","blockers":["no distributor on the release"]}' --conflict project_id,sort_order
```

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| the whole check | [`scripts/readiness.ts`](./scripts/readiness.ts) | **run it.** Reads every table below over `DATABASE_URL` and prints the gates; never answer this from prose |
| branch set | [`manager-scope-project`](../manager-scope-project) | decides which deliverables are required at all |
| the gates | `artist.project_milestones` | each gate is one milestone, so its name and its date come from the plan rather than a regex over phase titles |
| existing assets | `artist.presskit`, `artist.presskit_items`, `artist.songs`, `artist.releases` | presence is read, quality is never judged |
| identifiers and splits | `artist.songs`, `artist.song_splits`, `artist.registrations` | ISRC/UPC and split completeness block delivery |
| what the artist already answered | `artist.project_deliverables` | `--save` keeps the checklist; `--confirm="<item>"` records an answer the schema has nowhere to hold |

## Process

1. **Run [`scripts/readiness.ts`](./scripts/readiness.ts).** Every rule below is
   implemented there because a model applies them inconsistently: one run
   reported "0 of 3" ISRCs for a catalog whose first song had one, another
   printed the present rows too. Counting is not a judgment call. It also read
   `lead_single_id` alone and reported "undecided" for a project whose single
   was already named, dated and on the plan.
   **A missing `.env` file is not evidence about a database** — the script
   errors when `DATABASE_URL` is genuinely unset, and that is the only thing
   that means no data.
2. **Derive the required set from the branches, not from a fixed checklist.** A
   single with no physical needs no test-pressing approval; asking for one is
   noise.
3. **Check presence only.** A bio exists or it doesn't. Whether it is a good bio
   is [`presskit`](../../../presskit)'s judgment, not this department's.
4. **Attach each missing item to the gate it blocks**, and to the department
   that produces it. A missing item that blocks nothing is not reported.
5. **Report the earliest blocked gate first**, because that is the one with the
   least time left.
6. **Offer the way out of a `?`.** An untracked item is one the schema cannot
   see, so it reappears every run until the artist answers it. Run
   `--confirm="cover art"` when they do, and it stops being asked.
7. **Keep the checklist only when asked.** `--save` upserts the rows and marks
   the blocked phases. A read stays a read without it, and a re-derivation never
   overwrites a confirmation.
8. **Say nothing about items that are present.** A list of things already done
   is the padding that makes a readiness check unreadable.

## Output

Blocked gates first, then the deliverables under each, then what is unknowable.

```
READINESS · ep · 9 weeks out

BLOCKED  Presskit and press release finished  — due 2026-09-04
  ✗ long bio             missing                            Presskit
  ✗ press photo          none                               Presskit

BLOCKED  Record uploaded to the distributor  — due 2026-10-02
  ✗ ISRC                 1 of 3 assigned                    Royalties
  ✗ UPC                  not assigned                       Royalties
  ✗ master splits        0 of 3 songs                       Royalties
  ✗ distributor          not chosen                         Distribution

  ? master files         nothing in your data records that the masters landed
  ? cover art            nothing in your data records it

? = nothing in your data records it, not that it is absent.
Tell me once and it stops being asked. Present items are omitted on purpose.
```

- **Every gate is a date, never `W-2`.** The offset is how the plan is stored;
  the artist gets the day it falls on.
- **Every missing line names its producing department** the way the artist hears
  it — "Presskit", not `presskit` — so the next step is never ambiguous.
- **Partial counts are shown as counts** — "4 of 11" — never rounded to
  "in progress".
- **A confirmed item disappears.** Once the artist has said the cover art
  exists, it is not reported again — repeating it is the nagging the row exists
  to end.
- **Untracked deliverables print as `?`,** not as missing. We do not know the
  cover art exists; we know we have nowhere to record that it does.

## Guidelines

- **Never judge quality.** Presence only. A department that starts grading a bio
  has taken `presskit`'s job.
- **Never invent a deliverable.** The required set comes from the branch set; a
  plausible extra item is noise the artist has to disprove.
- **Never report a missing item with no gate.** If nothing is blocked by it, it
  is a suggestion, and suggestions belong to the department that owns the asset.
- **Distinguish missing from untracked**, every time. Reporting `?` as `✗` sends
  the artist to redo work they have already done.
