---
name: press-manage-contacts
description: >
  Use when the artist wants to see or work their outreach list — filters the
  curated Quebec/Canada/US contact catalog by type, tier, region, and language,
  and says plainly which of their edits the system can keep and which it cannot.
metadata:
  agent: press
  status: developed
  greeting: show the journalists and outlets worth reaching
  greeting-fr: montrer les journalistes et médias à contacter
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# press-manage-contacts

**Status:** developed — the spec is complete; no code behind it yet.

Show the outreach list the whole department works from, filtered to what the
artist is actually pitching. The list is `catalog.press_outlets` — ours, global,
already populated, read-only to the artist, and made of MEDIA, never people: the
journalists the artist finds (Hunter, or by hand) live in `artist.contacts`.
Outlets are **shared across all campaigns**; only the pitch, release date, and
listen link are per-campaign.

## Data

**The catalog is ours, read-only, and ships as one file** —
`data/catalog/catalog.sqlite`, rebuilt every Monday. Read it with the query
script (`uv` runs it, and fetches a Python if the machine has none — works in
Claude Cowork, Desktop and Claude Code alike):

```bash
uv run data/catalog/query.py press --market quebec --type magazine     # outlets, desk, how to submit
uv run data/catalog/query.py press --q "canal auditif" --columns all
```

`--where col=value`, `--q <text>`, `--columns all`, `--json` cover the rest;
`uv run data/catalog/query.py --datasets` lists what the file holds. It holds
desks, never a person: the person behind a desk comes from the artist's own
Hunter key or from reading the outlet's contact page for them.

Two halves, two commands, and the seam between them is the point.

**The contact catalog is ours** — read it with the query script above, not
through `artist:get`. It holds no artist rows.

**What the artist has done with a contact is theirs:**

```bash
bun run artist:brief press
bun run artist:get press_pitches contact_slug=<slug>
bun run artist:get contacts catalog_slug=<slug>
bun run artist:set contacts '{"kind":"press","catalog_slug":"<slug>","outlet":"Le Devoir","name":"<name>","email":"<email>","source":"artist"}' --conflict email
```

`artist.contacts` holds the PERSON behind an outlet — found with the artist's
Hunter key, or typed in by them. This is also where the honest answer about
edits comes from. A re-ranked tier has nowhere to live:
`artist.press_contact_overrides` does not exist, and `artist:get` will say so
by refusing an unknown table. A pitch
row with a **null** `contact_slug` and the `saved_*` fields filled in is the
one supported way to carry a contact the artist added themselves.

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| the catalog | `catalog.press_outlets` | global and read-only here; ships in `data/catalog/catalog.sqlite` |
| filters | artist | `outlet_type`, tier, `market`, city, language, free-text across outlet / city / notes |
| edits | artist | a re-ranked tier or a relationship note — held in memory, not stored; a personal email goes to `artist.contacts` |
| new contact | artist | name + outlet required; lands in `artist.press_pitches` only once it is actually pitched |

## Process

1. **Read the catalog, never write it.** There is no seed step for the artist to
   run: `catalog.press_outlets` ships populated from its CSV.
   Filter it to the artist's markets, language, and outlet types.
2. **Say what an edit does and does not do.** A tier the artist re-ranks holds
   for the conversation and is gone at the next catalog refresh —
   `artist.press_contact_overrides` is proposed, not built. Say so at the moment
   of the edit rather than letting them assume it stuck. An email they found is
   different: it is saved to `artist.contacts` with `source = 'artist'`, after
   they say yes.
3. **A contact the artist adds has one home**: an `artist.press_pitches` row with
   a null `contact_slug` and the name, outlet, and email frozen onto it, written
   when they mark it pitched. Until then it exists only in the conversation.
4. **Read the catalog's defaults as they are** — tier 2, language `en`. A contact
   the artist adds carries no language column at all, so ask which language to
   write in rather than assuming the artist's own.
5. **Group for display**: Outreach (radio_community, radio_commercial, press,
   magazine, blog, tv_video) and Platforms & Resources (platform, industry_org). Sort
   tier-first, then outlet.
6. **Mark what has no email** as "Check web" rather than leaving it blank —
   blank reads as missing data, "Check web" reads as a form or physical
   submission, which is what it is.
7. **Flag the snapshot age** whenever a named person is about to be pitched:
   `lifecycle` (`active` · `unconfirmed` · `retired`) and `last_verified`.
8. **Offer to find the person behind a desk address.** Once the shortlist for
   the campaign's markets is agreed, and some of it has only `info@`-style
   addresses or none: if Hunter is connected, call `hunter_quote` with those
   slugs (free), then ask in one sentence with the cost it returned — "Want me
   to use Hunter to find the journalists at these 6 outlets? About 6 of your 50
   credits." Call `hunter_find_contacts` only after a yes. If it is not
   connected, say once that `houselabel connect hunter` does this (free plan: 50
   credits a month) and carry on. A person found replaces the desk address in
   the list.

## Output

The outlet list, sorted tier-first then outlet, in the two groups above. Each
outlet carries its name, `outlet_type`, `market` and city, website,
`submission_url`, `desk_email` (or "Check web"), tier (1 high → 3 low, with a
T1 badge on priority targets), language (`fr` | `en` | `bilingual`),
`genre_fit` tags, `submission_method`, notes, and `source` so curated and
crawled rows stay distinguishable. Any journalist the artist has on file for
that outlet (`artist.contacts`) prints under it. A missing `last_verified`
reads "never verified", not a blank.

A person in `artist.contacts` is shown in place of the outlet's desk address,
marked **found with Hunter** or **added by you**.

A tier the artist re-ranked in the conversation is shown applied, labelled
**not stored**, and named as belonging in `artist.press_contact_overrides`.

## Guidelines

- **Never claim an edit persisted.** The artist's corrections are the most
  valuable thing they could put in this list, and there is nowhere to put them
  yet. Overstating that is how a relationship note is lost silently.
- **Treat every row as a point-in-time snapshot.** Student-radio music directors
  rotate every semester and journalists move outlets.
- **Never invent contact details** to complete a record. Missing is a fact.
- What each outlet type actually wants, and how early, lives in
  [`../../knowledge/press-fundamentals.md`](../../knowledge/press-fundamentals.md).
