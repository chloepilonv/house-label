---
name: manager-plan-release
description: >
  Use when a project is scoped and the artist needs the whole sequence — turns
  the branch set into every dated step of the release, each naming the
  department that owns it, on screen and as a page. Plans only; dispatches
  nothing.
metadata:
  agent: manager
  status: beta
  greeting: plan every dated step of your release, with who owns each one
  greeting-fr: planifier chaque étape datée de ta sortie, avec son responsable
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# manager-plan-release

**Status:** beta — [`scripts/plan.ts`](./scripts/plan.ts) reads the project,
resolves the plan, writes the page and (only with `--save`) the rows. Every date
and every warning is computed in [`scripts/milestones.ts`](./scripts/milestones.ts),
every price in [`scripts/costs.ts`](./scripts/costs.ts); both are pure and
covered by [`milestones.test.ts`](./scripts/milestones.test.ts) and
[`costs.test.ts`](./scripts/costs.test.ts).

The big view. Every department can plan its own slice; none of them knows that
vinyl started the clock two months before marketing thinks the project begins.
This produces the one calendar the others attach to — **and the one budget.**
Each priced step carries three ends, the plan sums them into three tiers, and
the artist's number is read against them:

| Tier | What it is |
|---|---|
| **Bare** | the cheapest published route for every step — !earshot at $7 a song, organic only, the cheapest flat distributor |
| **Decent** | a real run of every step — 45tours for francophone radio, 150 SubmitHub credits, Meta at $5 a day across the campaign window |
| **Full** | the same with the upgrade money would buy — a commercial radio format, PlaylistPush, Spotify Ads |

Every figure is a vendor's own published number, dated, linked from the page.
A quantity that is ours (150 credits, five weeks of Meta) says so in its basis.
Currencies are never converted: a USD line sits beside a CAD budget and is
counted apart.

## Data

```bash
bun run artist:brief label-manager
```

`Phases` already resolves each stored **week offset** into an absolute date
using the project's `street_date`. That resolution happens at read time on
purpose: store absolute dates and a moved street date leaves a plan quietly
disagreeing with itself.

`STREET DATE NOT SET` means refuse to produce absolute dates and say so — the
week offsets are still real, the calendar is not.

```bash
bun run artist:set project_phases '{"project_id":"<uuid>","sort_order":1,"title":"Funding","starts_week":-34,"ends_week":-28,"owner":"you"}' --conflict project_id,sort_order
```

Two things the schema means and prose keeps losing:

- **`starts_week` is signed** — negative before release, positive after.
- **A null `owner` is a real state**, not missing data. Merch has no department;
  record the gap in `gap_reason` rather than assigning someone who does not own
  it.

Regenerating reassigns what each `sort_order` *means*, and a phase's status
survives that — warn before regenerating a plan with work already marked done.

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| the whole plan | [`scripts/plan.ts`](./scripts/plan.ts) | **run it.** No arguments = preview + page. `--save` writes the rows. `--today=YYYY-MM-DD` for a reproducible run |
| the budget it is read against | `--budget=500 --currency=CAD` | the number the artist just said, without touching the project; with `--save` it becomes the project's budget. `--budget=none` clears it. Bare number — `"$500"` is a shell variable |
| the steps and their dates | [`scripts/milestones.ts`](./scripts/milestones.ts) | one entry per step, each carrying the day and where the day came from |
| the steps and their prices | [`scripts/costs.ts`](./scripts/costs.ts) | one entry per priced step, three ends each, every number cited to the vendor's page. The song count comes from `artist.songs` on the release; before the catalog is in it falls back to the project type and prints ≈ |
| branch set + answers | [`manager-scope-project`](../manager-scope-project) | required; an unscoped project is refused, not guessed |
| lead times and gates | [`../../knowledge/release-fundamentals.md`](../../knowledge/release-fundamentals.md) | the dates the release imposes and the gates behind every `sourced: true` entry |
| phase owners | [`../../knowledge/release-path.md`](../../knowledge/release-path.md) | one step per section, each naming its owner |
| existing plan | `artist.project_milestones` | keyed on `milestone_key`, so regenerating never moves a `done` mark onto other work |

## Process

0. **Any request for "the plan" is this skill.** "Give me the whole plan", "le
   plan au complet", "what's my plan" — run `plan.ts` and answer with what it
   prints. Never answer from a file: this repo has `STATE.md` files, loop files
   and commit messages that all use the word, and a run once returned the
   catalog crawl's block list to an artist who asked for their release plan. If
   `plan.ts` errors, that error is the answer.
1. **Refuse without an anchor.** No street date means no plan, and the script
   says so and stops. Offer to fix a month instead.
