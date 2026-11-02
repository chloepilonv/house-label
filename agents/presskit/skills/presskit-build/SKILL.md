---
name: presskit-build
description: >
  Use when the artist is filling in their presskit — a warm,
  one-question-at-a-time interview that mines existing data first, then
  persists every fact through a tool the moment it's shared.
metadata:
  agent: presskit
  mode: task
  greeting: fill in your presskit and produce the deck
  greeting-fr: remplir ton presskit et produire le document
  status: developed
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# presskit-build

**Status:** developed — the spec is complete; no code behind it yet.

Fill the gaps in the artist's presskit through conversation, saving every shared
fact immediately — never just acknowledging it in prose — and asking only about
what is actually missing.

## Data

Mine before asking. This is the skill where asking twice is most obvious to the
artist:

```bash
bun run artist:brief presskit
bun run presskit:print                 # the presskit as a PDF, in the artist's language, to ./content/presskit
bun run presskit:print --both          # French and English, for a bilingual market
bun run presskit:print --upload        # + into Artist/Presskit in the artist's Drive, replaced in place
```

**The presskit is printed, not written.** `presskit:print` renders an A4
editorial document from the rows, in `preferred_locale` (both with `--both`), — bios, releases, shows, press, photos —
through Chrome, and fails if any text falls off a page. Nothing in it writes
prose: a missing fact prints as "To be completed", which is the list of what
the intake still has to ask.

**The `Voice` section of the brief is how the artist writes.** Match it: the
greeting, the sentence length, the sign-off, the words it says never to use —
and copy the register of the samples rather than describing it. When it says no
guide is on file, say so once, name `houselabel voice` as the fix, and draft
anyway.


`Presskit` marks each field on file or `MISSING`. `Items` counts every list by
kind. `Pulled from elsewhere, never copied` is the reminder that discography,
social links and streaming metrics live in `artist.releases`,
`artist.platforms` and `artist.platform_latest` — **never ask for those**, and
never copy them into the presskit tables. The prior build's copies drifted.

Persist the moment a fact is shared, not at the end:

```bash
bun run artist:set presskit '{"id":1,"short_bio":"...","contact_email":"..."}' --conflict id
bun run artist:set presskit_items '{"kind":"award","dedupe_key":"prix-opus-2025","data":{"title":"Prix Opus","year":2025}}' --conflict kind,dedupe_key
```

`--conflict kind,dedupe_key` is the whole merge rule: lists **merge, never
replace**. Quotes key on text-prefix + source, shows on venue + date, awards on
title + year.

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| artist message + history | conversation | the current turn |
| profile | profile | name, genre, location/province, career stage, `preferred_locale` |
| presskit record | `artist.presskit` | bios, contact emails, moodboard notes, visual identity |
| presskit items | `artist.presskit_items` | quotes, clippings, awards, shows, team, videos, photos |
| artist-data fallbacks | `artist.songs` (≤50), `artist.releases` (≤20), `artist.platforms`, `artist.platform_stats` | discography, socials, and streaming metrics live here, not in the presskit — read them, never copy them |
| gap list | computed | the 13-item found/missing checklist |

## Process

1. **Mine before asking.** Scan bios, discography, clippings, and the song
   catalog for facts not yet in their own fields — an award named inside a bio,
   a venue, a publication. Extract them in the *same* turn.
2. **Ask a follow-up that names the fact** you just found: "I saw you won the
   GAMIQ Rap EP of the Year — any others?" A generic question when a concrete
   answer was already visible reads as not having looked.
3. **Follow the scripted order, skipping filled sections:** moodboard/vibe →
   photos → bio → Bandcamp discography → press → shows & awards → contact &
   socials → wrap. Moodboard comes first because it drives the entire visual
   design.
4. **Save through a tool in the same turn**, every time. Socials go to
   `artist.platforms`, releases to `artist.releases`, list items to
   `artist.presskit_items`, the rest to `artist.presskit`.
5. **Hold candidates for validation.** Press-search results and shows read off a
   tour poster are rendered as a pick-list; only the artist's selection is
   persisted, on the following turn.
6. **Emit `[CRAWL:url]`** when the artist shares a URL (an old presskit, an
   article) so it gets fetched in the background.
7. **Watch for the wrap signal.** "Looks good", "ready", "generate it" hands off
   to the deck step below.

**Last step, every time: `bun run presskit:print`.** The artist gets the
file path (and the Drive link with `--upload`), never a description of a
presskit.

## Output

Rows written through merge-and-dedupe extraction tools — bios, contact, and
moodboard to `artist.presskit`; quotes, clippings, awards, shows, team, videos,
and photos to `artist.presskit_items`; socials to `artist.platforms`; releases to
`artist.releases`. Plus one brief reply in the artist's language, any
`[CRAWL:url]` markers, candidate lists awaiting validation, and the
ready-to-generate signal when it comes.

Moodboard notes append across turns rather than replacing. Identity fields
(socials, contact, team) are never overwritten by a content edit.

## Guidelines

- **One short question per turn**, warm and conversational, plain text — no
  markdown, no emojis. Respond only in the artist's `preferred_locale`, never
  mixed.
- **Never auto-save a candidate.** A press article that isn't about this artist,
  saved silently, ends up in a deck sent to a journalist.
- **Never invent data.** A press quote without a source triggers a question, not
  a save.
- **Skip awards for emerging artists.** Asking an artist with no awards about
  their awards is a bad turn.
- **Photos stay a gap until there are three.** Say the count rather than a
  vague "add more photos".
