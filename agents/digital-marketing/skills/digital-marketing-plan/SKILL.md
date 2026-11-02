---
name: digital-marketing-plan
description: >
  Use when a single, EP or album release needs its campaign — a
  one-question-at-a-time intake grounded in the scoped project, then the
  phased, budget-allocated plan materialized into dated tasks. Also refines an
  existing plan.
metadata:
  agent: digital-marketing
  status: beta
  mode: task
  greeting: plan the campaign for your single, EP or album
  greeting-fr: planifier la campagne de ton single, EP ou album
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# digital-marketing-plan

**Status:** beta — the interview is [`scripts/plan.ts`](./scripts/plan.ts) over
the question set in [`scripts/questions.ts`](./scripts/questions.ts); the
publishing groups are [`scripts/format-groups.ts`](./scripts/format-groups.ts)
and the budget arithmetic is
[`scripts/reconcile-budget.ts`](./scripts/reconcile-budget.ts). What is left in
prose is the judgment: which tasks exist, and which of them deserve the money.

Produce a phased campaign plan — 14–20 tasks from roughly 3–4 weeks before the
target date through 1–2 weeks after — obeying the arc in
[`../../knowledge/marketing-fundamentals.md`](../../knowledge/marketing-fundamentals.md),
the create→post pairing in [`../../knowledge/content.md`](../../knowledge/content.md),
the format groups and posting windows in
[`../../knowledge/platform-conventions.md`](../../knowledge/platform-conventions.md),
and the budget allocation in [`../../knowledge/paid-promotion.md`](../../knowledge/paid-promotion.md).
In refine mode, change only what the artist asked for and preserve everything
else.

**This skill absorbed `digital-marketing-intake-interview`.** That skill produced no
artifact of its own — it produced the input to this one, from a question set
this one had to read anyway. Two skills sharing one question set is the drift
the `FLOW` contract exists to stop, and the artist never experienced them as two
things: they answer questions and get a plan.

## Data

```bash
bun run artist:brief digital-marketing
```

The `Campaign` section reports task progress, how many are **overdue**, and —
load-bearing — whether the plan's stated budget and the tasks' actual sum
**disagree**. The prior build stored a $99,500 total against tasks summing to
$9,781 because nothing checked. The brief now says so, and
[`scripts/reconcile-budget.ts`](./scripts/reconcile-budget.ts) is what fixes it.

The interview writes the brief itself, on `save`, and nothing before it:

```bash
bun run agents/digital-marketing/skills/digital-marketing-plan/scripts/plan.ts next
bun run agents/digital-marketing/skills/digital-marketing-plan/scripts/plan.ts answer <id> <value>
bun run agents/digital-marketing/skills/digital-marketing-plan/scripts/plan.ts why <id>
bun run agents/digital-marketing/skills/digital-marketing-plan/scripts/plan.ts save
```

The content menu, then the tasks it was picked from:

```bash
bun run artist:set marketing_ideas '{"campaign_id":"<uuid>","n":1,"title":"...","hook":"...","format":"reel","category":"behind_the_scenes","effort":"shoot"}' --conflict campaign_id,n
bun run artist:get marketing_ideas campaign_id=<uuid> status=selected --order "n asc"
```

The tasks are written afterward, through the CLI:

```bash
bun run artist:get marketing_tasks campaign_id=<uuid> --order "due_date asc"
bun run artist:set marketing_tasks '{"campaign_id":"<uuid>","sort_order":1,"title":"...","due_date":"2026-09-01"}' --conflict campaign_id,sort_order
```

`--conflict campaign_id,sort_order` is why regenerating a plan **upserts**
instead of deleting: the artist's hand-written captions, task statuses and
content links survive. The old product deleted and re-inserted, and lost them
every time.

Never write SQL and never open the database directly.

Once the tasks are saved, make their Drive folders — one empty folder per thing
the plan asks the artist to make:

```bash
bun run agents/digital-marketing/skills/digital-marketing-plan/scripts/folders.ts <campaign-id>
```

