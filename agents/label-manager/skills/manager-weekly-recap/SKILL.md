---
name: manager-weekly-recap
description: >
  Use when the artist asks what they got done, what is due this week, wants
  the plan as a sheet they can tick, or the Monday email — builds the Plan
  sheet in the release folder (task · date · department · link · status),
  puts every task on the calendar, and writes one recap of last week's ticked
  items, this week's steps day by day, the late ones, the numbers' movement and
  one earned line; `--send` mails it to the artist's own address, `--schedule`
  makes it every Monday. Triggers on "what did I do last week", "what's due",
  "give me the plan as a sheet", "send me the recap", "email me every Monday".
metadata:
  agent: manager
  status: beta
  greeting: keep your plan sheet current and send you your Monday recap
  greeting-fr: tenir ta feuille de plan à jour et t'envoyer ton récap du lundi
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# manager-weekly-recap

**Status:** beta — all of it is code. [`scripts/items.ts`](./scripts/items.ts)
gathers every dated thing from four places, [`scripts/plan-sheet.ts`](./scripts/plan-sheet.ts)
is the sheet the artist ticks, [`scripts/plan-calendar.ts`](./scripts/plan-calendar.ts)
puts each task on the calendar, and [`scripts/recap.ts`](./scripts/recap.ts)
does the date arithmetic and writes the email. Nothing in it is improvised,
because it is read every Monday for months and one forgotten deadline ends
the habit.

## Data

```bash
houselabel recap                 # print this week
houselabel recap --sheet         # rebuild the Plan sheet and the calendar, send nothing — also runs after `plan.ts --save`
houselabel recap --send          # sheet + calendar, then email it to the connected Google account (asks for the send permission once)
houselabel recap --schedule      # every Monday 08:00 on this machine (launchd on macOS, a crontab line elsewhere)
houselabel recap --unschedule    # stop
houselabel recap --today=2026-10-26   # a reproducible week
```

Four sources, read and never written:

| Source | Where | Shape |
|---|---|---|
| the artist's priorities | label-manager memory `priorities` | `[{title, owner?, due, note?, link?, replaces?, done?}]` — `replaces` hides the plan steps a priority stands in for |
| the plan's milestones | `artist.project_milestones` | dated from the street date at read time; the link is the page the date came from |
| the campaign's tasks | `artist.marketing_tasks` | dated by digital-marketing; the link is the content |
| each department's own list | memory `todo` on that department | `[{title, due, note?, link?, done?, id?}]` |

A department adds its concrete work under a checkpoint with one write:

```bash
bun run artist:remember promotion todo '[{"title":"Lyrics on Musixmatch Pro","due":"2026-10-31","link":"https://pro.musixmatch.com"}]'
```

`--send` needs the Gmail **send** permission, which `houselabel connect google`
does not ask for. The command asks for it itself, says why, and the mail goes
to the connected account only — never to anyone else. No department has a tool
that sends mail; this is a command the artist runs or schedules.

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| the whole recap | [`scripts/recap.ts`](./scripts/recap.ts) | **run it.** Never assemble a recap from prose or from memory |
| the Plan sheet | `Plan — <project>` in the release folder | Date · Action · Agent · Status · Source (+ a hidden key). Agent is the department folder, `label-manager` when none owns it. The artist's Status wins both ways: "Done" ticks a task off, "To do" brings one back, "Won't do" drops it from the email and the calendar. Read back before every rewrite, so a tick survives every Monday |
| the calendar | the label's own Google Calendar | milestones as `[OWNER]` events (manager-plan-release), every other task as one all-day `[DEPARTMENT]` event; a ticked task leaves |
| who and in which language | `artist.profile` | `artist_name`, `preferred_locale`; the mail goes to the connected Google account |
| the numbers | `artist.platform_stats` | the two newest readings per platform; the delta is between them |

## Process

1. **Run [`scripts/recap.ts`](./scripts/recap.ts)** and relay what it prints.
   "Due this week" is a date between Monday and Sunday; "late" is an open
   step whose **last** honest day has passed — a window still open is not
   late; "done last week" is a status that flipped in the seven days before
   Monday. A model asked to do this from a table misses one every time.
2. **`--sheet` whenever the plan or a department's list changed.** A saved
   plan runs it by itself. The sheet is where the artist ticks; the email
   reads the sheet.
3. **Offer `--send` and `--schedule` once**, when the artist likes the first
   one. An artist who never asks for the email never grants the permission.
4. **When something in it is wrong — a step done but not ticked — fix the
   source, not the recap.** The sheet's Status, the department's `todo`, or
   the plan in [`manager-plan-release`](../manager-plan-release). The recap
   only reads.
5. **Scheduling runs on the artist's machine**, because their data lives
   there. A laptop asleep on Monday at 08:00 sends on wake; a desktop that is
   off sends nothing. Say which one the artist has.

## Output

```
Your week at the label — Oct 26

Hi Mireille Caron,

Last week you got 1 thing done.
  ✓ Press release finished  (Press Agent)

This week (Oct 26 – Nov 1):
  Wed 28    Pitch CISM  (Promotion)
            https://cism893.ca/
  Fri 30    Upload to distributor  (Distribution)
  Sat 31    Lyrics on Musixmatch Pro  (Promotion) ★

1 thing is late:
  Thu 15    Book the launch room  (You)

Your numbers:
  Spotify 1,240 monthly listeners (+85 since Oct 12)
  Instagram 2,310 followers

The single comes out Oct 30 — 4 days.
The EP comes out Nov 13 — 18 days to go.

You are moving. Take the oldest late item first — the rest follows.

— your label
```

The email is the same, as a page: the artist's name, chips for the countdowns
and the week's count, buttons to the Plan sheet, the release folder and the
Drive, the week day by day, the late list in red, next week's first eight.

- **Every date is a day, never an offset.** `W-2` is how the plan is stored.
- **Every line names its owner the way the artist hears it** — "Press Agent",
  not `press`; the artist's own lines say "You".
- **A link on the line when there is one** — the form, the page, the content.
- **The encouragement is chosen by what happened**, in this order: release
  week, just released, five or more done, a clean week, some progress, an
  empty week with late items, a short list, nothing urgent. Never random,
  never flattering about a week that was not.
- **Nothing is padded.** No numbers logged means no numbers section; no project
  means one sentence pointing at the label manager.

## Guidelines

- **Never compose the recap by hand.** Even "just this once" — the first
  hand-made recap is the one that skips the late item.
- **Never send to anyone but the artist.** The recipient is the connected
  account and is not a parameter; "send it to my manager" is a forward the
  artist does from their inbox.
- **Never change a status from here.** The sheet and the departments own
  statuses; reading is the whole job.
- **Never make a second sheet.** `Plan — <project>` is found by name in the
  release folder; a renamed copy is a second truth the artist ticks in vain.
- **Never promise a cron it cannot keep.** The schedule lives on this machine.
