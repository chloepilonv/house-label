# data/catalog/ — the catalog

The reference data House Label operates and every artist reads: which outlets
cover which genres, which distributors exist, which collecting societies to join. Its
counterpart is [`data/artist/`](../artist) — the half the artist owns.

It is a public good. One organization crawls it once, rather than thousands of
artists each rediscovering that FACTOR exists.

## Where the rows are

**In one file: [`catalog.sqlite`](./catalog.sqlite)**, committed beside this
README. There is no other copy to check.

- **Read:** [`client.ts`](./client.ts) opens it read-only (`bun:sqlite`); Python
  skills use [`query.py`](./query.py). No login, no server, works offline.
- **Write:** in the **workshop**, a throwaway Postgres named by
  `CATALOG_DATABASE_URL` (Docker on a laptop, a service container in CI) —
  [`workshop.ts`](./workshop.ts). Lose it and nothing is lost.
- **Ship:** `catalog:build` exports the workshop back into the file. A change
  is a reviewed git diff; `git log data/catalog/catalog.sqlite` is the history.

## Layout

**`data/catalog/<slug>/` exists only if `agents/<slug>/` exists, and its
tables are `catalog.<slug>_<noun>`.** So a table name says which staff member
owns it, and there is nothing to remember.

```
data/catalog/
├── press/        press_contacts · press_playlists          → The Press Agent
├── rights/        rights_orgs                            → The Rights Agent
├── tools/        tools                                     → cross-department
│
├── crawl/        crawl_sources · crawl_runs
│                 · crawl_observations · crawl_snapshots    → operational
├── publish/      load.ts · build.ts · datasets.ts
├── workshop.ts   the throwaway Postgres writes go through
├── catalog.sqlite  THE catalog (+ .manifest.json)
└── client.ts     the read seam every agent goes through
```

Two exceptions to the prefix rule, both deliberate. **`tools`** is
cross-department — the Presskit Agent suggests Canva, the Digital Marketing Agent
suggests Later, the Rights Agent suggests Songtrust — so it carries no
prefix, exactly like `artist.profile`, which every agent also reads.
**`crawl_*`** is machinery, owned by no department; only `crawl_sources`
ships, and no agent reads it.

Three departments have no dataset at all — `presskit`, `platforms`,
`knowledge`. That is correct, not a gap: they work from the artist's own rows
plus their `knowledge/*.md`. The test is whether an agent **filters** the thing
or **reads** it.

## Each dataset

```
<slug>/
├── schema.sql   the tables. Re-runnable (`if not exists`).
└── crawl.ts     how to map extracted data into rows. Optional.
```

Note what `crawl.ts` does **not** contain: the list of URLs. Those are rows in
`catalog.crawl_sources`, because the crawler discovers new ones and code cannot
write to code. See [`crawl/`](./crawl).

## Every catalog row carries the same provenance

```sql
source         'seed' | 'crawl_tinyfish' | 'crawl_puppeteer' | 'manual'
source_url     where it came from
protected      hand-verified — refreshable, but never auto-retired
content_hash   detects a real change vs. a no-op re-observation
first_seen_at  "added this week" is built on this
last_seen_at   refreshed by every run that observes the row
last_verified  how old this fact is
missing_since  first run that did not see it
missing_runs   consecutive misses
lifecycle      'active' | 'unconfirmed' | 'retired'
```

`lifecycle` is our **observation** state, not the world's. `unconfirmed` means
*we* stopped seeing it, which is far more often a broken extractor than a dead
program — so it triggers a targeted recheck rather than a deletion. Nothing is
ever deleted: `artist.saved_distributors.service_slug` must keep resolving.

"Reference vs. crawled" is deliberately **not** a structural distinction. It is
a property of each row (`source`), not of a table. Whether a dataset gets
crawled is simply whether `crawl_sources` has active rows for its topic — so
adding a crawl to `tools` later needs source rows and no DDL.

`complete` vs `partial` **is** a real distinction, declared in
[`publish/datasets.ts`](./publish/datasets.ts). `rights_orgs` is all 13 orgs
that matter; `press_outlets` is a growing sample. It changes what an agent may
say: "these are all the orgs you must register with" versus "here is what I
found". It rides in `catalog.sqlite.manifest.json`, so the file carries its own honesty.

