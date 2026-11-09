# Repo conventions

For human contributors and AI coding agents alike.

## What this repo is

An open-source **agentic music label** (AGPL-3.0): one agent per department (press,
promotion, digital marketing…), each reading our shared sources (`data/catalog`)
and the artist's own file (`data/artist`). The long-term goal is a "Salesforce
for music artists". We design one step at a time.

**v1 (now):** agents that work in a terminal or a minimal frontend. Example:
"I'm a Canadian artist working on a pop album. Which distributor should I use?" → the
agent ranks the distributors on the artist's own revenue, then saves the one the artist picks.

It runs two ways: self-hosted by a single artist, and as a hosted service where
the artist brings their own provider key.

Every department is one folder under `agents/`.


## Agent format (the contract)

data/
- artist/  - the artist's own data. Ships empty; agents fill it through conversation.
- catalog/ - **our** data: sources of info, crawled on demand with tinyfish,
  puppeteer fallback. **The catalog is one file, `data/catalog/catalog.sqlite`**,
  committed with the repo.

> ### The catalog is `data/catalog/catalog.sqlite`. Nothing else.
>
> Every reader opens that file: `data/catalog/client.ts` (TypeScript) and
> `data/catalog/query.py` (Python). No server, no login, no hosted database.
> Quote a row count from it: `bun run catalog:sql "select count(*) from press_outlets"`.
>
> Writes go through **the workshop**, a throwaway Postgres named by
> `CATALOG_DATABASE_URL` (Docker locally, a service container in CI):
> `catalog:load` fills it from the file, the crawl and seeds write into it,
> `catalog:build` writes the file back. The crawl (run by hand) opens a PR with the
> new file; merging it is what reaches artists. See `data/catalog/workshop.ts`.
>
> **`data/artist` is the opposite**: the artist's own Postgres (`DATABASE_URL`),
> local, ships empty, and never leaves their machine.

agents/
- one folder per department, each an agent. The full format contract — the
  shape of `AGENT.md`, `SKILL.md`, `knowledge/`, and `evals/` — is
  **[agents/README.md](./agents/README.md)**. Read it before adding or editing
  an agent; it is the authority, and `bun run agents:check` enforces it. The agents/agent-recruitor is in charge of creating new agent. 

.skills/ **Skills reach the tools through generated symlinks, not a manifest.** Neither Claude Code nor Cursor reads `agents/`; both scan `.claude/skills/`. Run
`bun run agents:sync` after touching an agent, and commit what it writes.

## Inspiration

