---
name: label-departments
description: >
  Use when scoping a department or routing a question — which of our
  departments owns which question, where the label's scope lines are, and
  which department-or-skill verdicts are settled.
metadata:
  agent: recruit
  status: developed
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "2.0"
---

# The label's departments

Eleven departments serve the artist; one meta department hires them. **"Label" is
the product's name, not its boundary** — clearing one song puts a music
supervisor in front of "legal, label, talent management, agency, business
management" ([Guild of Music Supervisors](https://www.guildofmusicsupervisors.com/what-is-a-music-supervisor),
2026-09-08). Scope a request against the **function**, then name who owns it
here. How real labels staff each function, major versus indie, is
[`label-fundamentals.md`](../../label-manager/knowledge/label-fundamentals.md).

## The roster

| Department (slug) | Staff member | Owns the question | Never |
|---|---|---|---|
| `label-manager` | The Label Management Agent | what happens when, who does it, what the release is missing, the credits | dispatches work; the artist carries the brief |
| `rights` | The Rights Agent | who owns what, splits, societies, identifiers, W-8BEN and withholding, the catalog | files a registration, advises on a contract |
| `distribution` | The Distribution Agent | which distributor, what it costs over the artist's revenue, what a release must carry | delivers a release itself |
| `presskit` | The Presskit Agent | the bio, photos, one-sheet, the deck — built and kept current | pitches it; `press` does |
| `press` | The Press Agent | getting **written about**: journalists, reviews, premieres, the pitch and the pipeline | sends; radio and playlists |
| `promotion` | The Promotion Agent | getting **played**: radio stations, playlists, the editorial pitch, the charts | submits, buys streams |
| `digital-marketing` | The Digital Marketing Agent | the campaign, content, ads, platform conventions, the artist's website | posts on the artist's behalf |
| `platforms` | The Platforms Agent | what a metric means, how the numbers moved | fetches a number; the artist reports it |
| `agent-recruitor` (`recruit`) | The Recruiting Agent | how a department is scoped, agent vs skill, whether the roster still fits the contract | talks to the artist |

## The map — function to owner

Where the industry puts each function is sourced in
[`label-fundamentals.md`](../../label-manager/knowledge/label-fundamentals.md);
this table says only what we do with it.

| Function | Ours |
|---|---|
| A&R — finding and signing artists | ✗ the artist *is* the roster |
| Marketing — brand, social presence, the site | ✅ `digital-marketing`; the website is its `build-website` skill |
| Publicity — being written about | ✅ `press` |
| Promotion — radio and playlists | ✅ `promotion` |
| Release coordination — the sequence, gates, credits | ✅ `label-manager` |
| Rights administration — registration, splits, identifiers | ✅ `rights` |
| Publishing — administering and exploiting the song | ◐ `rights` covers registration, not administration or deals |
| Sync licensing — master and song licences | ✗ not yet; a department once a supervisor dataset exists |
| Live — venues, routing, tours, festivals | ✗ not yet; agency work, not label work |
| Funding — public and industry money | ✗ not yet; each funder publishes its own calendar |
| Artist assets — bio, photos, EPK | ✅ `presskit` |
| Data and analytics | ✅ `platforms`, self-reported figures only |
| Sales and distribution — records to stores and DSPs | ◐ `distribution` compares and prepares; it never delivers |
| Merch and direct-to-fan | ✗ Bandcamp and Shopify absorb the work |
| Expense records — the budget sheet | ◐ `label-manager` writes the plan's prices; the artist types what was spent |
| Business affairs and legal | ✗ no legal advice, no tax advice |

## Who owns a question

A department that gets a question outside its shelf names the owner rather
than answering.

- **Answer** anything that is *how does this work*, from the owner's `knowledge/`.
- **Route** the moment the artist wants something *done* — drafted, ranked, tracked.
- **Both, in that order.** Answer first, then name the staff member; a handoff with no answer is a brush-off.

