# data/ — the artist's file and the catalog

This folder holds code and schemas, plus **one data file**: the catalog,
`catalog/catalog.sqlite`. The artist's rows live in their own Postgres.

```
data/
├── artist/     # the artist's own data. Ships EMPTY, fills through conversation.
└── catalog/    # our reference data. Crawled and seeded, the same for everyone.
```

| | `artist/` | `catalog/` |
|---|---|---|
| Store | Postgres, `DATABASE_URL` | one SQLite file, `catalog/catalog.sqlite`, committed in git |
| Lives | local Docker, on the artist's machine | in the repo — no login, no server, works offline |
| Agents | read and write, through the `artist:*` CLI | read only, through [`catalog/client.ts`](./catalog/client.ts) |
| Ships | empty — a seeded profile would be someone else's | seeded + crawled weekly, merged as a PR |

They are **two stores, not two schemas**: nothing can join across them, so
nothing can blur the line between them.

## Words

| Thing | Word |
|---|---|
| `data/catalog/` as a whole | the **catalog** |
| one topic in it (press, distribution…) | a **dataset** |
| the list of pages we crawl | the **source registry** (`catalog.crawl_sources`) |
| `catalog/catalog.sqlite` | the **file** — it *is* the catalog |
| the throwaway Postgres the crawl writes into (`CATALOG_DATABASE_URL`) | the **workshop** |
| `source`, `last_verified` | **provenance** |

## Where things live

- `data/catalog/<slug>/` exists only if `agents/<slug>/` exists, and its tables
  are `catalog.<slug>_<noun>`. Two exceptions: `tools` (cross-department) and
  `crawl_*` (operational).
- **Filter or read?** If an agent *filters* it ("every campus station in QC that
  plays jazz") → a dataset here. If it *reads* it ("how FACTOR's envelope
  system works") → `agents/<x>/knowledge/*.md`.
- Places and organizations carry `country` (`CA` | `US`).

## The seam between them

An artist's row points at the catalog by a **text slug**, never a foreign key:

```sql
artist.saved_distributors.service_slug  →  catalog.distribution_services.slug
artist.press_pitches.contact_slug       →  catalog.press_outlets.slug
artist.registrations.org_slug           →  catalog.rights_orgs.id
```

- **Slugs, not uuids:** a uuid is regenerated when the catalog is rebuilt, and
  a saved distributor would point at nothing.
- **Text, not a foreign key:** a real FK would weld the artist's private rows
  to wherever the catalog lives.
- **Frozen copies:** each saved row keeps a few display fields from save time,
  so it reads fine with no catalog — and comparing frozen vs live is how an
  agent notices a price moved.
- **Retired rows are never deleted:** `lifecycle = 'retired'`, because "this
  closed in March" beats a dangling slug.

## Reaching the artist's data — the `artist:*` CLI

Agents never write SQL against `artist.*`. The selection rules live in
[`artist/brief/rules.ts`](./artist/brief/rules.ts), where they are tested.

```bash
bun run artist:brief distribution           # what one department sees of the artist
bun run artist:get saved_distributors       # read one table
bun run artist:set saved_distributors '{"service_slug":"distrokid","status":"shortlisted"}' --conflict service_slug
bun run artist:remember press rejected_angles "no nostalgia framing"
bun run artist:migrate                      # create the artist tables (re-runnable)
bun run artist:fixture                      # load the invented test artist into DATABASE_URL
```

Adding an artist concept = a `data/artist/<concept>.sql` **plus a line in
[`artist/migrate.ts`](./artist/migrate.ts)**, which applies files in an explicit
order.

## Working on the catalog — the `catalog:*` commands

Writes go through the **workshop**, a throwaway Postgres (`CATALOG_DATABASE_URL`,
Docker on a laptop) — see [`catalog/workshop.ts`](./catalog/workshop.ts):

```bash
bun run catalog:load                # migrate, then refill the workshop from catalog.sqlite
bun run catalog:refresh press       # crawl one topic into the workshop
bun run catalog:sources list press  # stage · approve · reject · pause sources
bun run catalog:build               # export the workshop back into catalog.sqlite; commit it
bun run catalog:privacy             # desks only, never a person (--scrub fixes)
bun run catalog:sql "select count(*) from press_outlets"   # query the file
```

A catalog change is a reviewed git diff of the file;
`git log data/catalog/catalog.sqlite` is its history.

> ⚠️ **A new column needs an idempotent `ALTER`, not just an edit to
> `CREATE TABLE`.** `catalog:migrate` re-runs each `schema.sql` as-is, and
> `create table if not exists` does nothing to a table that already exists, so
> the column never reaches an existing database.

Adding a dataset = a folder `data/catalog/<slug>/` with `schema.sql` (plus
optional `crawl.ts`) and a line in
[`catalog/publish/datasets.ts`](./catalog/publish/datasets.ts). Adding a crawl
source = a row in `catalog.crawl_sources`, no code.

How the crawl works: [catalog/crawl/README.md](./catalog/crawl/README.md).

## The store

- **Postgres 15+** (the container runs 16) for the artist and the workshop.
  Plain SQL through `postgres.js`, so any Postgres works.
- **SQLite** for the catalog, because `bun:sqlite` ships with Bun: no install.
- Local Docker publishes Postgres on **host port 5433** (not 5432, to avoid a
  system Postgres). User and password `postgres` / `postgres`, local only.

**Read the connection string, never a hard-coded database name.** `artist:psql`
derives the database from `DATABASE_URL`; the default name is a fallback, not
an address.

Each schema file's header comment records what changed and why, so the
reasoning stays next to the columns.
