---
name: press-draft-pitch
description: >
  Use when the artist needs the master press pitch for a release — writes a
  complete first-person pitch (120–250 words,
  hook→who→release→credibility→detail→CTA) in FR or EN, filling gaps with
  UPPERCASE placeholders, never questions. Draft only.
metadata:
  agent: press
  status: developed
  greeting: write your master press pitch for a release
  greeting-fr: écrire ton pitch de presse principal pour une sortie
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# press-draft-pitch

**Status:** developed — the spec is complete; no code behind it yet.

Write the one master pitch for a release, in the artist's first-person voice,
that every later outreach email adapts from. It is always complete and
ready-to-send even when the profile is thin — missing facts become bracketed
placeholders, never a request for more information.

## Data

Run this first. It is the artist's file, already shaped for this department:

```bash
bun run artist:brief press
```

**The `Voice` section of the brief is how the artist writes.** Match it: the
greeting, the sentence length, the sign-off, the words it says never to use —
and copy the register of the samples rather than describing it. When it says no
guide is on file, say so once, name `houselabel voice` as the fix, and draft
anyway.


It resolves the focus release for you — explicit id, else the **soonest**
upcoming date, else the most recent past one; undated releases are drafts and
are never the focus. It drops every metric that is zero or was never read, so
there is no "0 monthly listeners" to accidentally quote. And it says whether a
master pitch already exists. Those rules live in
[`data/artist/brief/rules.ts`](../../../../data/artist/brief/rules.ts), which
is why two runs agree; when they lived in this file as prose, they did not.

Anything the brief doesn't carry:

```bash
bun run artist:get presskit_items kind=quote
bun run artist:get releases --order "release_date desc" --limit 10
```

Save the master pitch back to the campaign:

```bash
bun run artist:set press_campaigns '{"id":"<uuid>","pitch":"..."}' --conflict id
```

Never write SQL and never open the database directly — the commands above are
the only supported path to `artist.*`.

## Input

| Field | From | Notes |
|---|---|---|
| artist profile | profile | name, genre, city/province, career stage, languages, comparable artists (RIYL), brand keywords, bio, project description |
| presskit | `artist.presskit` | short/long bio, discography, press quotes, clippings, streaming metrics, awards, shows |
| recent releases + platform stats | `artist.releases`, `artist.platform_stats` | last 10 releases, last 6 stat snapshots — context, not the subject |
| focus release | conversation | optional releaseId / campaign name, release date, listen link |
| marketing context | Digital Marketing Agent | optional imported angle, key messages, target audience |
| locale | artist | `fr` or `en`; anything not `fr` falls back to `en` |

## Process

1. **Pick the focus release** in this order: an explicit releaseId → the next
   release with a future date → the most recent. Past releases are context for
   credibility, never the subject.
2. **Gather what's true.** Pull traction from the presskit and platform stats,
   dropping any metric that is zero or empty rather than citing it.
3. **Conform to imported marketing context** if the Digital Marketing Agent has
   already set an angle and key messages. That messaging is decided; the pitch
   carries it rather than inventing a competing angle.
4. **Write the six beats** in 4–6 paragraphs, 120–250 words: hook / unique
   angle; who the artist is (genre, location, sonic references); what this
   release is about; credibility and traction *only if impressive and provided*;
   concrete release detail (date, format, listen link); a polite CTA (listen,
   interview, playlist add, review).
5. **Placeholder every gap** in UPPERCASE brackets — `[ARTIST NAME]`,
   `[UNIQUE ANGLE — what makes this release special]`, `[LISTEN LINK]`,
   `[NOM DE L'ARTISTE]`, `[LIEN D'ÉCOUTE]` — and write the surrounding sentence
   in full, ready to send once the placeholder is replaced.
6. **Save it as the campaign's master pitch** — persisted, not held in UI state,
   because every outreach draft adapts from this one text.

## Output

A 4–6 paragraph pitch body of 120–250 words carrying the six beats above, with
**no greeting and no sign-off** — [`press-compose-outreach`](../press-compose-outreach)
adds those per contact. FR output is professional Québécois French; EN is clear
professional English. Gaps appear as UPPERCASE bracketed placeholders.

The words "pitch", "press release", and "publicist" never appear in the body.

## Guidelines

- **Never ask questions, never refuse, never return a list of prompts.** Thin
  data means placeholders, not a request for more information. This rule exists
  because an artist who gets asked five questions instead of a draft stops using
  the department.
- **Never invent stats, press, or credits.** A placeholder always beats a
  fabrication, and a fabricated press quote in a pitch to the outlet that
  supposedly said it is unrecoverable.
- **Write as the artist, not about them.** First person, warm, direct, zero
  press-release clichés.
- Pitch anatomy, what journalists say lands, and the EN/FR register rules live
  in [`../../knowledge/press-writing.md`](../../knowledge/press-writing.md).
  It puts the sweet spot under 200 words — write toward the bottom of the
  120–250 range.
