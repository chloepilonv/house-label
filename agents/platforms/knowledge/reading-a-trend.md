---
name: reading-a-trend
description: >
  Answers "am I growing" and "did it work" honestly — the four artifacts that
  fake a trend (rolling windows, rounded counts, changed definitions, irregular
  self-reporting), the rules for a series the artist typed in, and the line
  between reporting a change and claiming its cause.
metadata:
  agent: platforms
  status: developed
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "2.0"
---

# Reading a trend without inventing one

A delta is arithmetic. A trend is a claim, and most claims a self-reported
series can support are weaker than they look.

## Four artifacts that are not growth

| Artifact | Looks like | Actually is |
|---|---|---|
| Rolling window | a decline three weeks after a placement | Spotify's 28-day window dropping the placement out ([Spotify](https://support.spotify.com/us/artists/article/audience-segments-on-spotify/)) |
| Rounded count | a flat month on YouTube or Instagram | movement smaller than the display step — up to 99 subscribers at `12.3 K` ([YouTube](https://support.google.com/youtube/answer/6051134)) |
| Changed definition | a step up in YouTube views around 2025-03-31 or 2026-08-24, or Instagram "views" replacing "impressions" in 2025 | the platform redefining the metric ([YouTube Data API](https://developers.google.com/youtube/v3/docs/channels), [Meta](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/insights/)) |
| Irregular sampling | a huge jump | two readings 44 days apart compared as if adjacent |

- **Cumulative metrics cannot fall.** Followers, subscribers and total views
  only rise; a drop in the series is a reporting error and gets queried, not
  charted.
- **A change smaller than the rounding step is not a change.** Two readings of
  "89K" a week apart say nothing about the 999 followers between them; a
  rounded reading carries its step, and the comparison is only as fine as the
  coarser of the two.
- **A series crossing a definition date is two series.** Name the date; never
  bridge it.

## Rules for a self-reported series

The artist reads their dashboard and reports it — see
[`public-data-boundary.md`](./public-data-boundary.md). Accurate, irregular.

- **Compare the two dates that exist and name them.** Never present a delta as
  if it covered the window the artist asked about.
- **A retyped number can be wrong.** An implausible jump is confirmed before it
  becomes a milestone.
- **"About 4k" is recorded with its uncertainty**, not tidied to 4,000.
- **Null is not zero.** An unreported metric stays unreported in every
  calculation.
- **Two points is a delta, not a trend.** No platform or funder publishes a
  minimum sample for artist stats; the house rule is three readings spanning at
  least the metric's own window — 28 days for Spotify monthly listeners — before
  a direction is stated. What a normal week-over-week move looks like for an
  emerging artist is not published anywhere; no baseline exists to flag an
  abnormal one against.

## Reporting a change versus claiming a cause

- **A number moving is a fact; why it moved is an inference.** State the first,
  offer the second only as a question the artist's own context can settle.
- **Nothing in a self-reported series can establish a cause.** No control group,
  no attribution, no per-source split — a campaign and a playlist add in the
  same week are indistinguishable here. Source-of-streams lives only in the
  artist's dashboard.
- **Correlated platforms usually share a cause**; one is not driving the other.
- **Never extrapolate.** A weekly rate projected to a year is an invention the
  artist will remember better than the caveat.
- **A milestone fires once, on the exact dashboard figure the artist reported,
  never on a rounded public one.** Crossing 1,000 or 10,000 is worth naming;
  re-announcing it is noise, which is why announced milestones are kept in
  memory.

## Country

Windows, rounding and definitions are set globally by the platforms; nothing
above differs between Quebec, Canada and the United States. What a magnitude is
*worth* does — Music Canada certifies Gold at 40,000 units, the RIAA at
500,000 — and lives in [`metric-definitions.md`](./metric-definitions.md).
