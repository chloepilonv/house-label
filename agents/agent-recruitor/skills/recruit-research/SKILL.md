---
name: recruit-research
description: >
  Use before scaffolding a department, or when an existing one needs its
  industry footing — researches the role online: how the job is actually done,
  which third-party tools artists use for it, and whether it needs a crawlable
  dataset. Produces sourced findings with URLs, never remembered claims.
  Triggers on "research this role", "what tools would a content creator need",
  "do we need to crawl anything for this?".
metadata:
  agent: recruit
  status: developed
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# recruit-research

**Status:** developed — the spec is complete; no code behind it yet.

A department invented from memory is full of plausible-sounding wrong facts.
This goes and looks: how the job is really done, what practitioners use, what
data the agent would need that we don't have.

Everything it produces carries a URL. A finding without a source doesn't ship.

## Input

| Field | From | Notes |
|---|---|---|
| the role | conversation | at whatever resolution it arrived |
| country scope | profile or conversation | CA, US, or both — blending them is the failure |
| existing catalog | `catalog.tools`, `catalog.crawl_sources` | research fills gaps, doesn't re-derive |
| existing knowledge | `agents/*/knowledge/*.md` | a neighbour may already have answered part of this |
| **the prior build** | the first House Label (private — skip if you have no access) | this role probably shipped there once — read it before the web |
| the web | WebSearch / WebFetch | industry press, practitioner writing, organizations' own pages |
| **which sources refuse a fetcher** | [`references/source-access-map.md`](./references/source-access-map.md) | read before searching — the shared 200-call budget, the hosts that 403, and the mirrors that work |

## Process

1. **Frame the questions before searching.** Three fixed — how is this job done,
   what do practitioners use, what recurring data would the agent need — plus
   whatever the role raises. Searching without questions returns a summary of
   the internet.
2. **Mine the first House Label first, if you have access — for its scars, not its code.** This role
   likely ran in production there, and what it learned the expensive way is
   worth more than anything a search returns. Extract four things:

   | Look for | Why it matters | Example found in `grant-finder.md` |
   |---|---|---|
   | **Scoring rubrics** | a department that ranks by vibes ranks differently every run | 100 pts: country +20, region +20, discipline +20, stage +15, type +15 |
   | **Hard gates** | what to skip outright, before scoring | country mismatch → skip; provincial source + region mismatch → skip |
   | **Incidents** | a rule with a date and a body count is a rule that was earned | a run retired 137 programs; CALQ lost 50 of ~62 → the ≥60% partial-crawl guard |
   | **Honesty rules** | where the old system learned not to fabricate | deadlines stored only when the source stated a year — never invent one |

   **It is context, not authority.** Its docs are internal notes, not an
   industry source, and the weight of a finding depends on what kind it is:

   | Kind | Weight | Because |
   |---|---|---|
   | An **incident** — dated, with a consequence | **Evidence.** Carry it over | it happened; the cost is real |
   | A **design choice** — a rubric, a threshold, a weight | **A starting point to argue with** | it was one team's judgment, never externally validated |
   | An **industry claim** — how the business works | **Unsourced until re-verified** | citing our own old docs is circular; find the real source |

   Never cite the first House Label as the source for a claim about the industry.
   Cite it for what it *did* and what that cost. Where its design was weak, say
   so and beat it. Note every improvement, so the gain is deliberate.
3. **Research the practice**, at independent scale, per country in scope.
   Practitioner and organization sources over listicles; keep contestable quotes
   with their URL.
4. **Research the tools.** Name, URL, category, pricing tier, free plan or not.
   Check against the existing 49 rows first — a design tool has to beat Canva,
   not duplicate it.
5. **Decide whether it needs a dataset.** Filter a body of records → a
   `catalog.<slug>_<noun>` table. Read domain fact → knowledge only. Paywalled,
   login-walled, or unstable → say so; that is the finding.

   If it needs one, the output is a **work order against the real contract in
   [`data/catalog/crawl/types.ts`](../../../../data/catalog/crawl/types.ts)** —
   read that file, don't recall it. As of this writing it wants:

   | Deliverable | Where | Registration |
   |---|---|---|
   | `schema.sql` | `data/catalog/<topic>/` | none — `migrate.ts` auto-discovers the folder |
   | `crawl.ts` exporting a `Crawler` | same folder | none — `topic` must match the folder name |
   | `catalog.crawl_sources` rows | the database, not code | **the URLs live here.** The crawler discovers new ones, and code cannot write to code |
   | `datasets.ts` entry | `data/catalog/publish/` | **required** — sets `completeness` and any restricted columns |

   `Crawler` is a mapping only: `topic`, `table`, `conflict` (the upsert key),
   `identity`. Extraction config — a Tinyfish query, a `waitFor` selector — is a
   field on the source row, because the engine tries Tinyfish and falls back to
   Puppeteer per source. Naming what to crawl is in scope; writing the SQL is a
   `data/` branch.
6. **Separate sourced from uncertain**, as two explicit lists. Unsourced goes in
   the second, not into the first with softer wording.
7. **Hand the findings to `recruit-agent`.**

## Output

A findings brief in four parts:

- **How the work is done** — sourced claims, country-sectioned where they differ.
- **Tools** — table (name · URL · category · what it does · free tier?), marked
  already-in-catalog or proposed-new.
- **Data** — "no dataset: reads knowledge", or the proposed table with its
  source, crawlability, and staleness.
- **Prior build** — what the first House Label already learned: its rubrics, gates,
  incidents, and honesty rules, each with the file it came from. Plus where we
  intend to beat it.
- **Open questions** — what couldn't be sourced, and what it would take.

Nothing in the first four parts appears without a URL or a `file:line`.

## Guidelines

- **Never let research become invention.** "I couldn't find a reliable source
  for typical rates" is a finding; a number with no URL is a bug.
- **Quantify, or the department can't prioritize.** "TikTok matters for
  discovery" orders nothing; "~N% of discovery for artists under 10k monthly
  listeners (source, date)" tells the Digital Marketing Agent what to lead with.
- **Magnitudes become the agent's ordering.** Where evidence shows one channel
  dominating, the department's Guidelines rank it first and say why. Listing
  options alphabetically is giving bad advice politely.
- **A number without a source is worse than no number.** Cite it with a date, or
  make the qualitative claim and mark it as one.
- **Prefer independent data to vendor data.** A distributor's blog proving its
  own channel dominates is marketing.
- **Date magnitudes separately from structure.** Platform share moves yearly;
  SOCAN's mandate doesn't.
- **The artist's own numbers beat the industry average.** A median is what you
  use in the artist's absence.
- **Check the catalog before proposing a tool** — say what it does that the
  existing row doesn't.
- **Every proposal names one of the nine categories.** Fitting none means the
  list needs a tenth, which is a schema change in
  `data/catalog/tools/schema.sql`, not a free-text value that fails the check
  constraint.
- **Favour tools an independent artist can afford.** Note the free tier, or its
  absence.
- **Date the findings** so a later reader knows what to re-verify.
- **Don't research what a neighbouring department already knows.** Overlapping
  knowledge files diverge, then contradict.
- **Country-section anything that differs.** A blended CA/US answer is wrong in
  both.
