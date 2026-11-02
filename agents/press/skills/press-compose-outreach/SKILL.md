---
name: press-compose-outreach
description: >
  Use when the artist is ready to reach one contact — adapts the master pitch
  into a send-ready email for that outlet (subject and body shaped by contact
  type, greeting personalized, in the contact's language). Opens the draft;
  never sends, never changes status.
metadata:
  agent: press
  status: developed
  greeting: turn that pitch into a send-ready email for one contact
  greeting-fr: transformer ce pitch en courriel prêt à envoyer pour un contact
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# press-compose-outreach

**Status:** developed — the spec is complete; no code behind it yet.

Turn the write-once master pitch into a send-ready draft for one specific
contact — genuinely adapted to the channel, not just a swapped subject line — in
that contact's own language. The artist opens it in their mail client; nothing
is auto-sent, and composing does not advance the pipeline.

## Data

The artist's file, already shaped for this department:

```bash
bun run artist:brief press
```

**The `Voice` section of the brief is how the artist writes.** Match it: the
greeting, the sentence length, the sign-off, the words it says never to use —
and copy the register of the samples rather than describing it. When it says no
guide is on file, say so once, name `houselabel voice` as the fix, and draft
anyway.


The `Campaign` section carries the master pitch status and the pipeline counts.
Adapt from that pitch; never write a competing one.

The pitches themselves, when you need the row you are adapting for:

```bash
bun run artist:get press_pitches campaign_id=<uuid>
bun run artist:get press_pitches contact_slug=null      # artist-added contacts
```

Before drafting, whether this person said "stop". The mailing address the
footer needs is asked once, then shared by every department — the brief's
memory section carries it as `mailing_address`:

```bash
bun run artist:get contacts catalog_slug=<slug>
bun run artist:remember shared mailing_address "<the address the artist gave>"
bun run artist:set contacts '{"kind":"press","email":"<email>","opted_out_at":"<today>"}' --conflict email
```

The last line is the day a contact replies "stop" — see
[`outreach-legal.md`](../../knowledge/outreach-legal.md).

Opening a draft writes nothing. Composing never advances status — that is
[`press-run-campaign`](../press-run-campaign)'s job, and it uses `artist:set`.

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| outlet | `catalog.press_outlets` | type, outlet, `desk_email`, language, `submission_method`; the named person, if any, from `artist.contacts` |
| master pitch | `artist.press_campaigns` | the saved release pitch body |
| release facts | campaign/release | artist name, release title, release date, listen link, presskit link |
| locale | the contact's language | outreach language matches the **contact**, not the app; `bilingual` falls back to the artist's `preferred_locale` |

## Process

1. **Check how this contact accepts submissions.** No email means the output is
   the route from `submission_method` — online form, DMDS, publicist, physical
   mail — with the URL or address it names.
2. **Set the language from the contact**, not the app locale: `fr` → French,
   `en` → English, regardless of what language the artist is chatting in. A
   `bilingual` contact takes the artist's `preferred_locale`, since either
   language lands and the artist has to be able to answer the reply.
3. **Build the subject from the contact type** — radio →
   `New Release — {artist} — {title}`;
   everything else → `Pitch — …`, with localized FR equivalents.
4. **Personalize the greeting** to the outlet — "Hello to the {outlet} team!" /
   "Bonjour à l'équipe de {outlet}!" — stripping parentheticals from the outlet
   name.
5. **Adapt the body to the channel**, keeping the master pitch as the spine.
   Radio: 5 sentences maximum — who, what the song is, listen link, presskit
   link. Press: lead with the story angle. Playlist: sound, mood, instruments,
   influences.
6. **Close with the concrete detail** — release-date line, listen link (or
   `[INSERT LINK]` / `[INSÉRER LIEN]` when missing), presskit link — and a
   `Thank you! {artist}` / `Merci! {artist}` sign-off, then the **footer** the
   law requires ([`outreach-legal.md`](../../knowledge/outreach-legal.md)):
   `{artist} · {mailing address} · {email}` and "To stop hearing from me, just
   reply "stop"." / « Pour ne plus recevoir mes courriels, répondez simplement
   « stop ». » A missing address is `[MAILING ADDRESS]` / `[ADRESSE POSTALE]`.
   A contact with `opted_out_at` gets no draft — say they asked not to be
   contacted.
7. **Hand back the draft and the next action** — open it, review it, send it,
   then mark it sent in [`press-run-campaign`](../press-run-campaign).

## Opening the draft

`gmail_draft` turns the finished email into a link that opens it, prefilled, in
the artist's own mail. It **sends nothing** and needs no connected account.

- **Hand over the link and say nothing has gone out.** The artist reads, edits,
  and presses send. Saying "sent" about a link is the failure this skill exists
  to avoid.
- **Never move the pitch to `sent` yourself.** The status changes when the
  artist says they sent it, not when the draft opened.

## Output

`{subject, body}` ready to open in the artist's mail client, in the contact's
language, with the greeting and sign-off this skill adds (the master pitch has
neither). Where the contact has no email, the output is the routing instruction
for their actual submission method instead of a draft addressed to nobody.

Contact type maps to `pitch_type` when the artist later marks it sent:
radio_community / radio_commercial → radio; press / magazine / blog → press_review;
tv_video → feature.

**`industry_org` and `platform` are never pitched.** SOCAN, FACTOR, SubmitHub,
Groover — these are submission services and funding bodies, not people with an
inbox who write about music. Surface them with what to do (visit, submit) and
never draft an email or log a pitch against one.

## Guidelines

- **Never fabricate an address.** A contact with no public email has one for a
  reason, and a guessed one burns the contact rather than reaching them.
- **Never send, and never advance status.** A status that moved on its own makes
  the whole campaign log untrustworthy.
- **Never ship a subject-line swap.** A radio draft that is the press draft with
  a new subject wastes the one impression the artist gets with that contact.
- **The app locale is never the answer.** This is the rule most likely to break
  under a well-meaning default; `bilingual` is the single case that reads back to
  the artist's own language.
