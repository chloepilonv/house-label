---
name: distribution-prepare-package
description: >
  Use when a release is finished and has to be handed to a distributor — walks
  the artist through what the stores and their distributor require of the audio,
  the artwork, the metadata and the identifiers, then returns a checklist marked
  ready, missing or unknown. Triggers on "what do I need to upload", "what size
  does my cover need to be", "is my release ready", "they rejected my artwork".
metadata:
  agent: distribution
  status: developed
  mode: task
  greeting: help you prepare your release package for that distributor, before it gets rejected
  greeting-fr: t'aider à préparer le paquet de ta sortie pour ce distributeur, avant un refus
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# distribution-prepare-package

Turn a finished release into a checklist that says, item by item, whether it will
be accepted — and where it will not, exactly what to change.

**Prepares, never uploads.** The artist submits the release themselves.

## Data

**The catalog is ours, read-only, and ships as one file** —
`data/catalog/catalog.sqlite`, rebuilt every Monday. Read it with the query
script (`uv` runs it, and fetches a Python if the machine has none — works in
Claude Cowork, Desktop and Claude Code alike):

```bash
uv run data/catalog/query.py distributors --q "cd baby" --columns name,artwork_formats,artwork_min_px,audio_formats,spec_url
```

`--where col=value`, `--q <text>`, `--columns all`, `--json` cover the rest;
`uv run data/catalog/query.py --datasets` lists what the file holds. It holds
desks, never a person: the person behind a desk comes from the artist's own
Hunter key or from reading the outlet's contact page for them.

```bash
bun run artist:brief distribution
bun run artist:get releases
bun run .../scripts/read-files.ts <files...>    # read the specs off the files themselves
bun run .../scripts/save.ts "<release title>" --answers='{"audio_format":"wav","audio_specs":"…","artwork_size":"…","artwork_format":"…","artwork_content":[…],"identifiers":"…","lyrics":"…","release_date":"YYYY-MM-DD"}'   # write the checklist down — WITH the interview's answers, or every item saves as unknown
bun run artist:remember distribution on_hand "<what they already have on hand>"
```

The checklist is **saved, not recomputed**: one row per item in
`artist.release_checklist`, keyed on `(release_id, item)` so a re-check updates
rather than duplicating. `artist:brief distribution` reads it back — blocking
items first, each naming whose rule it is.

Never write SQL. The release row already carries the title, date, UPC and cover
art URL; asking for something already on file is the fastest way to lose trust.

## Input

| Field | From | Notes |
|---|---|---|
| the thirteen answers | [`scripts/questions.ts`](./scripts/questions.ts) | the engine walks `FLOW` |
| the release | `artist.releases` | title, date, UPC, cover art — offered, then confirmed |
| the tracks | `artist.songs` | ISRCs, count, titles |
| their distributor's rules | `catalog.distribution_services` | `artwork_formats`, `artwork_min_px`, `artwork_max_px`, `audio_formats`, `docs_required` |
| the store baseline | [`delivery-requirements.md`](../../knowledge/delivery-requirements.md) | used only where the distributor's column is null |
| their distributor's help centre | `catalog.distribution_services.help_center_url` | where an `unknown` gets sent — the route is `catalog.distribution_services.help_center_url`, see [`distributor-knowledge.md`](../../knowledge/distributor-knowledge.md#the-companys-own-rules) |
| the saved checklist | `artist.release_checklist` | what was already checked, so a re-run confirms rather than re-asks |

## Process

0. **Ask for the files before asking about them.** If the artist can give a
   path, `scripts/read-files.ts` reads the cover's dimensions and format and the
   masters' format, bit depth and sample rate — four questions that only an
   engineer can answer about a file the computer is already holding. Never ask
   for a spec you could measure.
1. **Run the interview** for what is left. The engine walks `FLOW`. Skip what
   the release row already answers.
2. **Resolve every requirement through the precedence order** in
   [`delivery-requirements.md`](../../knowledge/delivery-requirements.md#precedence--which-requirement-applies-to-this-artist):
   their distributor's column first, the store baseline second, `unknown` third.
3. **Say which one answered, every time.** "DistroKid requires JPG" and "the
   stores accept PNG but I don't have DistroKid's own rule" are different claims
   and the artist can act differently on each. An `unknown` ships with that
   company's `help_center_url` attached — the artist can settle in one click
   what we could not, and an unknown with no link is a dead end we chose.
4. **Check the artwork content before the artwork size.** A URL, a QR code, a
   social handle or a streaming logo is an automatic rejection at every store,
   and it is the failure most often described as "rejected for no reason".
5. **Compute both deadlines.** The distributor's delivery window plus Spotify's
   7-day editorial pitch, added — then say whether the release date still works.
6. **Return the checklist.** Every item ready, missing or unknown; every missing
   item with the fix; every unknown with the question to put to the distributor.

## Guidelines

- **Never guess a spec.** "I'm not sure" routes to how to check it, never to an
  assumed value. A guessed number is what puts a release in a rejection queue
  two weeks before release day.
- **Never quote the store baseline as the distributor's rule.** They are
  different facts, and only one of them changes if the artist switches.
- **Never say "3000×3000 or you'll be rejected".** Spotify accepts 640–10000;
  3000 is Apple's recommended minimum. Say whose rule it is.
- **Never issue an identifier.** ISRCs and UPCs come from the distributor or the
  artist's own registrant code — route the question to `rights`.
- **Never claim a release was submitted.** This skill produces a checklist.

## Output

A per-release checklist: audio, artwork, metadata, identifiers and timing, each
marked ready / missing / unknown, each naming whose requirement it is, and each
missing item carrying the specific change that clears it.
