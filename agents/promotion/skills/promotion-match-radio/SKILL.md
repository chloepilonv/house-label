---
name: promotion-match-radio
description: >
  Use when the artist wants their record on the radio — ranks catalog stations
  against the release and profile, and names for each one how it is reached and
  what that route costs. Prepares the shortlist; never submits.
  Triggers on "how do I get on the radio", "which stations should I send this
  to", "who plays francophone pop", "is commercial radio worth it for me".
metadata:
  agent: promotion
  status: beta
  mode: task
  greeting: find the radio stations worth sending your record to
  greeting-fr: trouver les radios à qui envoyer ton disque
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# promotion-match-radio

The shortlist of stations that might play this record, in the order worth
working, each carrying the route in and the price of that route. It exists apart
from the playlist skill because a station is chosen on format, territory and
quota, where a playlist is chosen on genre, mood and release date — and because
a radio campaign starts weeks before an editorial pitch does.

## Data

**The catalog is ours, read-only, and ships as one file** —
`data/catalog/catalog.sqlite`, rebuilt every Monday. Read it with the query
script (`uv` runs it, and fetches a Python if the machine has none — works in
Claude Cowork, Desktop and Claude Code alike):

```bash
uv run data/catalog/query.py radio --country CA --region QC            # stations, their route and quoted rules
uv run data/catalog/query.py radio --q cism --columns all
```

`--where col=value`, `--q <text>`, `--columns all`, `--json` cover the rest;
`uv run data/catalog/query.py --datasets` lists what the file holds. It holds
desks, never a person: the person behind a desk comes from the artist's own
Hunter key or from reading the outlet's contact page for them.

The artist's file, already shaped for this department:

```bash
bun run artist:brief promotion
```

The brief carries the focus release, the artist's country, province and
language, and which stations have already been pitched. The focus-release rule
lives in [`data/artist/brief/rules.ts`](../../../../data/artist/brief/rules.ts),
which is why two runs pick the same record.

Anything the brief does not carry, and the writes this skill makes:

```bash
bun run artist:get releases id=<release-id>
bun run artist:set promotion_targets '{"target_id":"cism-893","kind":"radio","status":"shortlisted"}' --conflict target_id,release_id
bun run artist:remember promotion pitched-cism "sent 2026-09-14, no reply yet"
bun run artist:get contacts kind=radio
```

`artist.contacts` holds the music director behind a station's desk address,
found with the artist's own Hunter key — shared with `press`.


`artist:set profile` is refused — the artist owns that row and edits it with
`houselabel profile`. If they mention something that belongs there, say it has
been noted and point them at the command.

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| focus release | `artist:brief promotion` | title, date, type, language. No date means the timing half cannot be computed — say so, still rank |
| country · province | `artist:brief promotion` → profile | gates the whole strategy; CA and US never blend |
| language | `artist:brief promotion` → profile | a French-language record has a second quota working for it |
| genre | `artist:brief promotion` → profile | matched against each station's stated fit |
| stations | catalog, `promotion_radio_stations` | the only source of a station; never invent one |
| services | catalog, the services table | supplies the cost of each route |
| already pitched | `artist:brief promotion` → `promotion_targets` | a station pitched for this release is excluded, not re-ranked |

## Process

1. **Gate on country.** Read `profile.country`. A Canadian artist is ranked
   against the quota; an American artist has no quota to lean on and the order
   changes. Never produce one list for both.
2. **Gate on the release.** Read the focus release. If `release_date` is null,
   say so once, skip every timing claim, and continue — a shortlist without
   dates is still useful.
3. **Rank the community and campus tier first, then commercial.** For a
   Canadian artist this is the quota's consequence, not a preference; state the
   reason once with the figure from
   [`knowledge/radio-pitch.md`](../../knowledge/radio-pitch.md).
4. **Attach the route to each station.** Read the station's own `submission_*`
   fields. Where the station publishes no route, print **unknown** — never
   substitute a general address as though it were a music channel.
5. **Attach the cost of that route.** A station reachable through a paid
   delivery service carries that service's price and its verification date. A
   station reachable directly carries **free**.
6. **Drop what was already pitched for this release**, and say how many were
   dropped and why.
7. **Offer to find the music director.** For shortlisted stations whose only
   address is a desk (`info@`, `programmation@`) or none, and Hunter is
   connected: call `hunter_quote` (free), then ask in one sentence with the
   cost it returned — "Want me to use Hunter to find the music directors at
   these 5 stations? About 5 of your 50 credits." Call `hunter_find_contacts`
   only after a yes. Not connected: mention `houselabel connect hunter` once
   and carry on. A person found in `artist.contacts` replaces the desk address.

## Output

A ranked table, strongest first:

```
STATIONS FOR "<release title>" — <n> found, <n> already pitched (excluded)
Canada · francophone pop · release 2026-11-14 (72 days out)

  #  Station          City        Tier       Route                    Cost
  1  CISM 89,3        Montréal    campus     musique@cism893.ca       free
                      ↳ MP3 320 with clean metadata; WeTransfer OK; no CDs
  2  CHYZ 94,3        Québec      campus     !earshot Distro          $7.00 CAD + tax
                      ↳ also musique@chyz.ca directly, free
  3  CKCU 93.1        Ottawa      campus     UNKNOWN — no route published
```

- **Every station names its source row.** A station with no catalog row does not
  appear in this table.
- **A missing route prints `UNKNOWN`**, never a guess and never a general
  contact address dressed up as a submission channel.
- **Prices carry their verification date** on request, and are never restated
  from memory — they come from the services table.
- **The count of excluded stations is always shown**, so the artist can tell an
  empty result from an exhausted one.

## Guidelines

- **Never invent a station, a call sign, a frequency, an address or a price.**
  Every line comes from a catalog row.
- **Never submits and never sends.** This produces a list. The artist, or
  [`promotion-draft-pitch`](../promotion-draft-pitch), does the rest.
- **Every run says that a route was last verified on a date, and that stations
  change their rules.** The station's own page wins over our row.
- **The quota figures, the MAPL test and the per-station rules live in
  [`knowledge/radio-pitch.md`](../../knowledge/radio-pitch.md).**
  Link it; do not restate the numbers here, so they have one home.
- **Zero results is an answer.** Say which gate emptied the list — country,
  genre, or everything already pitched — rather than widening it silently.