## Identity: slugs, not uuids

Artist rows point here by text slug and never by foreign key
([the seam](../README.md#the-seam-between-them)).
`press_contacts.slug` and `press_playlists.slug` are **generated columns**
derived from each table's natural key, so they cannot drift from it. Accents
fold to ASCII rather than to hyphens — half this catalog is in French, and
`bourses-aux-artistes-cr-ation` is not a name anyone can read back to an artist.

## Run it

```bash
bun run dev:up                     # start the Docker Postgres (the workshop)
bun run catalog:load               # migrate, then refill the workshop from catalog.sqlite
bun run catalog:refresh            # crawl every due source
bun run catalog:enrich:distribution  # fill distributor details
bun run catalog:build              # export the workshop into catalog.sqlite + manifest; commit it
bun run catalog:privacy            # desks only (--scrub fixes)
bun run catalog:sql "select count(*) from tools"   # quick query of the file
```

The weekly crawl ([`crawl.yml`](../../.github/workflows/crawl.yml)) runs load →
refresh → enrich distribution → build → privacy, then opens a PR on
`chore/catalog-snapshot`. **Merging it is what reaches artists.** Secrets:
`TINYFISH_API_KEY`, `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_WORKSPACE_ID`,
`RESEND_API_KEY`) — no database secret.

## The shipped file — `catalog.sqlite`

One SQLite file, 10 tables, ~720 KB, committed in this folder and
rebuilt every Monday by `crawl.yml`. The list is
[`publish/datasets.ts`](./publish/datasets.ts). Read it with `uv run data/catalog/query.py`
(uv is installed by `setup-label.sh`; the script itself has no dependencies). It is what an agent reads when it has no
database: Claude Cowork, Claude Desktop, a Claude Project. `catalog.sqlite.manifest.json`
beside it carries the build date, the row counts and the sha256.

| Dataset | Table | What a row is |
|---|---|---|
| radio | promotion_radio_stations | a station you can pitch: route, address or form, quoted rules |
| playlists | promotion_playlists | a playlist worth pitching: curator type, route, followers |
| press | press_outlets | an outlet: type, market, desk, how to submit |
| radio-services | promotion_radio_services | 45 Tours, DMDS, !earshot… what they cost, who they reach |
| pitch-services | promotion_pitch_services | SubmitHub, Groover… prices, guarantees, risks |
| distributors | distribution_services | a distributor: fee model, cut, tiers, specs |
| stores | distribution_stores | a store: via distributor or direct upload |
| rights | rights_orgs | a collection society: who it is for, cost, signup |
| tools | tools | the apps the label points at |
| — | crawl_sources | not for agents: the pages the weekly crawl reads |

```bash
uv run data/catalog/query.py --datasets
uv run data/catalog/query.py radio --country CA --region QC --route direct_email
uv run data/catalog/query.py press --market quebec --q "devoir" --columns all
bun run catalog:build          # rebuild the file from the workshop; commit the result
bun run catalog:privacy        # refuse the build if any row names a person
```

**Desks only, never a person.** A published desk (music@, redaction@) ships; an
editor's own address does not, even one printed on the outlet's contact page.
`catalog:privacy` scrubs (`--scrub`) and enforces it; a `bun test` does too. The person behind a desk is the
artist's to find: Hunter with their own key, or their agent reading the page.

Archived on 2026-10-27, not shipped: the former funding and venue datasets, the crawl logs —
local SQLite + CSV in `~/Documents/Code/catalog-archive/`.

## Reading it

Agents never open the file themselves — they go through
[`client.ts`](./client.ts):

```ts
import { openCatalog } from "./data/catalog/client";

const catalog = await openCatalog();                      // read-only, catalog.sqlite
const outlets = await catalog.query("press_outlets", { market: "quebec" });
```

- `catalog.info.completeness` tells the agent whether it may say "all".
- `CATALOG_FILE` swaps in a scratch copy — the evals runner uses it when a
  test case brings its own catalog rows.

## Status

Seeded and queryable: 10 press contacts, 6 playlists, 13 rights orgs, 49 tools.
Press has its mapper wired and idle until listing pages are added.