A script, not you: the folder name is derived from the task row, and a name
that comes out differently on the second run is a second folder plus a link the
artist's collaborator can no longer open. Run it after every regeneration — it
is idempotent, and it renames rather than duplicates when a due date moves. It
prints its own line when Google is not connected, which is a normal state and
not an error; nothing else in the plan depends on it.

## Input

| Field | From | Notes |
|---|---|---|
| the answers | `scripts/plan.ts` | eleven or twelve asked; `scripts/questions.ts` is the set |
| the scoped project | `artist.projects` | title, type, street date, budget, lead single — **offered, never re-asked** |
| artist dossier | profile + presskit + memory | genre, metrics, brand colors, catalog |
| the platforms | the answers | bounds every task; groups computed by `format-groups.ts` |
| existing plan + change request | refine mode only | preserve structure; the same rules apply |

**The first six questions are mostly offers.** When the artist scoped the
project with the label manager, `manager-scope-project` wrote title, street
date, budget and lead single to `artist.projects`. `plan.ts` reads them and
offers them back; the artist says yes or gives another. Asking again is the
failure the whole brief layer exists to prevent — and `artist.projects` speaks
`single | ep | album | tour` where this campaign speaks only the three
releases, so the type is **mapped** through `FROM_PROJECT`, never assigned. A
tour project maps to nothing and the artist is asked instead: tour campaigns are
a PRD non-goal.

## Process

1. **Run the interview, one question per turn.** `plan.ts next` prints exactly
   one question with its count; relay it in the staff member's own voice, plain
   text, no markdown, no emojis. Answer with `plan.ts answer <id> <value>`. The
   `#` lines are operator lines — never show them to the artist. Never print the
   whole question set: a form shown to someone having a conversation is the
   thing this replaced.
2. **Never re-ask what was offered.** A `suggested:` line means the answer is
   already known and the artist only has to confirm it. If they ask why a
   question exists, `plan.ts why <id>` answers in the department's own words.
3. **Ask nothing past `anything_else`.** It is the last question and it is never
   skipped — it is where the two weeks the artist is out of the country arrives,
   and a plan that books a shoot inside them gets thrown away rather than edited.
4. **Save the brief when the artist says yes.** `plan.ts save` writes the
   campaign and links it to the project. Nothing is written before that verb.
5. **Propose the content menu — about fifty ideas — and let them pick.** This
   is a gate, not a formality: the plan is built from what they SELECTED, and a
   plan assembled from ideas they never saw proposed is the one that reads
   generic no matter how well it is structured.

   Draw from every one of the eight categories in
   [`content.md`](../../knowledge/content.md), from the
   artist's actual assets in the brief's `What the campaign has to work with`,
   from their genre ([`genre-tactics.md`](../../knowledge/genre-tactics.md)),
   and from the owned surfaces — the smart link page, Genius annotations,
   Spotify for Artists, the newsletter. Be specific and be inventive: a hook
   the audience would actually stop on, not "post about the song". Their own
   story is the richest source there is — use what they told you.

   **Write the ideas before you say the menu exists.** A real turn replied
   "Here's the content menu. Pick by number" and produced nothing, because the
   rows had never been written — an announcement is not a deliverable, and the
   artist cannot tell an empty menu from a forgotten one.

   Write them with `artist_set` into `marketing_ideas` — `n`, `title`, `hook`,
   `format`, `category`, and `effort` (`low` for anything needing no filming,
   `shoot` for anything that does). Then call **`show_ideas`** and print the
   menu as it comes back.

   Ask them to pick by number, to say what they do not want, and to add
   anything of their own — theirs go in with `proposed_by: "artist"`. Record it
   with **`pick_ideas`**. An idea nobody ruled on is not a yes: only `selected`
   rows become tasks.

   Count the `shoot` ideas against `weekly_capacity` before moving on. Five
   hours a week does not survive eight shoots, and saying so while they are
   still choosing is worth more than a plan they abandon.

