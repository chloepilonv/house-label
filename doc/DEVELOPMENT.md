# Development

Commands, evals and the roadmap. Artist-facing docs are in the [README](../README.md); conventions in [AGENTS.md](../AGENTS.md).

## All commands

| Prefix | Touches | Commands |
|---|---|---|
| `houselabel` | the artist's CLI | `init` · `profile` · `voice` · `connect` · `disconnect` · `drive setup` · `calendar sync` · `recap` · `example <name>` · *(default)* · `<department>` · `--staff` · `--log` |
| `dev:` | local Docker Postgres | `up` · `down` · `reset` (destructive) · `setup` (= `artist:migrate`) |
| `artist:` | the artist's DB — `DATABASE_URL` | `migrate` · `brief` · `get` · `set` · `remember` · `fixture` · `psql` · `reset` |
| `catalog:` | `data/catalog/catalog.sqlite`, via the workshop Postgres — `CATALOG_DATABASE_URL` | `load` · `migrate` · `seed` · `setup` · `refresh` · `sources` · `hubs` · `report` · `enrich:distribution` · `help-centres` · `build` · `privacy` · `sql` · `reset` |
| `agents:` | `.claude/` publishing | `sync` · `check` |
| `models:` | the model table — `engine/models.ts` | `check` (monthly in CI: `.github/workflows/models.yml`) |
| `website:` · `social:` · `presskit:` | digital-marketing and presskit scripts | `website:build` · `website:deploy` (needs `VERCEL_TOKEN`) · `social:variants` · `presskit:e2e` |
| `evals:` | scratch DB — `EVAL_DATABASE_URL` | `run` · `converse` · `reset` |

```bash
houselabel distribution --log       # talk to a department; record it to .transcripts/
bun run artist:brief press          # what a department sees of the artist
bun run artist:set releases '{"title":"Nuit blanche","release_date":"2026-09-12"}' --conflict id
bun run artist:fixture              # load the Odile Ray test artist
bun run catalog:load                # fill the workshop Postgres from catalog.sqlite
bun run catalog:refresh press       # crawl one topic into the workshop (TinyFish, Puppeteer fallback)
bun run catalog:build               # export the workshop back into catalog.sqlite; commit it
bun run catalog:sql "select count(*) from press_outlets"   # query the file
bun run agents:sync                 # publish agents/ → .claude/ symlinks; commit the output
bun run agents:check                # CI gate: the format contract
bun run models:check                # is every model in engine/models.ts still live, and is there a newer one?
bun run website:build && bun run website:deploy
houselabel example <name>           # build references/example-<name>.yaml in Drive through the real template
bun run evals:run press             # one prompt, one reply, with-agent vs ablated
bun run evals:converse press --persona odile-ray --turns 20   # a whole conversation
HOUSELABEL_PROVIDER=ollama bun run evals:converse press --persona indie-persona   # free, local
```

Four personas, always: `indie-persona`, `odile-ray`, `portland-punk`,
`ines-laval` — [`evals/user-personas/`](../evals/user-personas/). Ollama
needs `OLLAMA_CONTEXT_LENGTH=16384`; its 4k default silently truncates the prompt.

Contributors: format contract in [`agents/README.md`](../agents/README.md),
conventions in [AGENTS.md](../AGENTS.md), diagrams in
[`doc/ARCHITECTURE.md`](../doc/ARCHITECTURE.md). New departments come from
`/recruit-agent <need>`.

## Operator environment

Only the label operator sets these, in a gitignored `.env.local`. An artist's
`.env.example` never lists them.

| Variable | What it is |
|---|---|
| `DATABASE_URL` | the artist database — local Docker; `init` writes it to `~/.houselabel/config.json` |
| `CATALOG_DATABASE_URL` | the workshop — a throwaway Postgres the crawl writes into; `catalog:build` exports it to `catalog.sqlite` |
| `CATALOG_FILE` | read a scratch copy instead of `data/catalog/catalog.sqlite` (the evals runner sets it) |
| `EVAL_DATABASE_URL` | the evals scratch database; the runner refuses it if it equals `DATABASE_URL` |
| `TINYFISH_API_KEY` | the crawl engine; Puppeteer is the fallback without it |
| `ANTHROPIC_API_KEY` · `ANTHROPIC_WORKSPACE_ID` | the crawl's extraction model; the workspace id is required for an org-scoped key or every call 400s |
| `CRAWL_EXTRACT_MODEL` · `CRAWL_SELECT_MODEL` · `CRAWL_BUDGET_USD` | crawl tuning |
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | an OAuth client for developing here; an artist is asked once by `connect google` |
| `HOUSELABEL_ENCRYPTION_KEY` | the key OAuth tokens are encrypted with; generated into `~/.houselabel/secret.key` when empty. Changing it orphans an existing connection |

## Roadmap

