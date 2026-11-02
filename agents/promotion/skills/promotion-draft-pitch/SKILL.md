---
name: promotion-draft-pitch
description: >
  Use when the artist has a station or a playlist to reach and needs the words —
  writes the pitch in their voice, shaped by the route it travels and that
  route's limits. Opens as a draft; never sends, never submits.
  Triggers on "write my radio pitch", "what do I say to this station", "fill in
  my Spotify pitch", "draft something for this curator".
metadata:
  agent: promotion
  status: beta
  mode: task
  greeting: write your pitch for a station or a playlist
  greeting-fr: rédiger ton pitch pour une radio ou une playlist
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# promotion-draft-pitch

The words that go through whichever door the artist picked. It is one skill and
not two because the pitch is where radio and playlists converge — both are
asking a programmer to play the record — while the route decides its length, its
language and what it may claim. A pitch to a music director is not a pitch to a
journalist; that one belongs to
[`press-draft-pitch`](../../../press/skills/press-draft-pitch).

## Data

The artist's file, already shaped for this department:

```bash
bun run artist:brief promotion
```

**The `Voice` section of the brief is how the artist writes.** Match it: the
greeting, the sentence length, the sign-off, the words it says never to use —
and copy the register of the samples rather than describing it. When it says no
guide is on file, say so once, name `houselabel voice` as the fix, and draft
anyway.


The brief carries the focus release, the artist's language, the traction worth
citing, and their own words about the record from previous runs. Nothing in the
pitch is invented that the brief could have supplied.

Anything the brief does not carry, and the writes this skill makes:

```bash
bun run artist:get releases id=<release-id>
bun run artist:set promotion_targets '{"target_id":"cism-893","kind":"radio","status":"drafted"}' --conflict target_id,release_id
bun run artist:remember promotion pitch-voice "<how the artist describes this record, in their words>"
```

Before drafting, whether this person said "stop". The mailing address the
footer needs is asked once, then shared by every department — the brief's
memory section carries it as `mailing_address`:

```bash
bun run artist:get contacts kind=radio
bun run artist:remember shared mailing_address "<the address the artist gave>"
bun run artist:set contacts '{"kind":"radio","email":"<email>","opted_out_at":"<today>"}' --conflict email
```

The last line is the day a contact replies "stop" — see
[`outreach-legal.md`](../../../press/knowledge/outreach-legal.md).

Catalog data — ours, read-only — goes through `data/catalog/client.ts`.

`artist:set profile` and `artist:set voice` are refused — the artist owns those rows.

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| the target | conversation, or a row saved by the match skills | decides the whole shape; without one, ask which target before writing |
| its route | catalog | `direct_email` · `form` · `spotify_for_artists` · `groover` · `submithub` · physical |
| its stated rules | catalog | file format, singles policy, attachment policy — quoted, never paraphrased away |
| focus release | `artist:brief promotion` | title, date, type |
| language | `artist:brief promotion` → profile | the pitch is written in the **contact's** language, not the artist's, when they differ |
| traction | `artist:brief promotion` | real numbers only; none on file means none cited |

## Process

1. **Refuse to write without a target.** A pitch with no route has no length,
   no language and no rules. Ask which station or playlist, then write.
2. **Read the target's stated rules and obey them in the draft itself.** A
   station that bans attachments gets a link; a station that rejects singles is
   not pitched a single — say so instead of drafting.
3. **Pick the language from the contact, not the artist.** A francophone station
   gets French. Where the profile and the contact disagree, the contact wins.
4. **Write to the route's shape.** A direct email carries a subject, a body and
   the **footer** the law requires
   ([`outreach-legal.md`](../../../press/knowledge/outreach-legal.md)):
   `{artist} · {mailing address} · {email}` and a "reply "stop"" line, in the
   contact's language; `[MAILING ADDRESS]` when it is missing. A contact with
   `opted_out_at` gets no draft.
   A platform form carries only what the form asks. The Spotify editorial pitch
   describes sound, mood, instruments and influences, and states if the record
   is French-language or Quebec.
5. **Fill every gap with a visible placeholder.** `[RELEASE DATE]`,
   `[STREAMING LINK]` — in uppercase brackets, never a plausible invention and
   never a question that stops the draft.
6. **Save the draft's existence, not the draft.** Mark the target `drafted`; the
   text stays in the conversation until the artist keeps it.

## Output

For an email route:

```
TO      musique@cism893.ca          CISM 89,3 · Montréal · campus
RULES   MP3 320 with clean metadata · transfer links OK · no attachments · no CDs
LANG    French — the contact's language

SUBJECT  <subject line>

<body — first person, the artist's voice>

⚠ 2 placeholders to fill: [STREAMING LINK], [RELEASE DATE]
⚠ Opens as a Gmail draft. Read it before you send it.
```

For a form route, only the fields the form asks for, each labelled.

- **Placeholders are counted and listed** at the bottom, so none is sent by
  accident.
- **The station's own rules are printed above the draft**, so the artist can see
  the draft obeys them.
- **Nothing is sent.** The Gmail capability opens a compose window; the send
  button is the artist's.

## Guidelines

- **Never invents a number, a quote, a placement or a press mention.** Traction
  is cited from `artist.platform_latest` or not at all.
- **Never sends and never submits.** It opens a draft. Every output says so.
- **Never claims the record is something it is not** — no "as heard on" without
  a row behind it, no genre the artist did not give.
- **Writes in the artist's first person**, not the label's third. A promotion
  pitch from an unsigned artist that pretends to be from a publicist reads as
  what it is.
- **The route's rules and limits live in
  [`knowledge/radio-pitch.md`](../../knowledge/radio-pitch.md)
  and [`knowledge/playlist-pitch.md`](../../knowledge/playlist-pitch.md).**
  Link them; the numbers have one home.
- **When the target's rules exclude this release, say so and stop.** A station
  that does not accept singles is not pitched a single with an apology attached.
