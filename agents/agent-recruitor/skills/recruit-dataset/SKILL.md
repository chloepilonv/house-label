---
name: recruit-dataset
description: >
  Use when a department needs a crawlable dataset built or grown — walks the
  encadré pipeline gate by gate: field contract, scouted sources the user
  validates line by line, staged pending_review → active promotion, a pilot
  crawl, and only then the weekly cron. Triggers on "seed the press outlets database",
  "we need more radio sources", "set up the dataset for X", "review the
  discovered sources".
metadata:
  agent: recruit
  status: developed
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# recruit-dataset

**Status:** developed — the orchestration is prose; its deterministic half,
the staging CLI [`catalog:sources`](../../../../data/catalog/crawl/sources.ts),
is real code.

A dataset filled in one unsupervised pass is a dataset nobody trusts. Every
catalog table grows the same way, through the same gates, with the user's word
between each: **fields → sources → pilot → cron**.

## Input

| Field | From | Notes |
|---|---|---|
| topic + owning department | conversation, or a `recruit-research` handoff | the department's `AGENT.md` `data:` block must declare the table |
| existing coverage | `bun run catalog:sources list <topic>` | never re-scout what is already active |
| discovered queue | `bun run catalog:sources list <topic> --status pending_review` | what the crawler proposed since the last review |
| field inspiration | the first House Label schemas and incidents (private, if you have access) | field *ideas* only — its data is never imported |
| candidate sources | WebSearch / WebFetch | organizations' own pages over aggregators, aggregators over listicles |

## Process

1. **Anchor the dataset.** Name the topic, the owning department, and the
   `catalog.<slug>_<noun>` table. A table that doesn't exist yet stops the run:
   hand the schema to `data/` as separate work (recruit-research's work-order
   shape) and resume when it lands.
2. **GATE — the field contract.** Draft the columns to extract, each with why
   the department needs it. The user validates; a field nobody would query gets
   cut here, not after 400 rows carry it.
3. **GATE — scout sources.** Research real organizations and directories, CA
   and US both, every URL fetched before it is listed. Past ~10 candidates,
   run the [`scout-sources`](../../../../.claude/workflows/scout-sources.js)
   workflow — one agent per region, each verifying its own URLs — rather than
   searching serially. It returns proposals, never rows; this gate still ends
   with a person. Present one **concise**
   table — proposed `id` · `url` · `kind` (`index`/`detail`) · `scope` ·
   `trust` · one-line note — one line per source, no prose paragraphs, the
   whole gate readable on one screen per country. Excluded candidates follow
   as one line each with the reason. The user strikes or keeps each line.
   Include the `pending_review` queue from previous crawls.
4. **Stage what survived.** Write the kept lines to a JSON file, then
   `bun run catalog:sources propose <file>` (lands as `pending_review`) and
   `bun run catalog:sources approve <id …>` for the ones the user validated.
   The script is the only writer; a hand-run INSERT drifts.
5. **GATE — pilot crawl.** `bun run catalog:refresh <topic>` once. Report
   per-source yield and 3–5 sample rows against the field contract. Thin or
   noisy yield loops back — to step 3 for more sources, or to the source's
   `extraction` query (an UPDATE, not a deploy) — until the user calls it good.
6. **Promote by doing nothing.** Active sources *are* the cron: Monday's
   workflow discovers topics by query. Set each source's `cadence_days` — 7 for
   data that moves with deadlines, 30 for mastheads, prices and venues — and the
   weekly run skips whatever is not due. State what will now happen, and that
   publishing snapshots stays a manual gate.

   **Never add a workflow to get a different cadence.** That reintroduces the
   topic matrix `crawl_sources` exists to delete. If a job genuinely needs its
   own workflow, it copies
   [`.github/workflows/README.md`](../../../../.github/workflows/README.md) —
   the cron template — and satisfies its ten rules before it ships.

## Output

At each gate, a table the user can strike lines from. At the end, one summary:
topic · sources active · rows landed · fields still unfillable — plus the
standing loop: what the next weekly run does, and where discovered sources
will queue.

## Guidelines

- **Never skip a gate, however hurried the request.** The gates are the method;
  speed comes from looping 3–5 tightly, not from merging them.
- **The long tail is real but never automatic.** A one-off host — a label with
  a single grant program — enters as `kind: 'detail'`, low trust, scoped to
  that entity. Sources the crawler discovers mid-run wait in `pending_review`
  for the next cycle's step 3; nothing self-adopts.
- **Sources, never rows.** This skill writes `crawl_sources` entries; catalog
  rows arrive only through the crawler. A hand-pasted row has no provenance and
  dies at the first staleness pass.
- **the first House Label is inspiration, not import.** Read it for field ideas and
  incident-earned rules; porting its data was considered and rejected.
- **Only the organization that holds the money.** An aggregator — an industry
  association or newsletter listing *other* people's grants — is never a
  source. Every row inherits the crawled page's owner, so an aggregator page
  records Canada Council's program as the association's, and an artist is sent
  to the wrong door. Round 2 staged three (SaskMusic, Manitoba Music, CAAMA)
  despite the scout flagging one in its own note; they produced 190 wrong rows.
  Their deadlines are often better than the funder's own index — that is an
  enrichment pass over existing rows, never a source of new ones.
- **A source that can't name its organization doesn't ship.** Every row carries
  a real org in `scope` and a URL that was fetched, not assumed.
- **Google Places is off the table.** Its terms forbid storing and
  redistributing the data, and this catalog ships as published snapshots.
