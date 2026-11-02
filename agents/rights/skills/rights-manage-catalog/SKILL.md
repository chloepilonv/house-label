---
name: rights-manage-catalog
description: >
  Use when the artist wants to see their catalog or add to it — reads the
  song and release list, or takes one song by hand or a whole catalog from a
  file, with full rights metadata, share-total warnings and non-destructive
  merge.
metadata:
  agent: rights
  status: developed
  mode: task
  greeting: show your song catalog, or add songs by hand or from a file
  greeting-fr: montrer ton catalogue de chansons, ou en ajouter à la main ou par fichier
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# rights-manage-catalog

**Status:** developed — the question set is code; `check-splits.ts` is the
deterministic half.

The catalog: identifiers, writer shares, master splits, and which organizations
each work is registered with — the data every royalty claim depends on.

One skill with three doors, because manual entry and a file drop produce the
identical artifact and differ only in who types the values. Seeing the catalog
is the commonest reason to open this and costs one question.

## Data

```bash
bun run artist:brief rights
bun run artist:get songs
bun run artist:get song_writers song_id=<uuid>
```

### The credits sheet

Every release folder in the artist's Drive carries
`<title> — Release-Credits`, a five-tab Google Sheet built by label-manager
at project validation (`engine/google/credits-sheet.ts`). It is the **intake**
surface and the artist's single source for everything a rights platform asks:
`⭐ RELEASE_CREDITS`, `⭐ SONG_CREDITS`, `⭐ SONG_SPLITS`, `⭐ PEOPLE_INFO`,
`📚 GLOSSARY` — the emoji are the artist's own.

Send it to a collaborator when what is missing is a fact only they have — an
IPI, an address, a SIN, a GST number. Nobody who plays on one
record is going to install this app to hand those over, and asking for them
turn by turn in a chat loses them.

What comes back is imported like any other file, through the rules in
[`references/import-rules.md`](./references/import-rules.md): match on
ISRC first, merge fill-only, never overwrite a filled cell. The sheet is never
the source of truth — `artist.songs`, `artist.song_writers` and
`artist.song_splits` are, and the sheet's `SONG_CREDITS` tab is seeded from them.

**`PEOPLE_INFO` holds a SIN, so say who may open the file.** The sheet has no
per-cell permissions — everyone who can open it reads every row. When the
artist shares it, remind them once: share with the people on it, not the whole
team.

The credits DOCUMENT is a different file with a different owner: label-manager's
[`manager-build-credits`](../../../label-manager/skills/manager-build-credits)
generates a credits Google Doc out of the same rows and nothing reads it back.

`Catalog hygiene` separates the two problems: a song with **nothing** on a side
needs data entered; a song whose shares **do not total 100** needs a number
corrected. Those take different fixes. Both are warnings — `song_share_totals`
is a view rather than a constraint precisely so a partial import can be saved
and fixed later.

```bash
bun run artist:set songs '{"title":"Nuit blanche","isrc":"CAXXX2600001"}'
bun run artist:set song_writers '{"song_id":"<uuid>","name":"...","role":"composer","share_percent":50}'
bun run artist:set song_splits  '{"song_id":"<uuid>","name":"...","role":"producer","share_percent":20}'
```

No `--conflict` is a plain insert, which is what these uuid-keyed tables need.
`source_label` records which import file a row came from, which is what makes a
bad import reversible.

Never write SQL and never open the database directly.

## Input

The question set is [`scripts/questions.ts`](./scripts/questions.ts). Question 1
forks: **see my catalog** ends the interview, **add by hand** asks seven,
**add from a file** asks four.

**Two copyrights, two independent 100% pies.** The interview asks each side as
one question carrying name and percentage together — `you 50, sam 50` — because
asking for names and then for numbers makes the artist hold the order in their
head.

| Side | Table | Who appears |
|---|---|---|
| Composition | `song_writers` | writers, each with role, IPI, share, publisher |
| Master | `song_splits` | artist, featured artist, producer points, label |

