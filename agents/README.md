# The label's staff

Each folder here is one **department** of the label, embodied by one agent — a
staff member with a role, knowledge, and skills. This directory *is* the
product; runtime, GUI, and storage get built around it.

| Name | Description | Input | Output | Status | Status_Frontend | Skills | Knowledge | Database |
|---|---|---|---|---|---|---|---|---|
| [`presskit/`](./presskit)<br>**The Presskit Agent** · `presskit` | Fills the presskit in — reading the artist's own pages for what is already public — then produces the deck and puts it in their Drive. | A twelve-question intake, vibe first; everything already on file is offered back rather than asked. Bandcamp, Instagram, Facebook and YouTube are read directly where the artist links them. | A nine-slide deck in the artist's own Drive as Slides and PDF, versioned in `artist.presskit_versions` — cover, bio, a cover-art discography, platform audience, shows, awards, press with article screenshots, contacts and a gallery. | 🧪 beta | 📝 draft | `build` | `presskit-fundamentals` · `visual-direction` | `catalog.tools` · `artist.profile` · `artist.brand` · `artist.presskit` · `artist.presskit_versions` · `artist.presskit_items` · `artist.releases` · `artist.songs` · `artist.platforms` · `artist.platform_stats` · `artist.platform_latest` · `artist.memory` |
| [`press/`](./press)<br>**The Press Agent** · `press` | Gets releases written about across Quebec, Canada and the US — from contact list to tracked pitch. | Release date, markets, angle, and the artist's own voice (FR/EN). | A filtered contact list; a 120–250 word first-person master pitch; a per-contact `{subject, body}`; the current timeline stage with its checklist. | ✅ developed | 📝 draft | `compose-outreach` · `draft-pitch` · `manage-contacts` · `run-campaign` | `outreach-legal` · `press-fundamentals` · `press-writing` | `catalog.press_outlets` · `artist.profile` · `artist.press_campaigns` · `artist.press_pitches` · `artist.platform_stats` · `artist.presskit` · `artist.releases` · `artist.contacts` |
| [`promotion/`](./promotion)<br>**The Promotion Agent** · `promotion` | Gets the record **played** rather than written about — finds the stations and playlists worth reaching, names how each is entered and what that route costs, and drafts the pitch. | Release date and type, country, province, language and genre; a target to write to. | A ranked station list with a route and price per row; playlists split into editorial / independent / algorithmic with the editorial window's closing date; a route-shaped pitch draft with placeholders counted. | 🧪 beta | 📝 draft | `draft-pitch` · `match-playlists` · `match-radio` | `playlist-pitch` · `radio-pitch` | `catalog.promotion_radio_stations` · `catalog.promotion_playlists` · `catalog.promotion_radio_services` · `catalog.promotion_pitch_services` · `catalog.tools` · `artist.profile` · `artist.releases` · `artist.songs` · `artist.platform_latest` · `artist.memory` · `artist.contacts` · `artist.promotion_targets` |
| [`digital-marketing/`](./digital-marketing)<br>**The Digital Marketing Agent** · `digital-marketing` | Owns the artist's digital presence: turns a release into a phased, budget-aware campaign, and builds the website every campaign sends people to. | Campaign type, dates, budget, audience — gathered one question at a time. For the site: first language, domain, store, newsletter, Bandsintown — all skippable. | A phased plan with dated tasks and reconciled costs; platform-native captions, ad copy and hashtags; a one-file bilingual website rendered from the presskit, releases, platforms and booked shows, deployed to the artist's own Vercel. | 🧪 beta | 📝 draft | `build-website` · `draft-content` · `plan` | `content` · `genre-tactics` · `marketing-fundamentals` · `owned-audience` · `paid-promotion` · `platform-conventions` · `quebec-and-canada-market` | `catalog.tools` · `artist.profile` · `artist.projects` · `artist.marketing_campaigns` · `artist.marketing_ideas` · `artist.marketing_tasks` · `artist.platforms` · `artist.platform_stats` · `artist.presskit` · `artist.presskit_items` · `artist.presskit_versions` · `artist.releases` · `artist.brand` · `artist.website` · `artist.memory` |
| [`rights/`](./rights)<br>**The Rights Agent** · `rights` | Says which collection societies to join and keeps the member numbers, keeps a clean song & release catalog with both split sides, and explains who owns what. | Mostly the profile — country and province are offered back rather than asked cold. Then whether they write, perform or both, whether they own their recordings, and a file to import if there is one. | The per-side registration checklist, printed before the first question, with each org's own signup URL, cost, eligibility bar and tax form; saved member IDs and IPI; the song catalog with both split sides and share-total warnings; and answers about ownership with the source attached. | ✅ developed | 📝 draft | `manage-catalog` · `register-orgs` | `collaboration-rights-and-rates` · `rights-fundamentals` | `catalog.rights_orgs` · `catalog.tools` · `artist.profile` · `artist.registrations` · `artist.songs` · `artist.song_writers` · `artist.song_splits` · `artist.releases` · `artist.memory` |
| [`agent-recruitor/`](./agent-recruitor)<br>**The Recruiting Agent (meta)** · `recruit` | Creates and restructures departments — scopes the role against how real labels divide work, scaffolds the folder, proves it with evals. | A role the label is missing, or an existing department to audit, test, or grow a dataset for. | A conforming `agents/<slug>/` folder; a drift table (agent · file · what drifted · the fix); an eval grid with real outputs; a sourced research brief. | ✅ developed | 📝 draft | `agent` · `audit` · `dataset` · `debrief` · `evaluate` · `overhaul` · `research` | `label-departments` | `catalog.tools` · `catalog.crawl_sources` |
| [`platforms/`](./platforms)<br>**The Platforms Agent** · `platforms` | Records the numbers the artist reads on their own dashboards, explains what each metric measures, and reports change without inventing a cause. Fetches nothing. | Figures the artist types in, and questions about what a metric means. | A dated confirmation table (platform · metric · value); a definition with its window and source link; a per-platform delta table with sampling gaps labelled, never zero-filled. | ✅ developed | 📝 draft | `explain-metric` · `log-numbers` · `read-trend` | `metric-definitions` · `public-data-boundary` · `reading-a-trend` | `artist.platforms` · `artist.platform_stats` · `artist.platform_latest` · `artist.profile` · `artist.memory` |
| [`distribution/`](./distribution)<br>**The Distribution Agent** · `distribution` | Reads the distributor market *for this artist* and gets a finished release ready to hand over. Compares what each one costs, keeps and reaches; then turns a release into a validated delivery checklist. | Country and language, catalogue size, current distributor, streaming revenue, and the release being delivered — title, date, artwork, masters. | A shortlist ranked on six dimensions with the real cost of each cut, saved to `artist.saved_distributors`; and a per-release delivery checklist marked ready / missing / unknown. The artist signs up and uploads. | 🧪 beta | 📝 draft | `compare-services` · `prepare-package` | `delivery-requirements` · `distribution-fundamentals` · `distributor-knowledge` | `catalog.distribution_services` · `catalog.distribution_stores` · `artist.profile` · `artist.releases` · `artist.songs` · `artist.memory` · `artist.saved_distributors` · `artist.release_checklist` |
| [`label-manager/`](./label-manager)<br>**The Label Management Agent** · `manager` | Holds the calendar. Scopes a project, works backward from the street date, and hands each step to the department that owns it. | A project in the artist's words ("an album in March"), then a fixed question set. | A dated release plan with an owner on every line; a readiness report listing blocked gates first; a per-department brief with a handoff line; a CREDITS document for the release, with every missing credit routed to its owner. | 🧪 beta | 📝 draft | `brief-department` · `build-credits` · `check-readiness` · `learn-voice` · `plan-release` · `scope-project` · `weekly-recap` | `label-fundamentals` · `release-fundamentals` · `release-path` | `artist.projects` · `artist.project_phases` · `artist.project_milestones` · `artist.project_deliverables` · `artist.project_handoffs` · `artist.profile` · `artist.voice` · `artist.releases` · `artist.songs` · `artist.song_writers` · `artist.song_splits` · `artist.release_credits` · `artist.song_samples` · `artist.registrations` · `artist.presskit` · `artist.presskit_items` · `artist.memory` · `artist.marketing_campaigns` · `artist.marketing_tasks` · `artist.platform_stats` |