| Topic | Owner | Knowledge |
|---|---|---|
| Societies, ISRC/ISWC/IPI, splits, registration, who owns what, cross-border tax (W-8BEN, withholding) | The Rights Agent | `rights/knowledge/` |
| Distributors, fee models, cuts, store coverage, delivery specs | The Distribution Agent | `distribution/knowledge/` |
| Press, reviews, interviews, premieres, press timing | The Press Agent | `press/knowledge/` |
| Radio quotas and stations, playlists, editorial pitching, airplay charts | The Promotion Agent | `promotion/knowledge/` |
| Campaigns, content, ads, platform conventions, the website | The Digital Marketing Agent | `digital-marketing/knowledge/` |
| Bios, EPKs, photos, visual identity | The Presskit Agent | `presskit/knowledge/` |
| What a platform metric means, how to read a trend | The Platforms Agent | `platforms/knowledge/` |
| The release sequence, who does what when, credits, what a label is | The Label Management Agent | `label-manager/knowledge/` |
| How a department is scoped, agent vs skill | The Recruiting Agent | this file |

**Nobody owns** publishing deal shapes and self-publishing (`rights` explains
collection, not deals), contracts (explaining is in scope, advising is not), and
recording and production (no agent makes music). A gap closes one of two ways:
a knowledge file on the nearest shelf when it is a question with an answer, or
a department when it is a body of recurring work — and that is this file's
decision.

## Where the scope lines are

House decisions, not industry claims. A department that needs to cross one is a
department we cannot ship.

1. **No agent makes music.** The agents do the paperwork so the artist does the art.
2. **No agent gives legal or financial advice.** How a registration works is knowledge; what to sign is not ours.
3. **No agent acts on the artist's behalf.** Everything is drafted and handed over — nothing is sent, submitted, or signed.
4. **Three markets: Quebec, Canada, the United States, as equals.** An artist elsewhere gets a "no, and here is why", not a scoping exercise.
5. **Language and country are different keys.** EN/FR cuts across Canada and parts of the US; the country decides which institutions exist. Knowledge is written in English, once; departments talk to the artist in the artist's language.

## Settled verdicts

One line each. A request that matches a row is not re-argued.

| Request | Verdict |
|---|---|
| Sync licensing | a **department**, once a supervisor dataset exists — `data/` before scaffold |
| Radio and playlist pitching | **`promotion`'s**, not `press`'s — the ask goes to a programmer either way; `press` keeps publicity |
| Airplay monitoring | `promotion`'s, as reading the charts; no department fetches spins |
| The presskit | a **department** — it creates and maintains the artifact, `press` uses it |
| Data and analytics | a **department** (`platforms`) — its numbers feed every other desk's pitch, application and campaign read |
| The artist's website | a **skill on `digital-marketing`** (`build-website`), not a department — no vocabulary of its own, every table it reads is another department's. The desk's old slug was `campaigns` |
| Quebec | **sections** inside every knowledge file, never a department — a `quebec` agent would fork every Canadian one |
| Distribution | comparing and preparing is **`distribution`**; delivering is not ours, as a product call |
| Merch and direct-to-fan | **out**, on the product reason — Bandcamp and Shopify absorb the work; the industry staffs it at both ends, so that reason does not hold |
| Business affairs and legal | **out** — the label gives no legal or tax advice |
| Publishing administration and deals | **out** — `rights` covers registration |
| A better bio, a cleaner one-sheet | a **skill on `presskit`** — a verb on a noun that department owns |
| Mastering, production | **neither** — crosses scope line 1 |
| Filing a registration for the artist | **neither** — crosses line 3; the worksheet is what we ship |
| Infrastructure — a question router, a knowledge-hub compiler, a cross-department explainer | a **build script**, not a staff member — every department answers its own topic itself, the runtime routes by `description:`, the hub is a build (on the roadmap) |

No industry body names a department for the EPK or for analytics; `presskit`
and `platforms` are kept anyway, a deliberate divergence recorded here so
nobody "corrects" it into a merge.

## Sources

- **Guild of Music Supervisors** ([what-is-a-music-supervisor](https://www.guildofmusicsupervisors.com/what-is-a-music-supervisor)) — the five parties a clearance goes through.
- **Our roster** — every `agents/<slug>/AGENT.md`, read 2026-09-08; the staff table in `agents/README.md` is generated from them.
- **Industry staffing** (Berklee role pages, Sub Pop's contact page, A2IM) — cited in [`label-fundamentals.md`](../../label-manager/knowledge/label-fundamentals.md), not restated here.
