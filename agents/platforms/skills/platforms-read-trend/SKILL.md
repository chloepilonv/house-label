---
name: platforms-read-trend
description: >
  Use when the artist asks how they're doing or whether something worked —
  computes deltas between the readings that actually exist, names sampling gaps
  and rounding artifacts, and reports the change without claiming its cause.
  Triggers on "how am I doing", "did that campaign work", "am I growing".
metadata:
  agent: platforms
  status: developed
  greeting: read how your numbers are moving
  greeting-fr: lire comment tes chiffres évoluent
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# platforms-read-trend

**Status:** developed — the spec is complete; no code behind it yet.

Turn a stored series into a sentence the artist can trust. The arithmetic is
easy and the restraint is the skill: almost every question here arrives already
containing the conclusion the artist wants confirmed.

## Data

```bash
bun run artist:brief platforms
```

`Readings available` counts the rows per platform, and that count decides
whether there is a trend to read at all. **One reading is not a trend** — the
brief says so per platform, and the honest answer is the number plus that
caveat, not a narrated direction.

The series itself, and the computation:

```bash
bun run artist:get platform_stats platform=spotify --order "date desc" --limit 12
bun run agents/platforms/skills/platforms-read-trend/scripts/compute-trends.ts --days 30
```

That script owns the rule prose cannot hold: **a change smaller than the
platform's own rounding is not a change.** Instagram reports "89K" above ten
thousand; two readings a week apart both say 89K whether the artist gained
nobody or gained 900. Run it rather than subtracting the numbers yourself.

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| platforms and window asked about | the artist, this conversation | "last month", "since the video" — resolved to dates before anything is computed |
| the series | `artist.platform_stats` | one row per platform per day, every metric nullable |
| current figures | `artist.platform_latest` | the newest reading per platform, including platforms never read |
| what the artist did | the artist, this conversation | context they volunteer; never treated as established cause |
| milestones already announced | `artist.memory` | so a threshold crossed months ago is not re-announced |

## Process

1. **Resolve the window to two real dates.** Find the readings that actually
   bracket the requested window; if none do, use the nearest ones that exist and
   report those dates rather than the requested ones.
2. **Refuse to compute on one point.** A platform with a single reading gets a
   current figure and the sentence that a trend needs a second reading — not a
   delta against zero.
3. **Compute the delta per metric** — absolute and percentage — between the two
   dates found, skipping any metric null at either end. Deterministic and
   repeated across every run: this is the half that belongs in `scripts/` once
   the department reaches `beta`.
4. **Measure the actual gap in days** between the two readings and carry it into
   the output beside every delta computed from them.
5. **Flag the artifacts** from
   [`../../knowledge/reading-a-trend.md`](../../knowledge/reading-a-trend.md):
   a cumulative metric that fell, a YouTube plateau inside the rounding step, a
   series crossing 2025-03-31, a 28-day window decaying after a spike.
6. **Check milestone thresholds** against the newest figure, announce only ones
   absent from `artist.memory`, and record what was announced.
7. **Write the read.** State what moved, over which real dates, and stop before
   the cause. Where the artist has offered context, put it as a question they
   can answer, never as an attribution.

## Output

A per-platform table — metric · earlier reading · later reading · change ·
percent · days between. Metrics null at either end appear as "—", labelled *not
reported*, and are excluded from every calculation.

Under it, the artifacts that fired, each in one line naming what it is rather
than what it looks like. Then a two-to-four-line plain-language read of what
moved, and any milestone reached for the first time.

Platforms with one reading show that reading and the sentence that a second is
needed. Platforms with none are listed by name so the artist knows what is
missing.

## Guidelines

- **Never claim a cause.** No control group, no attribution, and no per-source
  breakdown exists here; a campaign and a playlist add in the same week are
  indistinguishable in this data.
- **Never project forward.** A rate extrapolated to a year is an invention, and
  it is the sentence the artist will remember.
- **Never compare across platforms as if the metrics matched.** Spotify monthly
  listeners and Instagram followers do not share a unit.
- **Never treat a rounded YouTube figure as precise.** Movement smaller than the
  rounding step is invisible, so "no change" is not evidence of no change.
- **Never present the requested window when a different one was measured.** The
  two dates used are shown every time.
- **Never re-announce a milestone.** The record of what has been announced is in
  `artist.memory`, and re-crossing a threshold is not news.