**Name**, **Description**, **Input** and **Output** are hand-written. **Status**,
**Status_Frontend**, **Skills**, **Knowledge** and **Database** are generated by
`bun run agents:sync` from each `AGENT.md` and its folders — skill names drop
the slug prefix, so `match-radio` is `/promotion-match-radio`. Schemas live in
[`data/`](../data).

### Status

Four rungs, each with a gate you can check. Picking the flattering one is the
defect — the same rule `last_verified` lives under.

| Status | Gate |
|---|---|
| 📝 `draft` | Scaffolded. Sections may still be missing; `## Tools` and `evals.json` are waived |
| ✅ `developed` | Markdown complete. `bun run agents:check` passes, every skill has an eval case, no code behind it |
| 🧪 `beta` | The deterministic half is code — the `scripts/` a `## Process` step names — and its evals run |
| 🚀 `production` | Served by [`engine/`](../engine) at runtime to a real artist |

`SKILL.md` and `knowledge/*.md` use the same four words, scoped to one file. A
skill is `beta` when its own `scripts/` exist; the department is `beta` when
its load-bearing ones do. Nothing is `production` yet.

### Status_Frontend

`status_frontend:` is the same four words on a **second, independent ladder**:
how far this department's GUI has come, not how far the department has. A
department can be 🚀 `production` in the terminal and 📝 `draft` on the web —
that is the normal case today, and the two columns exist so the table can say
so instead of averaging them into one misleading rung.

**Nothing computes it.** `status:` is earned — [`engine/modes.ts`](../engine/modes.ts)
reads the folder and refuses a rung the files don't support. `status_frontend:`
has no gate on purpose: the GUI ships when the artist says it ships.
`agents:check` verifies only that the word is one of the four, so the two
ladders can never grow two vocabularies.

Every department is 📝 `draft` until it is moved by hand.


