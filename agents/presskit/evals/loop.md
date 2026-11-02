# Presskit end-to-end loop

Drives `agents/presskit/evals/e2e.ts` against two invented artists until the whole
path works, then stops. The implementer never marks its own work done.

## Scheduling

Dynamic. Not a cron: this loop is driven by a human landing a branch, and the
only reason to wake is that a run failed or a fixture changed.

- **Trigger:** `/loop bun run presskit:e2e` after any change under
  `agents/presskit/`, `engine/tools.ts`, or `data/artist/presskit.sql`.
- **Cadence when polling:** 1200s. Nothing here changes faster than a person
  edits a file, and the network steps cost money per run.
- **Stop:** exit code 0 twice in a row, or two consecutive rounds with no new
  failure fixed (a dry round bound).

## Required Skills

- `/recruit-overhaul presskit` — owns the department's rung.
- `/recruit-evaluate presskit` — grades `evals.json` assertions. Separate from
  this loop: that one judges output quality, this one judges whether the path
  runs at all.
- `loop-verifier` — the checker. It reads the run table and decides done.

## State

`presskit-loop-STATE.md`, at the repo root (gitignored — a record of the last run, never committed). The model forgets everything
between rounds, so the state file is the only memory — and every number in it
is re-derived from a live run rather than trusted.

```
## Last run
## Open failures      — one line each: check · fixture · what the output said
## Fixed this round
## Known-external     — failures that are NOT code (no API credit, site down)
```

`Known-external` matters more here than in most loops: three of the five steps
reach the network, and a Bandcamp page going JavaScript-only is not a
regression in our code. Misfiling one as a code failure sends the next round
chasing nothing.

## How the Loop Runs (Typical Cycle)

1. **Run it.** `bun run presskit:e2e`. Two fixtures, ~20 checks, ~60s and a few
   cents of API when the network steps are on.
2. **Read the table, not the logs.** Every check prints `✓`/`✗`, the fixture,
   and the actual value against the expected one.
3. **Classify each `✗`** as code, fixture, or external. An `invalid_request_error`
   about credit balance is external; `relation does not exist` is code.
4. **Fix ONE code failure.** Smallest change that turns that check green.
5. **Re-run.** If the fix greened it and broke nothing, write it to
   `Fixed this round`. If it broke something, revert rather than stack fixes.
6. **Render on any deck change.** `soffice --headless --convert-to pdf`, then
   `pdftoppm`, then look at slides 1, 3 and 8. Overflow and collisions do not
   fail an assertion — the table fix this loop found was invisible to every
   check and obvious in the PNG.
7. **Hand to `loop-verifier`** with the run table verbatim, including what still
   fails. It decides done; this loop does not.

## Post-Run Critique

After each round, in one line each:

- Did the failure I fixed have a test that would have caught it earlier?
- Was any `✗` actually a wrong expectation in `fixtures.ts`? Moving a threshold
  to match reality is legitimate; moving one to make a run green is not.
- Did I change `expect.minPressCandidates` downward? Say why, out loud.

## Verification Strategy

Objective, in this order:

1. `bun run presskit:e2e` exits 0.
2. `bun run test` — 268+ pass, 0 fail.
3. `bun run agents:check` — contract ok.
4. Two rendered PNGs looked at by eye. Not automatable today; say so rather
   than pretending the exit code covers layout.
5. `loop-verifier` agrees. Maker/checker: the implementer never signs off.

## Human Handoff Points

Stop and ask. Do not work around these.

- **Google Drive delivery** — the one step `e2e.ts` deliberately skips. It needs
  an OAuth consent the artist gives once, and no loop can grant it.
- **API credit exhausted** — the run cannot proceed and no code change fixes it.
- **A fixture's expected threshold looks wrong** — lowering it is a judgement
  about what "working" means, which is the artist's call.
- **Anything that would write to the artist's own database.** The loop uses
  `EVAL_DATABASE_URL` and must keep doing so.

## Tool-Specific Notes

- **`EVAL_DATABASE_URL` is mandatory.** `e2e.ts` refuses to run without it, so
  the artist's own rows cannot be truncated by a loop round. Apply migrations
  to it with `DATABASE_URL=$EVAL_DATABASE_URL bun run artist:migrate`.
- **`--no-net`** skips Bandcamp, poster vision and press search. Use it while
  iterating on layout or SQL; it is not a passing run.
- **One fixture at a time:** `bun run presskit:e2e lamprey-season`. The artist tables
  hold one profile row, so fixtures cannot run concurrently.
- **`pptxgenjs-plus`, not `pptxgenjs`.** The fork is maintained and has
  `addFont`. See [[presskit-renderer-decision]].
- **Images are fetched by us, never by the library.** `addImage({path:url})`
  does not follow redirects, and Wikimedia rejects a fetch with no User-Agent.
  Both cost a round to learn.

## Failure Modes & Mitigations

| Mode | Looks like | Mitigation |
|---|---|---|
| Bandcamp page is JS-rendered | 0 releases from a URL that opens fine in a browser | The tool says "unreadable", never "no releases". Fall back to `releases_typed`. |
| Web search on the wrong tier | `does not support programmatic tool calling` | `webSearch_20250305`, not the newer tool. |
| Search returns a different person | Plausible press about a stranger | `disambiguation` is passed, and every candidate lands `suggested`. |
| A slide silently overflows | Every check green, deck looks broken | Step 6 — render and look. |
| Fixture drift | A check fails with no code change | Classify as external before touching code. |

## Cost Profile

Per full round: one Haiku web search per fixture (~$0.01 each), one vision call
for the poster fixture (~$0.01), ~30 HTTP fetches for Bandcamp and photos, and
~60s wall clock. `--no-net` rounds are free. Two fixtures is deliberate — a
third would double the cost and cover no new branch.

## Success Metrics

- `bun run presskit:e2e` exits 0 on both fixtures with the network on.
- Every crawled item lands `suggested`; the `nothing auto-confirmed` check
  proves the deck ignores unconfirmed data.
- A deck generated from an empty presskit still renders eight slides and names
  what is missing — the `no invention` check.
- `presskit` appears in `n / 10 in production` in `bun run test`.