6. **Warn before regenerating, accurately.** Regeneration upserts on
   `(campaign_id, sort_order)`, so statuses, captions, content links, and
   calendar ids survive. What changes is which task each one hangs off: task 7
   was the launch Reel and is now the pre-save push. Name the tasks whose
   meaning shifts, say that a shorter plan leaves trailing tasks to delete by
   hand, then get confirmation. In refine mode, skip regeneration entirely and
   edit only what was asked.
7. **Anchor the dates.** Target date plus day offsets, computed in the IANA
   timezone stored on the artist's profile (`America/Toronto`, never `EST`). UTC
   math and standard-time abbreviations both put a launch post on the wrong day.
8. **Build the phases** on the arc in
   [`marketing-fundamentals.md`](../../knowledge/marketing-fundamentals.md) — T-28 operations, T-21
   announcement, T-14 angle testing, T-7 urgency, release day, then days 1–7,
   8–21 and 22–28. Pick **one campaign narrative** first and make every task
   serve it; "new single out now" is the absence of a narrative. Where budget,
   time or camera comfort are thin, build the **minimal viable campaign** on
   that page — a real plan at that size, not a worse version of a bigger one.
   The old range was roughly 3–4 weeks before to 1–2 weeks after; the
   branches the interview selected say which task families must exist —
   `presave`, `playlist_pitch`, `launch_event`, `post_release` — and the four
   `ads_*` branches say where the money goes. They do not name the phases; that
   is judgment.
9. **Point the plan at the SMART goal, and say which task serves it.** The
   `success_looks_like` answer is a number with a date on it. Every phase should
   move it, and the tasks that move it most directly get named as such — "this
   is the one that gets you to 200 pre-saves". A plan whose goal appears nowhere
   in its tasks is a plan that measured nothing.

   Suggest a target when the artist has none, and pick from what is documented:
   **200 pre-saves** (where the 40–60% first-week algorithmic lift shows up) or
   **a save rate above 20%** (weighted ~3× above stream count). Never invent a
   stream count as a target — that is promising an outcome nobody controls.

10. **Every plan carries the action tasks, the waterfall, and a content mix.**
   Read [`content.md`](../../knowledge/content.md) before
   writing tasks — it is the vocabulary, and a plan written without it comes out
   structurally correct and creatively empty. Non-negotiable:

   - **The action tasks exist**: pre-save link live 3–4 weeks out, smart link
     and every bio updated at announcement, profiles refreshed, YouTube Premiere
     scheduled if there is a video. The editorial pitch is **press's**, not
     ours — name it as a handoff with its 7-day-before deadline.
   - **The waterfall is the shape**: tease → announce → count down → release day
     → keep going. Not a series of unrelated posts.
   - **One shoot, many posts.** A long video and its vertical cut are TWO
     create tasks. A live session that produces only a YouTube upload is an
     afternoon of filming spent on one post.
   - **Draw from most of the eight categories**, not two. A plan of promotional
     posts is a plan the audience stops looking at.
   - **Two or three low-effort ideas**, and never more create tasks than the
     `weekly_capacity` answer can carry.

11. **Pair every asset, and post it whole.** A create task 1–3 days before its
   post task, and one asset goes live simultaneously on **every** selected
   platform that carries its format. The group is computed, not decided:

   ```bash
   bun run agents/digital-marketing/skills/digital-marketing-plan/scripts/format-groups.ts instagram tiktok youtube_shorts
   ```

   `checkTask(selected, format, platforms)` returns the correction for a publish
   task that ships a subset. A Reel on Instagram only, when TikTok and Shorts
   were selected, is the failure: it reads as three assets where the artist shot
   one. The selected set always contains the four the label plans for —
   Instagram, TikTok, Facebook, YouTube (plus Shorts) — adopted by `offers.ts`
   whether or not the accounts are linked. Never introduce a platform outside
   the selected set.
