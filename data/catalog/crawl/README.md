# data/catalog/crawl/ — keeping the catalog fresh, and honest

The weekly crawler that fills `data/catalog` (our shared sources: press,
distribution). No agent reads these tables; none ship in a snapshot.

| Table | Answers |
|---|---|
| `crawl_sources` | **where** we look, one row per page |
| `crawl_pages` | **what** we fetched, before anyone interpreted it |
| `crawl_runs` | **when** we looked, and how it went |
| `crawl_observations` | **what** we saw, every run (append-only) |
| `crawl_snapshots` | **what** we published |

```
data/catalog/crawl/
├── schema.sql   the five tables + per-topic source views
├── pages.ts     the raw layer: fetch once, derive many times
├── sources.ts   staging CLI: bun run catalog:sources — propose · approve · reject · pause
├── db.ts        connect, upsert-with-lifecycle, markMissing, observe
├── engine.ts    TinyFish → Puppeteer per source; stillLive() for rechecks
├── harness.ts   runTopic(): extract → upsert → reconcile → recheck
└── run.ts       CLI: bun run catalog:refresh [topic]
```

## Run it

```bash
bun run catalog:refresh                    # every topic with active sources
bun run catalog:refresh press              # one topic
bun run catalog:refresh press <id>,<id>    # retune one source without re-billing the topic
bun test data/catalog/                     # golden-file tests: no network, no model, no cost
```

Needs `DATABASE_URL` and a provider key (pin the model with `CRAWL_EXTRACT_MODEL`).
`TINYFISH_API_KEY` is optional: without it every source falls back to Puppeteer.

[`crawl.yml`](../../../.github/workflows/crawl.yml) runs it every Monday, then builds snapshots.
**Publishing stays manual**, so a bad crawl never reaches artists on a cron.

## Add a source

Sources are rows, not code: adding one is an INSERT, no deploy.

```sql
insert into catalog.crawl_sources (id, topic, url, kind, scope, extraction) values (
  'the-orchard', 'distribution', 'https://www.theorchard.com', 'index',
  '{"layer":"label_facing","country":"US"}',
  '{}'
);
```

- `kind`: `index` (a listing page) **discovers** entities; `detail` (one
  entity's own page) **verifies** one.
- `scope`: what the topic's mapper needs, so one mapping function serves every
  source of a topic.
- `extraction`: the extraction shape as jsonb. Fixing a selector is an UPDATE,
  not a deploy. Per-source settings live here too: `followLinks`,
  `engine: 'agent'` (a billed session, for pages loaded from a JS API),
  `instructions`, `timeoutMs`.

The gated path (scout, validate, stage) is the
[`recruit-dataset`](../../../agents/agent-recruitor/skills/recruit-dataset)
skill. A page found mid-crawl lands as `pending_review` and waits for a human
to run `bun run catalog:sources approve`. Only a Puppeteer fallback stays in
code (a function can't live in jsonb); add it to the crawler's `puppeteer` map,
keyed by source id.

## Populating a dataset

| # | Step | Who | Command |
|---|---|---|---|
| 1 | Draft the field contract | agent proposes → **operator approves** | — |
| 2 | Scout sources, every URL fetched | agent proposes → **operator strikes lines** | — |
| 3 | Stage and activate | **operator decides**, script writes | `catalog:sources propose` · `approve` |
| 4–7 | Fetch → pick links → extract → parse deadlines | scripts + a light model | `catalog:refresh <topic>` · `catalog:deadlines` |
| 8 | Read the yields and sample rows | agent reports → **operator judges** | — |
| 9 | Freeze a snapshot | script | `catalog:build` |
| 10 | Promote it to artists | **operator only** | `catalog:build --publish` |

## The guards that protect the data

- **A missing row is never deleted.** An index page that stops listing an
  entity marks it `unconfirmed`, then fetches the entity's own page: live →
  back to `active`; hard 404/410 twice → `retired`; timeout/403/5xx → try again
  next week. Why: extraction is non-deterministic, and a broken extractor must
  not retire real rows.
- **Nothing is ever deleted:** an artist's saved distributor (`artist.saved_distributors`)
  must always resolve. **Missing is judged per source:** a broken page on one
  outlet's site can never mark another outlet missing.
- **A failed extraction is a source failure, never evidence** that rows vanished.
- **`protected` rows (everything seeded) are exempt** from the whole loop.
- **A failed free fetch stops; it never falls through to a billed session.**
  Paying is a decision, not a consequence of an awkward page.
- **An unchanged page costs nothing:** `content_hash` and `etag` skip both the
  download and the model.
- **`derived_model` is recorded per page:** "model or website changed?" is answerable.
- **The observation log shows flapping:** a row that vanishes and returns
  weekly is a broken extractor, not an unstable outlet.