[Twenty](https://github.com/twentyhq/twenty) · [ChatDev](https://github.com/OpenBMB/ChatDev) ·
[MetaGPT](https://github.com/FoundationAgents/MetaGPT) ·
[NeMo Agent Toolkit](https://github.com/NVIDIA/NeMo-Agent-Toolkit)

## Working rules

- **Never commit directly to `main`** 
- **Create a worktree for each new feature/project**
- **Tests:** `bun run test` (unit) · `bun run agents:check` (the format
  contract) · `bun run evals:run <dept>` (one prompt, one reply, with-agent vs
  ablated) · **`bun run evals:converse <dept>` (a whole conversation, no human
  in it)**.
- **Every department is tested against the user-personas before an artist sees
  it.** They live in [`evals/user-personas/`](./evals/user-personas/) — simulated
  artists that hold real multi-turn conversations with a department and write a
  transcript to `.transcripts/`.

  ```bash
  bun run evals:converse <dept> --persona indie-persona --turns 20
  bun run evals:converse <dept> --persona odile-ray   --turns 20
  bun run evals:converse <dept> --persona portland-punk --turns 20
  bun run evals:converse <dept> --persona ines-laval --turns 20
  ```

  **All four, always.** They fail in different directions and none of them
  substitutes for another: `indie-persona` has never released anything and knows
  none of the words; `odile-ray` has three records and will say "that's in my
  presskit"; `portland-punk` is a US trio with three writers per song and a
  pressing plant on the clock, and catches SOCAN, CanCon or French offered to
  a band from Oregon;
  `ines-laval` sings in Spanish and French with a label and $5,000 of her
  own, and catches a plan that treats the second language, or the budget, as a
  detail.

  `evals:run` fires one prompt and reads one reply, so it is blind to the
  failures that actually shipped: a first sentence recorded as an answer, a
  correction lost at save time, a turn that returned nothing, twenty dated tasks
  described in a paragraph. None of those is a bad answer to a question. They
  are a bad conversation, and you cannot see one without having it.

  **With no API credits, set `HOUSELABEL_PROVIDER=ollama`** — it runs on the
  machine, needs no key and costs nothing, which makes it the floor every
  department should clear. It proves wiring, not quality. For quality without
  a key, hold the conversation through subagents on the Claude Code
  subscription — `/recruit-evaluate` step 0b.

  Needs `EVAL_DATABASE_URL`, and refuses to run if it equals `DATABASE_URL` —
  the department writes rows. Each persona ships a `.fixture.sql` seeded before
  every run, so the artist in the database is the artist in the conversation.
- **README.md** : Always update the README.md when a new feature is validated. Describe all commands, and give example for each. 
- **Never publish secrets**
- **Keep the repo minimalist**
- When we discuss a feature that will be added later, add it to the "Roadmap" of the README.md
- **Squash merge to main** — every branch lands as a single commit line. Suggest
  a name, but always validate it with me first. Example:
  `feat-catalog-db: add data/catalog with distinction to data/artist`.
  Open a PR for each branch that explains, very concisely, what happened.
- **Finish the rename.** When a concept gets a new name, the old name is a bug,
  not history. Sweep every surface: npm scripts, folders, table names, env vars,
  CI job names, doc prose. Two vocabularies for one concept is the defect.
- **README.md** : Every README.md should be extremely concise. use /i-have-adhd skill. 
- **Cron jobs follow one template.** Every scheduled workflow copies
  [.github/workflows/README.md](./.github/workflows/README.md) — preflight the
  secrets and name the missing one, always ship `workflow_dispatch`, always open
  an issue on failure, never publish on a schedule, never hard-code a topic list
  in YAML, and exit non-zero when the job produced nothing. Cadence is per-source data (`crawl_sources.cadence_days`), never a
  second workflow. `crawl.yml` failed silently on two consecutive Mondays before
  this rule existed.
- **The catalog is one file.** `data/catalog/catalog.sqlite` is the only
  catalog; a hosted catalog database must never come back
  (`data/catalog/catalog.test.ts` fails if one is named). Edit it through the
  workshop (`catalog:load` → change → `catalog:build`) or directly for a hand
  fix, then commit it. `catalog:privacy` keeps it to desks, never a person.
- **A new column needs an idempotent ALTER, not just an edit to CREATE TABLE.**
  `catalog:migrate` re-runs each `schema.sql` as-is, and
  `create table if not exists` does nothing to a table that already exists. A
  column added only inside the CREATE never reaches an existing database.
- **Automation vs AGENT** : When possible, automate with a script. We want the most deterministic possible. 
- **Agents reach `artist.*` through the CLI, never raw SQL.** `bun run
  artist:brief <department>` for the common case, `artist:get` / `artist:set` /
  `artist:remember` for the rest. A skill that writes its own query re-decides
  the selection rules every run; those rules belong in
  [`data/artist/brief/rules.ts`](./data/artist/brief/rules.ts), where they can
  be tested. Every skill that reads artist data declares its commands in a
  `## Data` section.
- **Updates** : When you update a feature, make sure that it is updated across all repos and documentation. 
- **A feature that touches the roster touches every department.** Don't ship one
  department as a proof and leave the rest for later — a half-rolled-out feature
  is two vocabularies for one concept, the same defect as an unfinished rename.
  Enumerate every folder under `agents/`, give each one its entry, then update
  the scaffolding (`/recruit-agent` and its `assets/`, `/recruit-audit`,
  `agents/README.md`) so a new department cannot be created without it. Where
  possible make a test fail when the roster and the feature disagree — the
  `RULES` map in `data/artist/brief/rules.ts` is the worked example.

## Tooling

- Application code :  **TypeScript**.
- The JavaScript/TypeScript runtime and package manager is **Bun** — use
  `bun` / `bunx` (install, run, test, bundle) when tooling is needed, not
  npm/pnpm/node.
- Any Python ever added to this repo uses **uv** (`pyproject.toml` + `uv.lock`,
  run via `uv run`) — no pip, venv, or poetry.
- Keep secrets out of the repo. There is no `.env` yet; when one appears, it
  ships as `.env.example` only — the artist-facing variables; operator ones are documented in `doc/DEVELOPMENT.md`.
