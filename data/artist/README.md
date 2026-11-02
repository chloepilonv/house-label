# data/artist/ — the part the artist owns

Their profile, their catalog, the distributor they chose, what each agent has
learned about them. None of it is crawled, published, or shared, and it is the
half of the database an artist takes with them if they leave.

Its counterpart is [`data/catalog/`](../catalog) — the catalog House Label
operates and every artist reads.

One `.sql` per service concept:

| File | Tables | Service |
|---|---|---|
| `profile.sql` | `profile` | everyone — **read-only; only `houselabel profile` writes it** |
| `songs-catalog.sql` | `releases`, `songs`, `song_writers`, `song_splits` | rights |
| `platforms.sql` | `platforms`, `platform_stats` (+ `platform_latest` view) | platforms |
| `registrations-infos.sql` | `registrations` | rights |
| `presskit.sql` | `presskit`, `presskit_items` | presskit |
| `marketing-campaign.sql` | `marketing_campaigns`, `marketing_tasks` | campaigns |
| `press-relation-campaign.sql` | `press_campaigns`, `press_pitches` | press |
| `contacts.sql` | `contacts` | press + promotion — the person behind an outlet, found with the artist's Hunter key |
| `label-project.sql` | `projects`, `project_phases`, `project_milestones`, `project_deliverables`, `project_handoffs` | label-manager |
| [`release-link.ts`](./release-link.ts) | one project → one `releases` row, upserted on scope save and plan save; `pickFocusRelease` then sees the record being made instead of the newest old one | label-manager |
| `release-credits.sql` | `release_credits`, `song_samples` (+ `credits_url`, `p_*`/`c_*` on `releases`) | label-manager — the liner credits; the rights-bearing ones stay in `songs-catalog.sql` |
| `memory.sql` | `memory` | shared |

## There is no seed here

That's deliberate. These tables ship **empty** and are filled two ways.

`profile` is filled by the artist, in one place, with `houselabel profile` —
fourteen questions, then re-run to change any of them. No department writes
that row; see **Who writes what** below.

Everything else is filled by the agents, one answer at a time, during ordinary
conversation. After the agent has searched the shared catalog:

> **Distribution Agent:** DistroKid is a flat $24.99 a year and keeps 0% of
> store revenue — on your numbers, the cheapest. Want me to save it?

```sql
insert into artist.saved_distributors (service_slug, status, saved_name)
values ('distrokid', 'shortlisted', 'DistroKid');
```

Three rules follow, and they are the shared principles in
[`agents/README.md`](../../agents/README.md) made concrete:

- **Ask once.** Anything already in `artist.profile` is never asked again — by
  any agent. The publicist reads the same row the artist filled in.
- **Confirm before writing.** Agents propose ("want me to save it?"), the
  artist decides. Same posture as *draft, don't act*.
- **Nothing here is inferred from the shared side.** A saved distributor means the
  artist said yes.

## Who writes what

`profile` is the artist's. Every department reads it; none may write it. That
is enforced twice, because a department reaches the database two ways — the
typed tool when the engine drives it, and `artist:set` through its Bash tool
when Claude Code does:

- `artist_set` in [`engine/tools.ts`](../../engine/tools.ts) cannot name it
- `bun run artist:set profile` is refused before a connection is opened
- `bun test data/artist/ownership.test.ts` fails if either gate is removed

The reason is that this row is what every other answer is derived from — which
stations appear, which language a pitch is written in, which distributors are
in reach. An agent editing it mid-conversation changes work it is not part of, and
leaves no record of who decided. `ARTIST_OWNED_TABLES` in
[`client.ts`](./client.ts) is the list; it is a list and not a boolean because
the reason generalises to any row the artist maintains by hand.

## Reading and writing it

Agents never touch these tables directly. `client.ts` is the only file in the
repo that opens `DATABASE_URL`, and `brief/cli.ts` is the only way in:

```bash
bun run artist:brief press          # ~20 lines, already shaped for that department
bun run artist:get profile          # readable by everyone
bun run artist:get releases --order "release_date desc" --limit 5
bun run artist:set releases '{"title":"Nuit blanche","release_date":"2026-09-12"}' --conflict id
bun run artist:remember press rejected_angles "no nostalgia framing"

bun run houselabel profile          # the artist, and the only writer of artist.profile
```

**One backend, on purpose.** [`data/catalog/client.ts`](../catalog/client.ts)
has three — file snapshot, Postgres, and one day an API — because the catalog
might move to our servers. This has one, because the artist's data never does.
A self-hosting artist can verify that by reading the connection string. Adding
a second backend here means changing the promise first.

**A brief is not a table dump.** `--conflict` omitted is a plain insert, which
the uuid-keyed tables need; naming the natural key makes it an upsert.
[`brief/rules.ts`](./brief/rules.ts) holds the per-department judgment — which
release is *the* release, which numbers are worth citing — separately from the
plumbing, so editing what the publicist sees cannot break the connection code.
Those rules used to be English inside `SKILL.md` files, re-interpreted every
run; `brief/rules.test.ts` is what makes them hold.

**The hook.** `.claude/settings.json` runs `brief/hook.ts` on `SubagentStart`,
so a summoned department already has the file open. It never blocks — no
database means no context, never a failed summon — and it is Claude Code only.
The commands survive a move to a hosted frontend; the hook does not.

## The seam: no foreign key into shared

`artist.saved_distributors.service_slug` is plain `text`, deliberately without a
foreign key into `catalog.distribution_services`. So are `press_pitches.contact_slug`
and `registrations.org_slug`.

That is what lets the two halves come apart. Today they're two schemas in one
local Postgres; tomorrow the shared side can be House Label's hosted database,
or a file pulled weekly, and not one query here changes. A real FK would weld
the artist's private data to our infrastructure permanently.

Each of those tables also freezes a few display fields at save time —
`saved_name`, `saved_funder`, `saved_deadline`. They are not a cache. They are
what makes the row readable with **no shared data present at all**, and
comparing them against the live row is how an agent notices that a deadline
moved.

The cost is honest: a slug can dangle if a program disappears. Check that a
saved slug still resolves before drafting against it.

## Two things the schema enforces that agents would otherwise have to remember

**Regenerating a marketing plan doesn't destroy work.** `marketing_tasks` is
keyed `unique (campaign_id, sort_order)`, so a regeneration upserts. The
artist's hand-written captions, the task statuses, and the content links all
survive. The old product deleted and re-inserted, and lost them every time.

**Presskit lists merge instead of replacing.** `presskit_items` is keyed
`unique (kind, dedupe_key)` — awards by title+year, shows by venue+date, quotes
by text-prefix+source. `on conflict (kind, dedupe_key) do update` is the whole
merge rule, rather than seven special cases in application code.

## Run it

```bash
bun run artist:migrate        # create artist.* — starts empty, no seed
```

Or `bun run dev:setup` for both halves.

Note that [`migrate.ts`](./migrate.ts) applies these files in an **explicit
order**, not alphabetically like the shared side: `marketing-campaign.sql` and
`press-relation-campaign.sql` both reference `artist.releases`, which
`songs-catalog.sql` creates.

## Status

The ten concepts above. Deferred, each wanting the skill that writes it:
the earnings side (royalty statements, earnings, gaps).

## Fixtures

`fixtures/odile-ray.ts` holds the artist every test and demo runs against —
an invented profile shaped like one filled in through `houselabel profile`. Load it with `bun run artist:fixture` into whatever `DATABASE_URL` names.

It is **not** a seed. `artist:migrate` has an explicit `FILES` list and never
applies it; these tables ship empty and fill through conversation. The loader
refuses a database that already holds a profile unless passed `--force`.
