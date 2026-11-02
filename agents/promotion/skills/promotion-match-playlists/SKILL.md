---
name: promotion-match-playlists
description: >
  Use when the artist wants to be on playlists — ranks catalog playlists against
  the release, split by how you actually get in: the platform's editorial form,
  an independent curator, or an algorithm that cannot be pitched at all.
  Triggers on "which playlists should I pitch", "how do I get on Spotify
  editorial", "can I get on Discover Weekly", "is it too late to pitch".
metadata:
  agent: promotion
  status: beta
  mode: task
  greeting: find the playlists worth pitching, and say how each one is entered
  greeting-fr: trouver les playlists à cibler, et comment on entre dans chacune
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# promotion-match-playlists

The playlists worth the artist's release week, grouped by the door they open —
because the three doors need different work at different times and one of them
does not open at all. Kept apart from the radio skill because the clock is
different: an editorial pitch closes seven days before release, where a radio
campaign has already been running for weeks.

## Data

**The catalog is ours, read-only, and ships as one file** —
`data/catalog/catalog.sqlite`, rebuilt every Monday. Read it with the query
script (`uv` runs it, and fetches a Python if the machine has none — works in
Claude Cowork, Desktop and Claude Code alike):

```bash
uv run data/catalog/query.py playlists --genre folk --language fr      # lists, curator type, route
uv run data/catalog/query.py pitch-services                             # SubmitHub, Groover… with prices and risks
```

`--where col=value`, `--q <text>`, `--columns all`, `--json` cover the rest;
`uv run data/catalog/query.py --datasets` lists what the file holds. It holds
desks, never a person: the person behind a desk comes from the artist's own
Hunter key or from reading the outlet's contact page for them.

The artist's file, already shaped for this department:

```bash
bun run artist:brief promotion
```

The brief carries the focus release and its date, the artist's language and
genre, and which playlists have already been pitched. The days-until-release
figure decides which door is still open, and the focus-release rule lives in
[`data/artist/brief/rules.ts`](../../../../data/artist/brief/rules.ts).

Anything the brief does not carry, and the writes this skill makes:

```bash
bun run artist:get releases id=<release-id>
bun run artist:set promotion_targets '{"target_id":"spotify-editorial","kind":"playlist","status":"shortlisted"}' --conflict target_id,release_id
bun run artist:remember promotion editorial-pitched "one song per release; used on <title> 2026-11-05"
```


`artist:set profile` is refused — the artist owns that row and edits it with
`houselabel profile`.

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| focus release + date | `artist:brief promotion` | **the deciding input.** Days-to-release opens or closes the editorial door |
| language · genre | `artist:brief promotion` → profile | a French-language record is pitched differently, and says so in the pitch |
| playlists | catalog, `promotion_playlists` | carries `submission_route`, `accepts_prerelease` and `lead_time_days` |
| services | catalog, the services table | costs the `groover` and `submithub` routes |
| already pitched | `artist:brief promotion` → `promotion_targets` | the editorial pitch is one song at a time — a live pitch blocks the next |

## Process

1. **Compute days to release.** No release date means the editorial door cannot
   be assessed at all — say that plainly and rank only the independent tier.
2. **Split the results into the three doors** before ranking anything:
   editorial, independent, and algorithmic. Algorithmic is listed to be
   explained and is never presented as a target.
3. **Check the editorial window.** Under 7 days to release, the Spotify pitch is
   closed for this release — say so, give the date it closed, and do not offer
   it. Check whether a pitch is already in flight; only one is allowed at a time.
4. **Rank the independent tier by fit, not by follower count**, and mark each
   one's route — direct, `groover`, or `submithub` — with that route's cost.
5. **Warn on anything selling placement.** Any row flagged `sells_placement`
   carries the artificial-streaming warning verbatim, whether or not the artist
   asked.
6. **Say what is missing.** A playlist with no published route prints
   **unknown**; a claimed playlist we could not confirm is not printed at all.

## Output

Three blocks, in the order the artist should act on them:

```
PLAYLISTS FOR "<release title>" — release 2026-11-14, 72 days out

EDITORIAL — the platform's own editors. Closes 2026-11-07.
  Spotify for Artists     OPEN, 65 days left     free     one song at a time
    ↳ no pitch in flight. Be specific about sound, mood, instruments, influences.
  Apple Music             no self-serve route — goes through the distributor
  Deezer                  Label/Provider accounts only — through the distributor

INDEPENDENT — a person. Pitch at release week, they need a live link.
  <name>                  Groover        €2 (2 Grooviz)   FR curators
  <name>                  direct email   free

ALGORITHMIC — not pitchable. Release Radar responds to pitching early;
Discover Weekly responds to listeners. Nobody can sell you either.
```

- **The editorial block always states its closing date**, computed from the
  release date, not described in words.
- **A closed window says closed.** It is never softened into "you could still
  try".
- **Unconfirmed playlists are omitted, not guessed.** See the open questions in
  [`knowledge/playlist-pitch.md`](../../knowledge/playlist-pitch.md).

## Guidelines

- **Never invent a playlist, a curator, a follower count or an acceptance
  rate.** Every row comes from a catalog row.
- **Never promise algorithmic placement, and never let a service promise it
  either.** State what it responds to and stop.
- **Never buy streams, and say why every time it comes up** — royalties
  withheld, tracks removed from counts and charts, placements pulled, and a
  per-track charge to the distributor since 2024-04-01. The penalty lands on
  the artist.
- **Quote Groover's answer rate as an answer rate.** It is the share of curators
  who reply, never a chance of being added.
- **The mechanics, lead times and warnings live in
  [`knowledge/playlist-pitch.md`](../../knowledge/playlist-pitch.md)
  and [`knowledge/playlist-pitch.md`](../../knowledge/playlist-pitch.md).** Link
  them rather than restating the numbers.
- **The editorial pitch is spent once per release.** Before recommending it,
  check that it has not already been used.