12. **Open the floors table before naming a single paid tactic.** Not from
   memory — [`paid-promotion.md`](../../knowledge/paid-promotion.md) carries
   every vendor's own published minimum with its source, the eligibility gates,
   and the mechanics. Read it, then decide.

   The three that decide most plans, and the one that gets misremembered:

   | | Published minimum |
   |---|---|
   | **Meta — Instagram and Facebook** | **none.** $5–10/day is a working budget. A $50 campaign runs here. |
   | TikTok Ads | campaign above **$50/day** — out below a few hundred dollars |
   | Spotify Ads Manager | **CA$250** |

   **"There's no budget for ads" is a claim, and it is usually wrong.** A real
   plan was written telling an artist their $50 cleared no ad floor — true of
   TikTok and Spotify, false of Meta, which is the one that mattered. The
   knowledge said so, sourced, and was not opened. Saying a thing is impossible
   is exactly the claim that has to come off a page rather than out of
   recollection.

13. **Allocate the budget, then reconcile it in code.** Decide by judgment which
   tasks deserve the money — spend follows the primary goal (streams, video
   views, followers) and never becomes the strategy on its own. Then run
   [`scripts/reconcile-budget.ts`](./scripts/reconcile-budget.ts) and use what it
   returns. Do not add the costs up yourself.

   **Call the `reconcile_budget` tool** with the campaign id, every time a task
   cost is written or changed. It reads the tasks, applies the campaign's
   budget, writes back only the costs that moved, and sets
   `total_estimated_cost`.

   The same arithmetic is also a script, for a terminal or Claude Code:

   ```bash
   bun run agents/digital-marketing/skills/digital-marketing-plan/scripts/reconcile-budget.ts plan.json 500
   ```

   Pass the budget bare there. `"$500"` is a shell variable — bash expands it to
   `00` and zsh to nothing, so the script refuses anything of that shape. From
   `houselabel` there is no shell, which is why the tool exists: a real campaign
   shipped twenty tasks with a null total because the instruction was a command
   nothing could run.

   It scales an over-budget plan proportionally so the strategy's shape survives,
   settles rounding drift on the largest line item so the sum is exact, zeroes
   every task when the budget is $0, and — when no budget was captured — sets the
   total to the real sum rather than inventing one. `null` and `0` are different
   answers. Run it on **every** path that persists a plan: generation, an
   artist-edited plan, and refinement. Refinement drifts most, because
   "redistribute $X but keep the total at $Y" is asked in prose.

   The prior build asked a model to do this arithmetic and stored a live campaign
   whose total read $99,500 against tasks summing $9,781.

   **A budget offered from the project is the whole release's, not marketing's
   share.** It is a ceiling to spend under, and saying so out loud is the
   difference between a plan the artist can fund and one that eats the pressing.
14. **Re-read every paid line after it returns.** Scaling is proportional and
    checks no product minimums, so a $250 Spotify Ad Studio buy comes back at
    $180 and buys nothing. Drop a line that no longer clears its floor
    ([`paid-promotion.md`](../../knowledge/paid-promotion.md)) and give its
    dollars to one that does. At a $0 budget the script zeroes costs and keeps
    the tasks: rewrite each paid task into its organic equivalent or delete it.
15. **Set posting times** in the artist's timezone. One time per post task,
    taken from the window of the platform in that format group the artist uses
    most; YouTube and YouTube Shorts have no window of their own and inherit.
16. **Validate the enums** on the way out — task types and platform values only
    from the known sets — then materialize the tasks as dated to-dos, persisting
    posting time and estimated cost with each. Compute campaign start/end from
    the earliest and latest task; optionally sync to the artist's calendar as
    all-day events color-coded by task type.

**Before you write the campaign row, check it against the conversation, field by
field.** A real run saved `budget = 0` after the artist had corrected it to $50
mid-interview and been told "fixing that now: budget is $50"; saved
`primary_goal = {streams}` after they said streams *and* followers; and left
`total_estimated_cost` null because the reconciler never ran. Nothing was
broken — the write was composed from what the department believed at the start
instead of what it had been told since.

So, every time, immediately before saving:

