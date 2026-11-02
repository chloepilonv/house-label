---
name: press-run-campaign
description: >
  Use when the artist wants to know what to do now or to log where outreach
  stands — computes the current release-timeline stage from the date and
  markets, tracks each contact through the pitch pipeline, and enforces the
  two-follow-up cap. Never sends.
metadata:
  agent: press
  status: developed
  greeting: tell you where your press campaign stands and what to do now
  greeting-fr: te dire où en est ta campagne de presse et quoi faire maintenant
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# press-run-campaign

**Status:** developed — the spec is complete; no code behind it yet.

Drive a release from "what should I do this week?" to coverage: place the artist
on the timeline, tell them the next concrete action and which contact segment to
work, record sends and outcomes honestly, and stop follow-ups before they become
spam.

## Data

Where the pipeline stands, already counted:

```bash
bun run artist:brief press
```

The `Campaign` section gives the release date the timeline stage is computed
from, the markets, and the pipeline broken down by status. If it reports any
`opened` pitches it also warns that nothing sets that status — never turn it
into an open rate.

Per-pitch detail, and the moves:

```bash
bun run artist:get press_pitches campaign_id=<uuid> status=pitched
bun run artist:set press_pitches '{"id":"<uuid>","status":"responded","responded_at":"..."}' --conflict id
bun run artist:set press_campaigns '{"id":"<uuid>","status":"archived"}' --conflict id
```

`follow_up_count` caps at 2 in the schema, so a third follow-up is refused by
the database, not by good intentions.

Facts worth keeping that have no column — who holds the premiere, a standing
contact relationship, an angle the artist rejected:

```bash
bun run artist:remember press premiere_holder "Le Devoir, embargo 2026-09-10"
```

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| release date | `artist.press_campaigns` | weeks-until-release drives the stage; treat as a **date**, not a timestamp |
| target markets | artist | quebec (default) / canada / united_states, multi-select — filters the guidance |
| pipeline state | `artist.press_pitches` | per-contact status, `sent_at`, `responded_at`, `coverage_url`, follow-up count |
| status transitions | artist | mark sent, responded, coverage (+ URL), declined; notes |

## Process

1. **Compute the stage** from weeks until release: `>7` prepare (presskit,
   press release FR then EN, one non-expiring advance link) · `7–3` pitch press
   — national music press and dailies first, blogs from week 4 · `≤2` and after
   → follow-up, release-day roundups, post-release. Radio and playlists are not
   stages here: when the artist asks, hand off to `promotion` and say so. The
   release date is a calendar date; a timezone shift here moves the artist into
   the wrong stage.
2. **Show where they are** with that stage's checklist and external links,
   filtered to the target markets, and name the one contact segment to work
   next. Lead times and what each outlet type wants come from
   [`../../knowledge/press-fundamentals.md`](../../knowledge/press-fundamentals.md);
   a publicist's price is stated as unpublished, never as a number.
3. **Record sends only on the artist's word.** On "mark sent", write an
   `artist.press_pitches` row with `pitch_type` mapped from the contact type and
   `sent_at` set.
4. **Advance status explicitly**: not_pitched → pitched → responded → coverage |
   declined. Log `coverage_url` and notes as they arrive. `opened` is in the
   enum and inert — nothing sets it, so it is never a step in this ladder.
5. **Find the follow-up candidates**: contacts at `status = pitched` whose
   `sent_at` is more than **14 days** old. Draft one short follow-up each. The
   threshold is a house number, not a sourced one; journalists ask for one
   follow-up, 5–7 business days out — see
   [`../../knowledge/press-writing.md`](../../knowledge/press-writing.md).
6. **Stop at two follow-ups.** Increment `follow_up_count` on each draft; the
   schema caps it at 2. A contact already at 2 gets "move on", not a third
   draft.

## Output

**Timeline guidance** — the current stage highlighted ("You are here") with its
checklist and links, plus which contact type to work next. The stage boundaries
above are this skill's own convention; the lead times behind them are in
[`../../knowledge/press-fundamentals.md`](../../knowledge/press-fundamentals.md).

**Pipeline state** — each contact's status with a sent/total progress bar
reflecting the current filter, plus logged coverage URLs and notes.

**Follow-up drafts** — one short message per stale contact: "Hi [name], just
following up on [song] I sent on [date]. Here's the link again: [link]" /
"Bonjour [nom], je fais suite à [chanson] envoyé le [date]. Voici le lien à
nouveau : [lien]".

## Guidelines

- **Never report an open rate.** There is no open tracking, so any number
  presented as one is invented.
- **No other skill moves status.** Drafting or composing is not sending, and a
  pipeline that advances on its own is one the artist can't trust when deciding
  who to follow up.
- **Never invent a date.** A pitch with no `sent_at` is undated, not overdue.
- **Key history to the real release**, not a per-campaign pseudo-id, so coverage
  logs stay clean when an artist runs several campaigns for one record.