2. **Run `plan.ts`.** It finds the long pole, counts every step backward from
   the street date, groups them into phases, and writes
   `.plans/<project-slug>.html`. Nothing is written to the artist's data.
3. **Show the summary and the page.** The terminal summary is the phases with
   their steps; the page is what they will actually work from. Give them the
   path.
3b. **Read the budget block out, then settle the number.** With no budget
   stored, the block prints the three tiers and asks — that is the answer to
   "not much, but tell me what I'd need for something decent", and it is never
   a refusal. Then:
   - a tier picked → re-run with `--budget=<that tier's total>`;
   - a number said ("decent, but I can do 500") → re-run with `--budget=500`;
   - "$50" → it buys the bare tier; say so, say what decent adds, and plan on
     it if they hold.
   The verdict line under the block says which case you are in. A USD line
   beside a CAD budget is reported apart — never add it in, never convert it.
   The envelopes ("what each department gets") are what
   [`manager-brief-department`](../manager-brief-department) hands over.
4. **Ask before saving.** On yes, re-run with `--save` (and the `--budget` you
   settled on, so it is kept with the project). With Google connected, `--save`
   also writes these lines into the **EXPECTED** tab of the one `Budget` sheet
   in the workspace's `Budget/` folder, tagged with this release: its rows are
   rewritten on every save, other releases' rows are kept. The real expenses go
   in the SPENT tab beside it — the artist types those.
5. **Read the warnings out.** They are one sentence each and there are rarely
   more than five. The terminal shows three and says how many more are on the
   page; if the artist is only reading the terminal, read the rest.
6. **Hand off by phase or by department.** `manager-brief-department` takes
   either.

## Putting it on their calendar

Once the plan is saved, offer the calendar. On yes, run
[`scripts/calendar.ts --sync`](./scripts/calendar.ts) — the same thing
`houselabel calendar sync` does — and answer with what it prints.

- **Every event opens with its owner**, upper-cased and in the plan's language:
  `[PROMOTION] Radio serviced`, `[RIGHTS] Songs registered with your societies`,
  `[RELEASE]` for the day itself, `[YOU]` for the artist's own work. Same word
  as the plan page; see [`scripts/events.ts`](./scripts/events.ts).
- **The event id is the row's id**, so moving the street date and re-running
  rewrites the same events instead of doubling them. A `done` step is removed.
- **Undated steps stay off the calendar.** A step with no `offset_days` has
  nowhere honest to sit.
- **Never call `calendar_sync` by hand for the plan.** The tool is for a
  department with a handful of dates; the plan is twenty-eight rows and the
  script already knows their titles, owners and colours.

## Output

Header, first deadline, the phases with their steps, the budget block, then the
warnings — and a page.

```
Les heures creuses · out 2026-10-30 · 9 weeks
First deadline: Lead single uploaded — 2026-08-28 (in 2 days)

  1 · Finish the record             2026-09-04 → 2026-10-02   You
        ≈2026-09-04  Recording finished
        ≈2026-09-04  Mixed and mastered
        ≈2026-10-02  Cover art, credits and lyrics done
  2 · Rights, codes and money       2026-10-02 → 2026-10-30   Rights · You
        ...

Budget: $500 CAD
  Bare       $35 CAD + $54 USD
  Decent     $545 CAD + $174.99 USD
  Full       $1,005 CAD + $599.99 USD

  Promotion      $35 CAD + $35 USD → $335 CAD + $150 USD → $335 CAD + $575 USD
      Radio serviced                           $35 CAD → $335 CAD
      Editorial pitch sent to Spotify          free
      Independent playlist curators pitched    $35 USD → $150 USD
  Distribution   $19 USD → $24.99 USD
      Distributor chosen                       $19 USD → $24.99 USD
  Marketing      free → $210 CAD → $670 CAD
      Marketing campaign starts                free → $210 CAD

  What each department gets
  Promotion      $309 CAD   (bare $35 CAD · decent $335 CAD)
  Marketing      $191 CAD   (bare $0 CAD · decent $210 CAD)

  → $500 CAD covers the bare run ($35 CAD) but not a decent one ($545 CAD); the $45 CAD gap sits mostly in Promotion, and a grant would close it.
  → $599.99 USD of the full run is priced in another currency and is not counted against your CAD budget.

Read these
  1. Your masters land 16 days after the plan needs them (2026-09-20 vs 2026-09-04). Everything downstream moves by the same 16 days.
  2. "Fausse alerte" has to be uploaded 2026-08-28 — 23 days before your masters land. Finish that one track early, or move the single.
  +2 more on the page

Plan: .plans/les-heures-creuses.html
Not saved yet.
```

