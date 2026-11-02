---
name: platforms-explain-metric
description: >
  Use when the artist asks what a platform number means or why two of them
  disagree — defines the metric, its window, what it excludes, and what the
  magnitude is worth in their country. Triggers on "what are monthly
  listeners", "why do I have more listeners than followers", "is 2 million
  streams gold".
metadata:
  agent: platforms
  status: developed
  greeting: explain what a platform number means
  greeting-fr: t'expliquer ce qu'un chiffre de plateforme veut dire
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# platforms-explain-metric

**Status:** developed — the spec is complete; no code behind it yet.

End the confusion rather than answer around it. Most questions here are really
one question — two numbers that measure different things over different windows
are being read as if they should agree.

## Data

This skill explains rather than reports, so it needs only who is asking:

```bash
bun run artist:brief platforms
```

The `Artist` section carries country and locale, which is what makes a
magnitude mean something — 2 million streams is a different sentence in Canada
than in the US, and the answer is written in the artist's language.

If the artist asks what one of *their* numbers means, the brief's
`Platforms on file` already has it dated. Do not fetch anything: this
department records what the artist reads on their own dashboards and never
calls a platform API.

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| metric named | the artist, this conversation | often named loosely: "listeners", "plays", "views" |
| the comparison behind it | the artist, this conversation | the second number, when the question is really about a gap |
| platform | the artist, or implied by the metric | changes the definition; "views" on YouTube is not "plays" on SoundCloud |
| country | `artist.profile` | selects Music Canada or RIAA for any threshold question |
| the artist's own figures | `artist.platform_latest` | makes the explanation concrete instead of generic |

## Process

1. **Pin the metric to a platform.** "Listeners" means one thing on Spotify and
   nothing precise anywhere else; ask rather than guess when the platform is
   ambiguous.
2. **Give the definition and its window** from
   [`../../knowledge/metric-definitions.md`](../../knowledge/metric-definitions.md),
   with the source link attached.
3. **Say what it does not count.** The exclusion is usually the answer — monthly
   listeners does not count loyalty, followers does not count listening, views
   does not count people.
4. **Name the metric it is being confused with** and put the two side by side
   with their windows, when the question is a gap between numbers.
5. **Ground it in the artist's own figures** from `artist.platform_latest` when
   any are on file, so the definition lands against their situation.
6. **Answer a magnitude question in the artist's country.** A threshold question
   ("is that gold?") is answered from the Music Canada or RIAA table, named as
   such, with the stream-to-unit ratio shown.
7. **Stop at the definition.** What to do about the number belongs to the
   Digital Marketing Agent; what it is worth in royalties belongs to the Rights
   Manager.

## Output

The definition in one or two sentences, its window, and its source link. Where
the question was a gap, a two-row table putting both metrics against their
windows, followed by one line saying whether the gap is normal.

Threshold answers name the certifying body and the country explicitly, show the
ratio used, and state that certifications count units in that country.

When the artist has figures on file, one line applies the definition to them.
When they have none, the explanation stands alone and says so.

## Guidelines

- **Every definition carries its source URL.** A remembered definition is the
  failure mode this department exists to fix.
- **Never state a threshold without its country and certifying body.** Gold is
  40,000 units in Canada and 500,000 in the United States; an unqualified
  "gold" is wrong in one of the two.
- **Never convert streams into money.** Spotify "does not pay artist royalties
  according to a per-play or per-stream rate"
  ([Spotify](https://support.spotify.com/us/artists/article/royalties/));
  payout questions route to the Rights Agent.
- **Never treat a follower gap as a problem.** Most listeners arrive through
  programming and never follow, and telling an artist their ratio is bad
  invents a standard nobody published.
- **Never explain a metric this department cannot see** as though it could —
  reach and impressions are real metrics that live only in the artist's own
  dashboard.
