---
name: distribution-compare-services
description: >
  Use when the artist is choosing a distributor or wondering whether to leave
  the one they have — walks a twelve-question interview, then ranks the catalog
  on the six dimensions with the real cost of each cut over their own revenue.
  Triggers on "which distributor should I use", "should I switch off CD Baby",
  "what does a 9% cut actually cost me", "show me the whole table".
metadata:
  agent: distribution
  status: developed
  mode: task
  greeting: help you find the distributor that fits you, and what switching would cost
  greeting-fr: t'aider à trouver le distributeur qui te convient, et ce que changer coûterait
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# distribution-compare-services

Turn the artist's situation into a ranked shortlist they can act on, and a saved
record of the choice so nobody re-argues it in six months.

**The artist can always ask for the whole table.** The shortlist is a service,
not a gate — "show me all of them" is answered with every `active` row on the
six dimensions, not with a refusal.

## Data

**The catalog is ours, read-only, and ships as one file** —
`data/catalog/catalog.sqlite`, rebuilt every Monday. Read it with the query
script (`uv` runs it, and fetches a Python if the machine has none — works in
Claude Cowork, Desktop and Claude Code alike):

```bash
uv run data/catalog/query.py distributors                              # fee model, cut, tiers
uv run data/catalog/query.py stores                                    # where a distributor delivers; 3 take direct uploads
```

`--where col=value`, `--q <text>`, `--columns all`, `--json` cover the rest;
`uv run data/catalog/query.py --datasets` lists what the file holds. It holds
desks, never a person: the person behind a desk comes from the artist's own
Hunter key or from reading the outlet's contact page for them.

```bash
bun run artist:brief distribution
bun run artist:get profile                       # country, region, career stage
bun run artist:set saved_distributors '{"distributor_slug":"<slug>","status":"shortlisted"}' --conflict distributor_slug
bun run artist:remember distribution ruled_out "<slug — why>"
```

Never write SQL and never open the database directly. The brief already carries
which distributors appear on existing releases; `saved_distributors` is where
the choice and its terms are recorded.

## Input

| Field | From | Notes |
|---|---|---|
| the twelve answers | [`scripts/questions.ts`](./scripts/questions.ts) | the engine walks `FLOW`; do not re-ask what it has |
| country, language | `artist.profile` | offered as a suggestion, never adopted silently |
| current distributor | `artist.releases.distributor` | inferred; confirm it rather than asserting it |
| what they ruled out | `artist.memory` | never propose one of these again without saying it was ruled out |
| the market | `catalog.distribution_services` | `lifecycle = 'active'` only, one `layer` at a time |
| the add-ons | `catalog.distribution_services.addons` | the products sold beside the deal; empty today on every row |

## Process

1. **Run the interview.** The engine walks `FLOW`. Twelve questions, one at a
   time, in the artist's language from question one.
2. **Filter to one layer.** `artist_facing` unless the artist is a label. Ranking
   a shop against its own supplier is the category error
   [`distribution-fundamentals.md`](../../knowledge/distribution-fundamentals.md#the-three-layers)
   exists to prevent.
3. **Score the six dimensions** in the order
   [`references/comparison.md`](./references/comparison.md) sets, weighting the two the artist named in `priorities`.
4. **Compute the effective rate** — `fee + (cut × revenue)` — using their revenue
   band. With no band, give the break-even instead: "these two cost the same at
   about $660 a year."
5. **Name the add-ons, and price only the ones they want.** Under each row, list
   what that company sells beside the deal, from `addons`. Do not fold them into
   the ranking — a distributor is not worse for offering optional products. Add
   one to the effective rate only when the artist says they need it, and when it
   bills as a fee *and* a cut, add both.
   [`distributor-knowledge.md`](../../knowledge/distributor-knowledge.md#add-ons-the-second-bill)
   has the three shapes.
6. **Price the switch** when they have a catalogue. Every release comes down and
   goes back up, losing its stream count and playlist positions.
7. **Present three to five, never the whole ranking** unless asked. Each one
   carries what it costs, what it keeps, and the one thing that would rule it out.
8. **Save the choice** to `saved_distributors`, and what they ruled out to
   `artist.memory` with the reason.

## Guidelines

- **Never fill a gap.** A `null` is "nobody has read their pricing page"; a name
  in `not_stated` is "they don't publish it". Print the difference; never print
  either as `0` or "free".
- **An empty `addons` means nobody looked, not "no add-ons".** The column is
  empty on all 39 rows today, so the honest line is "we haven't read their
  add-on pricing", never "there are none" and never a figure from memory. Only
  `addons` listed in `not_stated` earns "they don't sell any".
- **Never quote a fee-plus-cut add-on as a fee.** A Content ID product at
  $14.95/yr that also keeps 20% of what it recovers costs more the better the
  artist does, and the annual figure alone understates it at every level.
- **Never recommend a row that isn't `lifecycle = 'active'`.** An `unconfirmed`
  row is offered only with that said out loud; a `retired` one never.
- **Never write a reported rate into a recommendation as fact.** AWAL "reported
  at 15%" is a third party's account. Say who reported it.
- **Never rule on a contract.** Explaining what exclusivity or a takedown clause
  means is knowledge. Whether to sign an offer is not this department's call.
- **Never create the account.** The signup link is the last line, and the artist
  clicks it.

## Output

A shortlist of three to five, ordered by the artist's own two priorities, each
row showing all six dimensions with its gaps named — plus, when they had a
catalogue, what leaving would cost in releases and lost placements.