- **A vendor is named as the source of a number, never as a decision.**
  "Radio servicing from $35 (!earshot)" is a budget line. "Use 45tours" is the
  promotion department's call, and saying it here duplicates them.
- **Free is printed as free.** An editorial pitch costs nothing and artists are
  sold it constantly; the $0 line is information.
- **No published price keeps its line** and says why — the plant quotes the
  run, CMRRA sets the per-unit rate on the press invoice.

- **Calendar dates, never `W-n`.** Week offsets are the storage format so a
  moved street date moves the plan; they are resolved before anything reaches
  the artist. An artist read `W-9 → W-4` once and could not use it.
- **Two dates mean a window.** `2027-03-19 → 2027-04-09` is "aim for the first,
  the second is the last honest moment". One date means the step really is one
  day. The plan never states a range as a single number and then hides which end
  it picked.
- **Every step links its sources.** The page's "where every date comes from"
  section renders `SOURCES` as clickable links, so a claim about Spotify's floor
  is one click from Spotify's page.
- **`≈` means the day is derived, not published.** The step is real and its
  position is arithmetic off a sourced one. One line at the foot of the plan
  says so; it is never a warning per step.
- **Steps with no honest date keep their line** and print the reason instead —
  the plant names the test-pressing day, the funder names the grant deadline.
- **Warnings are one sentence each.** A five-line warning under ⚠ is a warning
  nobody finishes.

### The page

`.plans/<project-slug>.html`, one file per project, overwritten on every
regeneration — a folder holding four versions of the same plan is a folder where
the artist opens the wrong one. The slug is the title, accent-folded and
hyphenated. `.plans/` is gitignored: generated, regenerable, and the artist's
private data. It is self-contained, prints, and every step has a checkbox.

## Guidelines

- **Learn the shape from a real campaign.** Each `references/example-<name>.yaml`
  is one release as a real artist ran it — the release, the links, the content
  folders, the budget, and its `plan:` one line per action: Date · Action ·
  Agent · Status (Done / To do / Won't do) · Source. Read every one there is
  before planning: short actions, one line per channel ("Pitch radios
  communautaires", not one per station), the department folder as owner,
  `label-manager` when no department owns it, the tool or page it was done on
  as source, never an amount. It is an example, not a template: its dates and
  vendors are hers.

- **Never invent a lead time — and never drop the step either.** If
  [`../../knowledge/release-path.md`](../../knowledge/release-path.md)
  has no number, the step is placed by the thing that depends on it and marked
  `≈`, or it ships with no date and the reason on the line. Leaving it out is
  how a release plan ends up with no mastering in it.
- **Ask the artist for the one date nobody can source.** No studio publishes a
  mix or mastering turnaround, so `manager-scope-project` asks when the
  masters land rather than guessing. Their answer becomes a warning when it is
  later than the plan needs, never a silent compression.
- **Never invent a price — same rule as the dates.** A number in
  [`scripts/costs.ts`](./scripts/costs.ts) is a vendor's own published figure
  with its page and the day it was read, or the step prints "no published
  price" and the reason. A quantity we chose says it is ours. The manager
  prices the plan; the department picks the vendor.
- **Never convert a currency.** A USD line is reported in USD beside a CAD
  budget, counted apart. A rate we made up is a lead time we made up.
- **Never refuse a small number, and never refuse "not much".** $50 buys the
  bare tier and the plan says what the next dollars add; no number gets the
  three tiers and a question.
- **Never emit tasks.** Milestones with owners and dates. The moment this
  produces "post a teaser on Tuesday" it has duplicated `digital-marketing`.
- **Never dispatch.** It names the department; the artist decides who to talk to.
- **Never answer "the plan" from the filesystem.** The plan is rows, reached by
  running the script. A grep that finds a plausible file has found a different
  subject.
- **Never move the street date silently.** A date that doesn't fit is reported as
  a gap in days, and the artist chooses.
- **Never collapse a range to a number silently.** Carry both ends. Vinyl plans
  at the 12-week end and prints the 8-week end beside it; the editorial pitch
  aims at four weeks and prints Spotify's seven-day floor. The artist decides
  where in the window they live — the plan's job is to show them the window.
- **Route a missing department, do not just name the hole.** A step with no
  staff owner carries the department the label lacks and points at the
  Recruiting Agent. `merch`, `manufacturing` and `artwork` are the three today.
- **Never store an absolute date.** Offsets from `artist.projects.street_date`,
  resolved at read time. Stored dates survive a street-date change and quietly
  disagree with the project they belong to.
- **Regeneration is safe for milestones, not for phases.** Milestones upsert on
  `milestone_key`, so a `done` mark stays on the same work. Phases still key on
  `sort_order`; warn before regenerating if any phase is in flight.
