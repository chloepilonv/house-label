---
name: manager-build-credits
description: >
  Use when a release needs its credits — assembles the writers, performers,
  engineers, artwork and funder lines into one CREDITS document for the release
  folder, and reports every missing credit with the department that closes it.
  Triggers on "who do I credit", "build the credits", "what's missing from my
  credits", "I need a credits file for the album".
metadata:
  agent: manager
  status: beta
  greeting: build the credits for a release
  greeting-fr: monter les crédits d'une sortie
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# manager-build-credits

**Status:** beta — the assembly and the arithmetic are code:
[`scripts/credits.ts`](./scripts/credits.ts) reads the rows, prints the
document, and prints the gaps.

A credits document is the one deliverable that spans every department. The
writers belong to [`rights`](../../../rights), the cover credit to
[`presskit`](../../../presskit), the studios and the engineers to nobody but the
artist — and no single department can produce the file. Label Management can,
because assembling a deliverable other departments own is what this department
already does.

## Data

Reads, through [`scripts/credits.ts`](./scripts/credits.ts):
`artist.releases`, `artist.songs`, `artist.song_writers`,
`artist.release_credits`, `artist.song_samples`.

Writes go through the CLI, never raw SQL:

```bash
bun run artist:set release_credits '{"release_id":"<uuid>","song_id":"<uuid>","name":"Harris Newman","role":"mastering_engineer","studio":"Karisma","city":"Montréal"}'
bun run artist:set song_samples    '{"song_id":"<uuid>","source_work":"Nightcall — Kavinsky","rights_holder":"Record Makers","cleared_on":"2026-02-11"}'
bun run artist:set releases        '{"id":"<uuid>","p_year":2026,"p_owner":"Odile Ray","c_year":2026,"c_owner":"Odile Ray"}' --conflict id
```

**Never writes `artist.song_writers` or `artist.song_splits`.** Those are
[`rights`](../../../rights)' rows — the money rows — and a second writer of them
is the two-vocabularies defect. This skill reads them and reports what is
missing; rights fixes it.

## Input

| Field | From | Notes |
|---|---|---|
| the whole document | [`scripts/credits.ts`](./scripts/credits.ts) | **run it.** Never assemble credits in prose |
| which release | `--release="<title>"` | defaults to the most recent release |
| the composition | `artist.song_writers` | writer, role, share, IPI, publisher — owned by rights |
| the liner credits | `artist.release_credits` | performers with instruments, engineers, studios, artwork, funder lines |
| samples | `artist.song_samples` | `cleared_on` null is a delivery blocker, not a formatting nit |
| the ℗ and © lines | `artist.releases` | two different owners; stores want both |
| the shape, before any rows exist | [`assets/credits-layout.md`](./assets/credits-layout.md) | the section order the generated Doc follows — a repo reference, never copied into Drive |

## Process

1. **Run `scripts/credits.ts --gaps` first.** It prints only what is missing and
   who closes it. That list is the orchestration; the document is the output.
2. **Brief the owner of each gap** with
   [`manager-brief-department`](../manager-brief-department) — rights for a
   split that totals 90%, presskit for a missing cover credit, the artist for a
   studio name. This department never fills the gap itself.
3. **Run it again without `--gaps`** to print the document, or `--out=<path>` to
   write it.
4. **Put it in the release folder as a Google Doc**, never as a file. Drive
   converts on upload — `uploadAsGoogleDoc()` in
   [`engine/google/drive.ts`](../../../../engine/google/drive.ts) does it — and
   the resulting `docs.google.com/document/…` link goes on
   `artist.releases.credits_url` so nobody regenerates a second copy elsewhere.
   **Never write a `.md` into the artist's Drive.** A markdown file there is one
   the artist cannot open, cannot edit and cannot hand to a collaborator; it is
   an artifact that looks delivered and is not. `--out=<path>` still writes a
   local file, which is a different thing from what lands in Drive.
5. **Regenerate after any correction.** The rows are the source; the file is
   their printout. Nothing ever reads a CREDITS file back.

## Output

Two outputs from one command. Gaps go to stderr, the document to stdout, so
`--out` writes a clean file while the gaps still reach the manager.

```
CREDITS GAPS · Nightdrive
  ✗ © line                             the composition owner is not recorded
      Rights · blocks delivery
  ✗ Writer shares · “Nightdrive”       total 90%, not 100%
      Rights · blocks registration and delivery
  ✗ Performer id · “Nightdrive”        Ana Dupuis (drums) has no IPN
      Rights · blocks payment by their society — Artisti in QC, the AFM & SAG-AFTRA Fund in the US
```

- **Every gap names the department that closes it**, the way the artist hears it
  — "Rights", not `rights`.
- **Every gap names what it blocks.** A missing credit that blocks nothing is a
  suggestion, and suggestions are noise the artist has to disprove.
- **A missing value prints as `NOT ASSIGNED` inside the document**, not as a
  blank. A blank credit line reads as a finished document; `NOT ASSIGNED` reads
  as work.

## Guidelines

- **Finish it before the release is delivered to the distributor.** Credits
  reach Spotify and Apple through the distributor's DDEX delivery, so a credit
  added after delivery reaches the platform only when the distributor resends
  the metadata — about a week on Spotify. This is a gate on the
  delivery milestone, not a nice-to-have afterwards.
- **A non-featured performer is money, not a courtesy.** A session player is not
  paid from the master split; they are paid by their performer society — Artisti
  in Québec, SoundExchange plus the AFM & SAG-AFTRA Fund in the US — and only if
  someone wrote their name and instrument down. `featured = false` with no IPN
  is a gap with a dollar value.
- **℗ and © are two lines with two owners.** ℗ is the sound recording, © is the
  composition. Self-releasing artists routinely ship one and skip the other.
- **Role names are stored as the DDEX vocabulary**, so the credit is retyped
  into the distributor's dropdown rather than reinterpreted. Free-text roles are
  rejected by the check constraint on `artist.release_credits.role`.
- **A funder line is copied verbatim.** FACTOR, Musicaction, the CALQ and the
  Canada Council each set exact acknowledgement wording in the agreement; a
  paraphrase can affect the claim.
- **An uncleared sample is a takedown, not a credit.** `cleared_on` being null
  blocks delivery and is reported that way.
- **The document is generated, never hand-edited.** A file that is both
  generated and edited is two sources of truth — the drift the Drive workspace
  spec refuses. Corrections go into the rows.