| Field | Check |
|---|---|
| `budget` | the LAST number they said, not the project's and not the first one |
| `primary_goal` | an ordered array — every goal they named, most important first |
| `platforms` | the baseline four plus anything linked, minus whatever they removed, mapped to the six stored values |
| `target_date` | theirs, or the project's if they confirmed it |
| `total_estimated_cost` | whatever `reconcile_budget` returned, never a sum you did |
| `success_target` | their SMART goal, in their words, with its number and its date |
| the row itself | an existing campaign for this `project_id`, updated — not a second one |

**Show the plan; never describe it.** Call `show_plan` and print what it returns,
verbatim, before saying anything about it. A real run wrote twenty dated tasks
and then narrated them in a paragraph — "single launch on the 16th, story piece
on the 23rd" — and the artist's reaction was "it didn't output any plan". They
were right: a plan is a list of dated things to work through.

**One campaign per project.** Before creating a campaign, look for an existing
one with the same `project_id` and update that instead. Keying on the title
produced two rows for one EP — `Les heures creuses` and `Les heures
creuses — EP campaign` — because the second run decorated the name.
The title is the artist's; the project link is the identity.

**The sections a finished campaign comes back in**, in this order:

1. Campaign summary
2. Assumptions and missing information — labelled, never silent
3. Release-operations checklist
4. Campaign narrative — one, and never "new single out now"
5. Content pillars
6. The calendar
7. Production briefs for the high-priority pieces
8. Outreach drafts, only if asked, and only as drafts
9. Measurement plan
10. Approval queue — everything that needs the artist's yes before it happens

## Putting it on their calendar

Once the tasks are dated and saved, offer `calendar_sync` — never run it
unasked, and never before the artist has seen the plan.

- **Pass each task's own `artist.marketing_tasks.id`.** That id is what makes a
  second sync update the event instead of creating a duplicate. A fresh id
  every run is how a ten-task campaign becomes thirty calendar entries.
- **Send `active: false` for a task marked done or skipped**, and its event is
  removed. A calendar that still shows finished work is worse than no calendar.
- **Ask which calendar once.** `calendar_list` shows the artist's own; the
  answer is remembered, so nothing asks twice.

## Output

A saved campaign brief — title, project type, target date, platforms, primary
goal, budget, and the link to the project it promotes.

Then a plan carrying a two-sentence summary, total estimated cost, key messages,
and content pillars, then phases whose tasks each have a title, one-sentence
description, task type (create · post · outreach · action · milestone),
platform group, a one-to-two-sentence content brief, day offset from the target
date, estimated cost (0 = organic), and a posting time in the artist's local
timezone.

Materialized as dated to-dos, with campaign start and end computed from the task
range.

## Guidelines

- **Never re-ask what the project already answered.** The offer is there to be
  taken. An artist interrogated twice by two members of the same staff stops
  answering the second one honestly.
- **One language, never mixed.** French if the artist prefers French, English
  otherwise, taken from the profile. Bilingual artists get bilingual *content*
  later; the conversation stays in one language.
- **Never lecture, and never run past three sentences in a turn.** A long reply
  reads as a form.
- **Never skip the closing question**, even when the interview felt complete.
- **Never do the budget arithmetic in prose.** The rule this replaces was
  *"Budget is a hard constraint, not a target"*, and it shipped with no code
  behind it. [`scripts/reconcile-budget.ts`](./scripts/reconcile-budget.ts) is
  the only sum that counts.
- **Never invent a budget.** No budget captured means the total becomes the real
  sum; `null` and `0` are different answers.
- **Never quote a benchmark as a price.** Ad pricing drifts; tell the artist to
  confirm current rates before committing spend.
- **Never hand back a scaled plan as if it were the one requested.** Say what
  came down and what the new total is.
- **Never keep a paid task the budget cannot fund.** A line under its product's
  minimum, or a paid task in a $0 plan, is work the artist cannot do.
- **Never split one asset across post tasks.** `checkTask` decides that, not
  judgment.