**New department?** Don't hand-build it — ask
[the Recruiting Agent](./agent-recruitor). It owns the templates below and scaffolds
a conforming agent through six steps, stopping for your word at five of them.

## The shape (every agent, no exceptions)

```
<department>/
├── AGENT.md                       # identity — who they are, what they may do
├── knowledge/<topic>.md           # what they know: music-industry domain fact
├── skills/<slug>-<verb-phrase>/
│   ├── SKILL.md                   # what they can do: Input · Process · Output · Guidelines
│   ├── scripts/                   # optional — only when there is real code
│   ├── references/                # optional — docs only this skill needs
│   └── assets/                    # optional — templates the skill emits
└── evals/
    ├── evals.json                 # how we know it works — committed
    └── runs/                      # what came out — generated, gitignored
```

Four rules hold the shape together:

1. **A skill is a directory, never a loose `.md`.** `skills/x/SKILL.md` is what
   the [Agent Skills spec](https://agentskills.io/specification) defines, it is
   what every tool discovers, and it is the only shape that can carry a
   `scripts/` folder later. A flat `skills/x.md` works in Claude Code alone and
   is a dead end.
2. **Skill directory names are globally unique**, because every skill in the
   repo lands in one flat namespace once synced. The name is
   `<slug>-<verb-phrase>`, where `<slug>` is the agent's `slug:` frontmatter —
   `promotion-match-radio`, `press-draft-pitch`. Never repeat a word
   between the two halves: the Digital Marketing Agent's `plan-campaign` skill is
   `digital-marketing-plan`, not `digital-marketing-plan-campaign`.
3. **The directory name is the skill's name**, in the folder, in the
   frontmatter, and in the `/command`. One name on every surface.
4. **`knowledge/` is agent-wide, `references/` is skill-local.** Domain fact the
   whole department reasons from goes in `knowledge/`. A table only one skill
   ever reads goes in that skill's `references/`. Two scopes, two words.

## `AGENT.md`

The identity file. Its frontmatter doubles as a Claude Code subagent
definition, so the fields are the subagent fields.

```yaml
---
name: promotion                    # = folder name
description: >
  Use when the artist wants their record played rather than written about —
  finds the radio stations and playlists worth reaching ...   # when to DELEGATE here
slug: promotion                    # prefix for this agent's skill names
department: Radio & Playlist Promotion
discuss: explain how radio and playlists actually work   # the "or just …" clause of the greeting, EN
discuss-fr: t'expliquer comment la radio et les playlists fonctionnent vraiment   # and in French
staff-member: The Promotion Agent    # printed over every paragraph they say
status: draft | developed | beta | production   # the ladder above
status_frontend: draft | developed | beta | production   # the GUI ladder, hand-set
model: inherit                     # Claude Code only — sync.ts copies it verbatim
tier: fast | standard | deep       # houselabel only — which model engine/ pays for
tools: Read, Grep, Glob, Bash
skills: [promotion-match-radio, promotion-draft-pitch, ...]
data:
  catalog: [catalog.promotion_radio_stations]   # read-only, ours
  artist:  [artist.promotion_targets]           # read-write, theirs
  proposed: []                        # needed, doesn't exist yet — exempt from resolution
google: [calendar, gmail]          # the artist's Google account — [] is a real answer
services: []                       # outside services it may use — buffer, hunter; [] is a real answer
drive:                             # folders of the artist's Drive workspace
  write: []                        # what this department puts there — usually none
  read:  [artist/photos]           # what it may open, artist-supplied files included
author: Chloe Bibiane Pilon Vaillancourt
version: "1.0"
---
```

Six keys carry weight beyond documentation:

- **`data:` is checked against `data/`.** Every table under `catalog:` and
  `artist:` must be created by a schema there, and the staff table's
  "Data it touches" column must list the same set. A table a department needs but `data/`
  hasn't built goes under `proposed:` — that keeps the finding without faking a
  schema, and `agents:check` exempts it.
- **`tier:` decides which model `houselabel` runs for this department.** Not
  `model:` beside it — that one is Claude Code's, and `agents:sync` copies it
  into `.claude/agents/` where the only legal values are `inherit` and a Claude
  model name. Two runtimes, two vocabularies, two fields. `deep` for a
  department that *composes* something load-bearing — a release plan, a pitch a
  journalist will judge, an application in the artist's voice. `standard` for
  one that looks things up, ranks them, and explains. Nothing declares `fast`:
  fast is a *phase*, not a job, and `engine/` selects it for every interview
  regardless of what the department asks for. `agents:check` refuses a shipped
  `AGENT.md` without it.
- **`google:` is required on every `AGENT.md`, `[]` included.** It says what
  this department may do with the artist's connected Google account, and it is
  the only thing that decides: a department that declares nothing gets no
  Google tool at all, the same way one that declares no catalog table gets no
  catalog tool. `drive` uploads finished documents to their Drive. `calendar`
  puts dated work on a calendar they picked. `gmail` turns a finished email
  into a prefilled compose link — it **cannot send**, by design, because
  `press` and `promotion` both promise "drafts, never sends" and Google's
  draft-writing scope is a restricted one. An empty list is a decision, not an
  omission, which is why the key is required: a department with no line has not
  been considered, and that is how a roster-wide feature ends up half rolled
  out. Adding a capability the engine does not build yet is four coordinated
  edits: [`engine/google/README.md`](../engine/google/README.md).
- **`services:` is required on every `AGENT.md`, `[]` included.** It names
  the outside services this department may use, with the artist's own key —
  `buffer` and `hunter`. The engine never hands a service's own tools to the
  model: [`engine/buffer/tools.ts`](../engine/buffer/tools.ts) builds a fixed
  set (for Buffer: list channels, save a **draft**, list drafts — it cannot
  publish), and [`engine/hunter/tools.ts`](../engine/hunter/tools.ts) quotes
  before it spends (for Hunter: a free quote, then a lookup that runs only that
  quote and saves the people found to `artist.contacts`). The artist links the
  account with `houselabel connect <service>`. Adding a service is a new `engine/<service>/` folder plus its value
  in `SERVICES`, in both [`engine/frontmatter.ts`](../engine/frontmatter.ts)
  and [`sync.ts`](./sync.ts).
- **`drive:` is required on every `AGENT.md` too, both lists included.** It
  names which folders of the artist's Drive workspace this department may write
  to and which it may only read. The OAuth scope is full `drive` — the artist
  fills most of the workspace by hand, and the narrow scope could not see those
  files — so this list is the only boundary that actually holds, and it is
  per-department. Tokens, not paths: `artist/presskit`, `artist/photos`,
  `artist/brand`, `releases`, `releases/audio`, `releases/artwork`,
  `releases/lyrics`, `releases/digital-contents`. `write` is empty for most
  departments, because six of the seven leaf folders are filled by the artist.
  Naming any folder in either list requires `drive` in `google:`, or the
  department is handed folders it has no tool to open — `agents:check` refuses
  that, an unknown token, and a missing key. The tree and who owns which
  branch: [`engine/google/WORKSPACE.md`](../engine/google/WORKSPACE.md).
- **`delegable: false` keeps a department out of `.claude/agents/`.** Set it
  when the department has to stop mid-run and ask the artist something. A
  subagent runs to completion in its own context with no channel back, so its
  gates would silently become suggestions. The Recruiting Agent and the Label Management Agent
  set it today — both stop to ask before they commit to a shape.

Then these sections, in this order, in every `AGENT.md`:

| Section | Holds |
|---|---|
| `## Role` | One paragraph. What this staff member is for, in the artist's terms. |
| `## Skills` | Table: skill · what it does · status. Mirrors `skills/`. |
| `## Guidelines and rules` | The behaviour contract — industry practice *and* the honesty rules ("never invent a deadline", "draft, never send"). |
| `## Knowledge` | `### Industry knowledge` (index into `knowledge/*.md`) then `### Related data` (which tables, which half, read or write). |
| `## Tools` | The third-party tools this department recommends to the artist — which [`catalog.tools`](../data/catalog/tools) categories it draws from, and any tool it suggests that isn't in the catalog yet. |
| `## Memory` | What this agent carries between conversations that **is not already a column**. Per artist for the departments that serve one, per repo for meta agents like the Recruiting Agent. A bullet mirroring `artist.press_pitches` or `presskit.visual_identity` is a second home for one fact. |

### `## Tools` — recommended, not required

Distinct from the `tools:` frontmatter key, which lists the *agent runtime*
tools (Read, Bash, WebSearch). `## Tools` is what the staff member tells the
**artist** to use: Canva for a cover, Songtrust for publishing admin, Later for
scheduling. Those live in `catalog.tools` — 49 curated rows across nine
categories (design, social, distribution, analytics, marketing, collaboration,
rights, website, promotion), hand-picked and not crawled.

An agent names the categories it draws from and **never lists the rows**. Two
departments copied a whole category out — every `design` row, every `promotion`
row — which is the single source becoming two sources the moment the catalog
changes. When a department needs a tool the catalog
doesn't have, list it under **Proposed** with its URL and category — the
Recruiting Agent researches it and it becomes a `catalog.tools` row in `data/`, after
which it drops out of the Proposed list. A tool named in an `AGENT.md` and
nowhere else is drift, and `recruit-audit` flags it.

A proposed tool must fit one of the nine categories. One that fits none is a
signal the category list needs a tenth — which is a schema change in
[`data/catalog/tools/schema.sql`](../data/catalog/tools/schema.sql), not a
free-text category invented in an `AGENT.md`.

**Write the toolkit, not the definition.** The three paragraphs above are what
`## Tools` *is*, and they live here, once. A department's own section opens with
its actual tools. The same holds for every section in the contract: an
`AGENT.md` that explains what its headings mean is carrying seven copies of
this page.

## Every agent is talking to an artist

The reader is a musician. They did not clone this repo, they do not know what a
schema is, and a run that says "saved to `artist.project_phases` as week offsets"
has told them nothing and made them feel stupid for it. This applies to every
department, not only the ones that ask questions.

- **Never name a table, a column, an offset, or a command in artist-facing
  output.** "I'll keep it" is the sentence. `artist.projects`, `sort_order`,
  `W-9`, `bun run`, "upsert", "row", "the schema" are not.
- **Resolve storage formats before they reach a human.** Week offsets, slugs,
  enum values and uuids are how data is kept, never how it is read out. A
  department slug is a folder name; the artist hears "Press Agent".
- **A script's output is not automatically artist-facing.** Where a script emits
  both, mark the operator half — this repo uses lines beginning with `#` — and
  say in the `SKILL.md` that those lines are never relayed.
- **One question per turn.** An interview shows the question and a count. A
  status table of everything answered and everything remaining, reprinted every
  turn, is a form, and the artist reading it said so.
- **No "Sources:" block of file paths, no line numbers, no ids.** A source the
  artist can use is a URL or an organisation's name. `rights-fundamentals.md line
  337`, `campaign b522d55f…`, `/Users/…/knowledge/playlist-pitch.md` are for the
  operator. When a department finds a defect (a stale row, a missing table), it
  says the artist-facing consequence in one sentence and puts the diagnosis on
  lines beginning with `#`, which are never relayed.
- **Never tells the artist to run a command or a skill.** "Run
  `artist:set releases …`" and "next, run `rights-register-orgs`" are
  instructions to the machine. The department does the write itself, or says
  "I'll record that" — the artist never types anything but their own words.
- **Reads the opening message before question 1.** An artist who opens with
  "I'm on CD Baby, three releases, $50, Canada" has answered four questions;
  the interview starts at the fifth. Re-asking what the opener said is the
  failure `indie-persona` and `odile-ray` both catch.

**Every `AGENT.md` carries this rule as its own bullet** — literally
`**Speaks to the artist, never about the machine.**` under `## Guidelines and
rules` — and `agents:check` refuses a department without it. Twelve departments
were caught leaking table names, commands and file paths to personas on
2026-09-05; a rule that lives only in this README is one nobody reads at the
moment they need it.

The exception is a deliberate one: when the artist asks how something works,
naming the real thing is the answer. A question is answered by the department
itself, citing files and URLs, because that is the point of the shelf.

## `SKILL.md`

Frontmatter is **spec-only** — `name`, `description`, and everything else nested
under `metadata`. This is not pedantry: packaging or uploading a skill with an
extra top-level key fails hard with `Unexpected key(s) in SKILL.md frontmatter`,
so a skill that carries `status:` at the top level can never leave this repo.

```yaml
---
name: promotion-match-radio        # = directory name
description: >
  Use when the artist wants radio play — ranks catalog stations against the
  release, with each one's submission route and cost ...   # when to TRIGGER
metadata:
  agent: promotion
  status: developed                # draft | developed | beta | production
  mode: task                       # the only mode — see below
  greeting: find rooms that fit your show              # the clause after "I can", EN
  greeting-fr: trouver des salles qui collent à ton spectacle # and in French
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---
```

### `mode:` and `greeting:` — what the artist is offered

A department opens with one paragraph, generated from its skills — never
hand-written, so a skill cannot be missing from the greeting of the department
that owns it:

> Hey! I'm the Distribution Agent. I can help you find the distributor that
> fits you, and what switching would cost, help you prepare your release
> package for that distributor, before it gets rejected, or just discuss
> digital distribution in general. What do you want to do today?

The artist answers in a sentence. [`engine/greeting.ts`](../engine/greeting.ts)
reads it: a sentence that asks for a task starts that task's interview; anything
else is a conversation, which the department has itself — from `knowledge/` and
the artist's own records, source attached. There is no `discuss` skill. There
was one per department, and each was the same three rules copied.

| Line | Where | What it is |
|---|---|---|
| `mode: task` | `SKILL.md` | The engine runs this skill as a deterministic interview: `scripts/questions.ts` holds the question set, [`engine/interview/`](../engine/interview) holds the state. The only mode. |
| `greeting:` / `greeting-fr:` | `SKILL.md` | The clause after "I can". Every skill has one, wired or not. |
| `discuss:` / `discuss-fr:` | `AGENT.md` | The clause after "or just". Required; `agents:check` fails without it. |

A skill that declares no `mode:` cannot be started from a sentence, and a task
with no `greeting:` cannot be offered; either keeps its department off 🚀
`production`. [`engine/modes.ts`](../engine/modes.ts) computes what each
department has earned and `bun run test` fails when an `AGENT.md` claims more.
The pass that wires all of this is
[`/recruit-overhaul`](./agent-recruitor/skills/recruit-overhaul).

`greeting:` is separate from `description:` on purpose. A description says when
to TRIGGER the skill and is written for a model — reading "Use when the artist
wants radio play — ranks catalog stations against the release, with each one's
submission route and cost" to a musician is the same failure as printing a table name.

Then these sections, in this order, in every `SKILL.md`:

| Section | Holds |
|---|---|
| `## Data` | The exact commands that reach `artist.*` — `bun run artist:brief <slug>` plus any `artist:get` / `artist:set` / `artist:remember`. Omit only when the skill touches no artist data. |
| `## Input` | Table: field · where it comes from · notes. Name the source — the brief, a specific `artist:get`, the catalog, the conversation. |
| `## Process` | Numbered steps the agent actually follows. The load-bearing section: it is what makes two runs of the same skill agree. |
| `## Output` | The exact shape returned, formatting included. Say what a missing value looks like. |
| `## Guidelines` | Rules that constrain the process — what never to invent, what never to send, what to disclaim every time. |

**`## Data` names a command, never a table.** "Reads `artist.profile`" tells the
agent nothing it can run — it has `Bash` and no way to query a database. The
selection rules a skill depends on live in
[`data/artist/brief/rules.ts`](../data/artist/brief/rules.ts), tested, so two
runs agree; `## Data` points at them rather than restating them as prose the
model re-decides. Every department needs an entry in that file's `RULES` map —
`bun test data/artist` fails when the map and the folders under `agents/`
disagree, because a missing department falls through to the core brief and
looks like it worked.

**No department writes `artist.profile`.** It is `read` in every `## Data`
table and it stays that way. The artist maintains that row themselves with
`houselabel profile`, because it is what every other answer is derived from —
which stations appear, which language a pitch is written in, which distributors
are in reach — and an agent editing it mid-conversation changes work it is not
part of, with no record of who decided. The rule is enforced, not requested:
`artist_set` in [`engine/tools.ts`](../engine/tools.ts) cannot name the table,
`bun run artist:set profile` is refused before it opens a connection, and
`bun test data/artist/ownership.test.ts` fails if either gate is removed. When
an artist tells a department something that belongs there, say you have noted
it and point them at the command.

**Guidelines are not a recap of Process.** Process says what to do and in what
order; Guidelines say what must never happen regardless of order. If a bullet
restates a numbered step, delete the bullet — the step already owns it. Seven
instances of that duplication were found across two departments in one audit.

### When a skill needs a `scripts/`

A `## Process` step that is **deterministic, repeated, and checkable** should be
code the skill runs, not prose the model re-derives. Prose re-derives it
differently every time, which is exactly what an eval catches as flakiness.

Deterministic and repeated → `scripts/`. Judgment → prose. The line is usually
obvious once you ask whether two correct runs could legitimately differ.

**If the prior build had to enforce it in code, a stronger sentence will not do
it here.** the first House Label learned this with money: its prompt told the model to
keep task costs within the artist's budget, nothing checked the arithmetic, and a
live campaign stored a total of $99,500 against tasks summing to $9,781 — about
$89.7k of phantom unallocated spend. The fix was a reconciliation function on
every persist path. Ours said *"Budget is a hard constraint, not a target"* and
shipped no arithmetic. When a review finds an incident like that, the rule it
earned belongs in `scripts/`, not in a firmer adjective.

| Belongs in `scripts/` | Stays prose |
|---|---|
| Digital Marketing's budget reconciliation across a campaign's tasks | Which tasks are worth paying for |
| Royalties' share totals and `MISSING`-sentinel extraction | Which society the artist should join |
| Press's stage from weeks-until-release | What the pitch should say |

Two departments have crossed the line. `digital-marketing-plan` runs
[`reconcile-budget.ts`](./digital-marketing/skills/digital-marketing-plan/scripts/reconcile-budget.ts),
because a review found the incident that proves prose can't hold it; all four of
the Label Management Agent's skills read and count in `scripts/`. The rest are
`status: developed`. The point is that the Process section already names them,
so the script has a spec to be written against. When
[`recruit-evaluate`](./agent-recruitor/skills/recruit-evaluate)
sees several eval runs independently reimplementing the same computation, that
is the signal to bundle it: write it once, put it in `scripts/`, and have
`SKILL.md` tell the agent to run it. A skill at `beta` is one whose
deterministic half is code.

## `knowledge/<topic>.md`

Domain fact, sourced, written for the artist's question and readable on its
own — these files also feed the label's public documentation of the industry.
The reference is
[`rights/knowledge/rights-fundamentals.md`](./rights/knowledge/rights-fundamentals.md):
**structured, concise, dense, rich.** Same frontmatter as a skill (`name`,
`description`, `metadata`); `name` equals the file name.

### What a department's folder holds

One `<dept>-fundamentals.md` — how this part of the industry works — and the
few specific files its skills read every time: a registry, a procedure, a
market file. The file count matches the department's breadth, not its history.
Quebec, Canada and the US are three equal sections or columns, never a Canada
file with Quebec as a bullet.

### What is not knowledge

| It is | It goes |
|---|---|
| A spec the code enforces — score weights, column names, retry ladders, `--engine` flags | the skill's `references/`, or a comment beside the code. Where prose and code disagree, the code wins |
| Rows a catalog table holds — outlets, distributors, help-centre URLs | `data/catalog`; the file names the table and the route to it |
| How this repo is built, why a page exists, what moved where | nowhere. No history, no "ported from" |
| A rule the agent must obey | `AGENT.md` → Guidelines and rules |

### Shape

- One clause per fact. Bullets and tables, never a paragraph that could be a
  bullet. A file that could be half as long with no fact lost is too long.
- Headings a reader jumps to; a repeating sub-pattern where the topic repeats.
  The shape serves the content — a registry is a table, a procedure is a
  numbered list, a comparison is a matrix.
- Every claim carries its source where it stands — a dated URL, a statute, a
  named report — or says in the same sentence that nobody publishes it. A
  `## Sources` index at the end is welcome; it never replaces the inline source.
- **No `## Open questions`, no `## Sources to answer them from`, no `## What
  the numbers say`.** A question is answered or cut; a number's source sits
  beside the number. `agents:check` refuses all three, and any `- [ ]`.
- One owner per fact. A sibling department links; it never restates.
- Names are kebab-case noun phrases that say what is inside —
  `playlist-pitch.md`, not `playlist.md`.

### `last_verified`

`YYYY-MM-DD`: the day the claims were read off their sources. The only legal
value. A file with nothing to verify is not a knowledge file; a file nobody
verified is not shipped.

### What counts as a source

The citation standard every `knowledge/` file and every answer obeys.
The ladder is the same in both countries; the institutions on each rung are not.

| Tier | What it is | Canada | United States | Use it for |
|---|---|---|---|---|
| 1 | The institution that runs the thing | socan.com · resound.ca · cmrra.ca · cb-cda.gc.ca | themlc.com · ascap.com · bmi.com · soundexchange.com · copyright.gov · crb.gov · irs.gov | rates, eligibility, deadlines, how to register |
| 2 | A government or funder program page | canadacouncil.ca · calq.gouv.qc.ca · musicaction.ca · factor.ca | arts.gov · grants.gov · nasaa-arts.org | what a program funds and who may apply |
| 3 | A trade association or non-profit | artisti.ca · connectmusic.ca · racs.actra.ca | usisrc.org · newmusicusa.org | sector structure, identifiers |
| 4 | Practitioner writing, named author | none identified — a real gap | aristake.com | how the work actually gets done |
| 5 | Vendor content marketing | a distributor's blog on distribution | an admin's blog on publishing | last resort, labelled as the vendor's own account |

- **A vendor explaining its own product category is marketing.** A tier-5 link
  never carries a rate, a deadline, or an eligibility rule on its own.
- **A platform documenting its own product is tier 1 for that product only.**
  `artists.spotify.com` is authoritative on how Spotify for Artists works and
  carries no weight on what streaming pays.
- **Every claim carries a URL, or a link to the sibling file that owns it** —
  never a line number, which rots on the next edit — a country when it differs
  across the border, and a date whenever it states a magnitude. Name who
  published it: "SOCAN's own page says" and "a distributor's blog says" are
  different sentences.

| Kind of claim | Clock | Example |
|---|---|---|
| Statutory rates | annual, on a published schedule | the US mechanical rate is COLA-adjusted each January ([37 CFR § 385.11](https://www.law.cornell.edu/cfr/text/37/385.11)) |
| Tariffs before a board | per proceeding, years long | SOCAN tariffs at the [Copyright Board of Canada](https://www.cb-cda.gc.ca/en/cases-tariffs/proposed-tariffs/socan) |
| Program deadlines and amounts | per intake, often annual | grant program pages |
| Platform payout and share figures | continuous, unannounced | streaming per-stream figures |
| Institutional structure | rarely | what a PRO is, what SoundExchange collects |

Structure can be cited from an old page. A number cannot.

## `evals/`

Everything about whether the department works — the cases and their results.

```
<department>/evals/
├── evals.json              # the cases. Committed: this is a spec, like SKILL.md
└── runs/                   # what came out. Generated, gitignored
    └── iteration-<N>/
        ├── case-<id>/
        │   ├── with-agent.md    # the real output, for the human to read
        │   ├── ablated.md       # same prompt, this department's markdown withheld
        │   └── grading.json     # assertion → pass/fail + the evidence span
        └── summary.json         # both arms' pass rates, regressions vs N-1
```

`evals.json` is committed because a case is a claim about what the department
owes the artist — it belongs in review alongside the `SKILL.md` it tests.
`runs/` is not: it is large, regenerable, and re-running it is one command. Keep
the two apart, or the diff on a knowledge fix drowns in generated output.

Cases are agent-level, not per-skill, because the thing we need to pass is end
to end: *"My single drops in 3 days, can I still get on Spotify editorial?"*
crosses dates, eligibility, and ranking. Each case names the skill
it exercises.

### An assertion must be checkable from the output alone

A case is graded against the text the agent produced. Anything else is
ungradeable, and an ungradeable assertion passes silently forever:

| Not checkable | Why |
|---|---|
| "Nothing is saved on a refused transition" | database state, not output |
| "Composing does not change any pitch status" | a side effect, invisible in a draft |
| "The word EPK does not appear in the deck" | the deck is a Slides file no grader opens |
| "Paid tasks support existing content rather than being the strategy" | subjective |

**State the case depends on goes in `given`**, not in the assertion. Without it
an assertion like "reuses an IPI already captured for another society" passes
vacuously against an empty database:

```json
{
  "id": 3,
  "skill": "rights-track-registrations",
  "given": { "artist.registrations": [{ "org_slug": "socan", "org_details": { "ipi_number": "00052210040" } }] },
  "prompt": "Mark my ASCAP registration as done, member ID 12345.",
  "expected_output": "...",
  "assertions": ["Does not re-ask for the IPI"]
}
```

`given` is a map of table → the rows that must exist before the case runs. Omit
it when the case needs nothing. A case whose assertions depend on prior state
and has no `given` is the defect this key exists to make visible.

```json
{
  "agent": "promotion",
  "evals": [
    {
      "id": 1,
      "skill": "promotion-match-radio",
      "prompt": "I'm releasing a French-language pop single on November 14. Which Quebec radio stations should I send it to?",
      "expected_output": "A ranked list of Quebec campus and community stations, each with its published submission route and the cost of that route.",
      "assertions": [
        "Every station named appears in catalog.promotion_radio_stations — no station is invented",
        "A station with no published submission route is printed as UNKNOWN",
        "Any price shown carries its verification date"
      ]
    }
  ]
}
```

Assertions are objectively checkable statements about the output. Subjective
qualities (does the pitch read well) are reviewed by a human, not asserted.

## How this reaches Claude Code and Cursor

Neither tool reads a manifest — **there is no JSON registry to write**. Both
scan the filesystem, and both look in places that are not `agents/`:

| Tool | Reads | Gets its name from |
|---|---|---|
| Claude Code — skills | `.claude/skills/<name>/SKILL.md` | the **directory** name → `/name` |
| Claude Code — subagents | `.claude/agents/**/*.md` | frontmatter `name` |
| Cursor | `.cursor/skills/`, `.agents/skills/`, and `.claude/skills/` | any `SKILL.md` it finds |

So `agents/` stays the source of truth and one command generates both surfaces:

```bash
bun run agents:sync
```

It writes a symlink per skill into `.claude/skills/` (Claude Code follows
symlinks and reads `SKILL.md` from the target; Cursor reads the same folder),
and one generated subagent per department into `.claude/agents/`, with that
department's skills preloaded. Both are committed, so a fresh clone works
without running anything.

`bun run agents:check` is the same program with `--check`: it verifies the
format contract **and** recomputes everything `agents:sync` would write, then
compares. It writes nothing and exits 1 on either kind of drift — a subagent
behind its `AGENT.md`, a missing or misdirected symlink, a generated subagent
no department produces any more, or the staff table's derived columns. Run it
before pushing; CI runs the same command.

## House style

Two audiences, one rule: **lead with the action, cut everything else.**

**What agents write to the artist** follows
[`i-have-adhd`](../.claude/skills/i-have-adhd/SKILL.md), vendored into
`.claude/skills/`. Every department inherits it. The rules that bind hardest:
first line is something the artist can do · number multi-step work · restate
where we are each turn · cap lists at five · specific time estimates, never "a
bit of work" · no preamble, no recap, no "let me know if you need anything else."

**What we write in these files** follows the same instinct:

- **Bullets by default.** Prose only when a rule needs a *why* a bullet can't
  carry — and then one or two sentences, not a paragraph.
- **One idea per bullet**, lead word bolded. If a bullet needs "and also", it's
  two bullets.
- **Two sentences is the ceiling.** Longer means the idea isn't sharp yet.
- **No throat-clearing.** Cut anything that sets up, restates, or explains what
  a section is. The contract defines the sections once, here.
- **Tables beat lists of pairs.** Anything with a repeated shape — inputs,
  scores, symptom→fix — is a table.
- **Claim, then stop.** The commonest defect here is asserting a rule and then
  appending its justification as an em-dash aside. "Prefer a skill to an
  agent — a new department is expensive" is two sentences pretending to be one;
  the second is a recap of a decision the first already made. Keep the em-dash
  for a genuine appositive, not for the reason you just gave.
- **Cut, then cut again.** A department nobody rereads is a department nobody
  trusts.

Two references worth reading and not vendoring:
[`signs-of-ai-writing`](https://github.com/softaworks/agent-toolkit/blob/main/skills/writing-clearly-and-concisely/signs-of-ai-writing.md)
(Wikipedia editors' field-tested list of LLM tells) and Strunk's rule 13, omit
needless words. Neither is installed: a scan of this folder found zero instances
of the vocabulary they target. The defect here is structural, not lexical.

Applies to `AGENT.md`, `SKILL.md`, and `knowledge/*.md` alike.
`recruit-audit` flags files that drift back into prose.

## Shared principles (apply to every agent)

1. **One artist profile feeds everyone.** Agents never re-ask what the profile
   or another agent's memory already knows.
2. **Memory.** Each agent keeps per-artist notes and updates them as it works.
   Declared in `AGENT.md`, stored at runtime later.
3. **Draft, don't act.** Agents draft applications, pitches, and emails; the
   artist reviews and sends. No agent submits anything on the artist's behalf.
4. **Canada + US, accurately.** Country-specific claims live in
   country-sectioned knowledge files.
5. **Cite real things.** Organizations, programs, and rules by their real names;
   no invented amounts or deadlines.