**Release** — title (required), artist name, type, UPC, label, distributor,
release date, cover art, linked song ids.

## Process

1. **Take the title as the only hard requirement.** Everything else can arrive
   later; a catalog the artist abandons because the form demanded an ISRC they
   don't have yet collects nothing.
2. **Check the shares with the script**, never by adding them up. Report what it
   returns: both totals, how much is unallocated or over, a duplicated writer
   (the usual cause of an over-100 total), a `MISSING` or non-numeric share
   rejected rather than read as zero, and the ISRC shape.

   ```bash
   bun run agents/rights/skills/rights-manage-catalog/scripts/check-splits.ts song.json
   ```
3. **Warn, don't block, on share totals.** Show "(should total 100%)", or
   "(doit totaliser 100%)" for a French-speaking artist. Splits genuinely are in
   flux while a record is being made, and blocking the save loses the rest of the
   entry.
4. **Run the hygiene pass**: missing ISRC / ISWC / IPI / UPC, songs with no
   `registered_with` entries, songs and releases not linked to each other.
5. **Record sync separately.** Sync has no collection society — a free-text sync
   agent or publisher note per side, never presented as a registration.

### The file branch

6. **The privacy disclosure is question 2, before the path is asked.** The file
   goes to Anthropic's API. ISRCs, ISWCs, UPCs, titles and writer credits are
   public identifiers and fine; passwords and bank details are not. Answering no
   ends the branch and the path is never requested.
7. **Extract without guessing.** Any field the extractor cannot read becomes the
   literal `MISSING` sentinel in exact uppercase — never a plausible value.
8. **Deduplicate to one row per unique song**, merging the multi-store and
   multi-territory lines a distributor export splits apart.
9. **Block on titles.** Import cannot proceed until every row has a
   non-`MISSING` title — "Fix N MISSING title(s) before continuing."
10. **Match each row**: a normalized ISRC match is strongest; otherwise
    normalized title plus one overlapping artist. Any match defaults to merge; no
    match defaults to create. `merge_policy` from the interview sets the default;
    the artist still overrides per row.
11. **Surface every decision before committing.** Merge, create and skip are all
    shown per row — never applied silently. **Merge is fill-only**: scalars fill
    empty fields and never overwrite; arrays union with dedup; writers and splits
    dedup keeping the richer entry.
12. **Commit and report** `{inserted, merged, skipped, error}`, then run the
    brief again — `Catalog hygiene` is the check on what landed.

## Output

**Seeing:** the song and release list with hygiene flags.

**Adding by hand:** the saved song record, both share totals, warnings where
either set doesn't reach 100%, and hygiene flags for missing identifiers,
unregistered songs, and unlinked songs or releases.

**Adding from a file:** deduplicated candidate rows — one per unique song, with
`MISSING` sentinels and the detected `source_label`, fully editable — then, after
per-row confirmation, the executed result counts. `MISSING` becomes NULL on
confirm, and the sentinel itself is never translated.

Field labels, roles and tooltips appear in the artist's language, never in both
at once.

## Guidelines

- **Never guess an extracted value.** `MISSING` is the honest answer; a plausible
  invented ISRC is undetectable later and misroutes royalties.
- **The artist's hand-entered data outranks a distributor export.** That is what
  every merge decision resolves to.
- **Never invent an identifier.** A missing ISRC is a hygiene flag, not a field
  to fill.
- **Treat split conventions as guidance, never as defaults.** They live in
  [`collaboration-rights-and-rates.md`](../../knowledge/collaboration-rights-and-rates.md#split-sheet-hygiene)
  and open a conversation with collaborators rather than pre-filling a field.
- **Never present sync as a registration.** There is no society to register with.
- **Warn about the file limits that lose data quietly**: only the first XLSX
  sheet is read, text truncates at 60k characters, and the cap is 15 MB. On a
  large catalog, say so before extracting rather than after.
- Matching and merge rules in full:
  [`references/import-rules.md`](./references/import-rules.md).
