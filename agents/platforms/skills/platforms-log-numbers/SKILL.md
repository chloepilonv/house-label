---
name: platforms-log-numbers
description: >
  Use when the artist reports figures they read on their own dashboards —
  records a dated, self-reported snapshot per platform, leaves unreported
  metrics blank, and never fetches anything. Triggers on "here are my numbers",
  "I'm at 4,000 monthly listeners", "log this month's stats".
metadata:
  agent: platforms
  status: developed
  greeting: record the numbers you read on your dashboards
  greeting-fr: noter les chiffres que tu lis sur tes tableaux de bord
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# platforms-log-numbers

**Status:** developed — the spec is complete; no code behind it yet.

Get a number the artist read onto the record with the right date, the right
column, and no companions invented around it. Nothing here reaches a platform:
the artist is the sensor, and this skill is the notebook.

## Data

```bash
bun run artist:brief platforms
```

`Platforms on file` says when each was last read, so a number the artist just
reported can be dated against the previous one. A platform added but never read
shows as `NEVER READ` — a real state, not a zero.

Record identity once, numbers per day:

```bash
bun run artist:set platforms '{"platform":"spotify","url":"https://...","handle":"@leonie"}' --conflict platform
bun run artist:set platform_stats '{"platform":"spotify","date":"2026-08-27","monthly_listeners":4200,"source":"manual"}' --conflict platform,date
```

`--conflict platform,date` is what makes a second reading on the same day
overwrite instead of adding a duplicate row.

**A metric the artist did not report stays absent.** Null means "not reported";
writing 0 claims it was measured as nothing, and every trend downstream then
reads that as a collapse.

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| numbers reported | the artist, this conversation | one or more metrics per platform, as read from their own dashboard |
| platform | the artist, or inferred from the metric | must be one of the twelve `artist.platforms` accepts; monthly listeners implies Spotify, subscribers implies YouTube |
| observation date | the artist, defaulting to today | the date the artist *read* the number, never the date they mentioned it |
| profile URL and handle | the artist | required only when the platform has no `artist.platforms` row yet |
| platforms on file | `artist.platform_latest` | what is already connected, and the last figure recorded for each |
| country | `artist.profile` | decides which certification table a milestone is measured against |

## Process

1. **Resolve the platform.** Match what the artist said against the twelve
   values `artist.platforms` permits. An unrecognised platform is named back to
   them rather than mapped onto the nearest one.
2. **Create the identity row if it is missing.** A first-time platform needs its
   public `url` before any figure attaches to it; ask for the profile link, not
   for numbers we could not use anyway.
3. **Map each reported figure to its own column** — `monthly_listeners`,
   `followers`, `subscribers`, `total_views`, `total_plays`, `total_streams` —
   using the definitions in
   [`../../knowledge/metric-definitions.md`](../../knowledge/metric-definitions.md).
   Anything without a column goes in `extra`.
4. **Leave every unreported metric null.** Null means "not reported" and zero
   means zero; the two are never interchanged.
5. **Set `source` to `manual`.** Every figure this skill handles is
   self-reported, and the column exists to say so.
6. **Check the figure against the last one on file.** A cumulative metric that
   fell, or a jump large enough to look like a typo, is queried before it is
   recorded — see
   [`../../knowledge/reading-a-trend.md`](../../knowledge/reading-a-trend.md).
7. **Upsert on `(platform, date)`.** A second reading for a date the artist
   already reported replaces it; it never becomes a second row.
8. **Confirm what landed**, metric by metric, and say which platforms are still
   waiting on a reading.

## Output

A short confirmation table — platform · metric · value · date — listing only
what the artist actually reported. Metrics not reported appear as "—" with the
word *not reported*, never as 0.

Below it, one line naming any platform on file with no reading for this date,
and, when a first-time platform was added, the URL now on record.

When a figure was queried at step 6, the confirmation says it is held pending
the artist's answer rather than showing it as recorded.

## Guidelines

- **Never fetch a number.** Three of the four major platforms disallow our
  crawler outright and the fourth rounds its only public figure — the evidence
  is in
  [`../../knowledge/public-data-boundary.md`](../../knowledge/public-data-boundary.md).
  Offer to say where the artist can read it instead.
- **Never derive one metric from another.** Followers cannot be inferred from
  monthly listeners, and streams cannot be inferred from listeners.
- **Never round or tidy a reported figure.** "About 4k" is recorded as the
  artist's own uncertainty, not silently written as 4,000.
- **Never date a reading to today when the artist read it earlier.** The
  observation date is what makes a delta honest.
- **Never claim a figure was written to a database.** This department has no
  runtime yet; the confirmation describes what was captured in the conversation.
- **Never celebrate a milestone here.** Recognising one is
  [`platforms-read-trend`](../platforms-read-trend)'s job, and it needs the
  series this skill is still building.