1. **Deploy the website for real** — `website:deploy` has never run (`VERCEL_TOKEN` unset).
3. **Grow source coverage past ~20%** — 4 provinces of 13, 3 states of 50.
4. **Datasets for press** — zero crawl sources today.
5. **Distribution enrichment passes** — delivery specs and add-ons, across all 39 rows. DistroKid and ASCAP need `--engine agent`.
7. **Wire the briefs into evals** — no eval asserts on what `artist:brief` returns.
9. **Presskit delivery per recipient** — the PPTX renderer, for outlets that refuse a Drive link.
11. **Gated catalog rows** — a metered, revocable read API, one key per artist, for data that must never ship in the public file.
12. **A web front end** — one wizard over [`engine/interview/core.ts`](../engine/interview/core.ts); `engine/` extracted to a package first.
13. **Publish `houselabel` to npm** — `bunx houselabel`, bundling `agents/` and `catalog.sqlite`.
14. **Real Gmail drafts** — needs the restricted `gmail.compose` scope; decide the cloud posture first. `gmail.readonly` (also restricted) is already opt-in for `voice learn --gmail`; the hosted service ships `--from <folder>` until Google's assessment is done.
15. **IPI, IPN and ISNI go back on `artist.profile`** — the profile is the card an artist hands a collaborator. Rights proposes the number, only `houselabel profile` writes it; per-society member numbers stay in `artist.registrations`. Then `houselabel profile export` writes the card.
16. **Crawl the rights registry** — 15 societies entered by hand, nothing re-checks them.
17. **Evals per provider** — record which provider produced a result.
18. **Free tiers** — Groq's 8k limit and Gemini's 20 requests/day cannot run a department.
19. **The campaign plan as a page** — printable, shareable.
20. **The Monday recap from the cloud** — `houselabel recap --schedule` runs on the artist's machine; the hosted service needs Google's restricted-scope assessment (`gmail.send`) before it can send one.
21. **Budgeting on the label manager** — a deterministic `budget.ts` summing the chosen routes.
22. **A follow-up directory** — music directors and journalists now land in `artist.contacts` through Hunter; playlist curators and a `language` column still do not.
23. **Human catalogs** — the people an artist hires when the department says "this one is not us".
24. **Pitches in the artist's voice** — no eval asserts on tone yet.
25. **Memory engine** — Cognee vs plain `artist.*` tables.
26. **Buffer with a real key** — `engine/buffer/` is tested against a fake Buffer and a real 401 only; draft one post with a photo end to end, then run the four personas. Open question: does Buffer accept the `lh3.googleusercontent.com/d/<id>` link (`directImageUrl` in `engine/google/drive.ts`)? If not, the photo is added in Buffer by hand.
27. **Hunter with a real key** — `engine/hunter/` is tested against a fake Hunter and a real refused key only; quote and look up five Quebec outlets end to end, confirm one domain search costs one credit, then run the four personas on `press` and `promotion`.
28. **Quebec radio and press in the catalog** — `catalog.promotion_radio_stations` has 0 rows in every country (seed Quebec from the CRTC licence list first); `press_contacts` lacks La Presse, Le Devoir, Le Soleil and ICI Musique.
29. **`email_kind` on `catalog.press_contacts`** — `personal` · `role` · `none`, set by the crawl; 68 of 196 emails are desks like `info@`. `engine/hunter/tools.ts` decides it in code today (`isPersonal`).
30. **Video crops** — `social:variants` does photos only; video needs ffmpeg.
31. **More `services:`** — each an `engine/<service>/` with fixed tools, like Buffer:
    - *platforms, built ourselves:* YouTube Analytics on the existing Google login; Deezer and SoundCloud public counts. Spotify has no artist-stats API since Feb 2026.
    - *read-only lookups:* MusicBrainz (ISRC/ISWC) for `rights`.
    - *partner applications, weeks of lead time:* SOCAN, The MLC, SoundExchange, Bandsintown.

### Decided against — on the list so it stops being re-proposed

Each with its reason and the condition to revisit.

- **Tax advice, cash flow** — an accountant's job.
- **Merch & D2C** — inventory, fulfilment, a storefront: a commerce product. Revisit when the artist is touring.
- **Royalty collection & tracking** — statement ingestion and reconciliation: ETL, not a knowledge agent. Why the department is `rights`, not `royalties`.
- **An MCP for SubmitHub, Groover, 45tours, DistroKid, CD Baby, Spotify for Artists** — none has an API; SubmitHub's terms ban bots. Promotion and distribution stay "we prepare, the artist submits". Revisit when one ships an API (DistroKid is hiring for one).
- **Territory: France** — a third country is a sweep across every department plus new crawl sources per dataset. Revisit when a French artist deploys it.
- **Covers & remixes** — a compulsory-licence workflow per territory; half-right tells an artist a release is clear when it is not.
- **Territory: Mexico / Spanish-language** — zero Spanish-language rows in the catalog and a real artist who asked. Same shape as France: every department's knowledge plus crawl sources. The departments say "not a market we serve" instead of improvising. Revisit when a second Spanish-singing artist deploys it.
