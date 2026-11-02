---
name: import-rules
description: >
  The extraction, deduplication, matching and merge rules
  `rights-manage-catalog` applies when it imports a catalog from a file —
  house mechanics, applied exactly so no record is corrupted.
metadata:
  agent: rights
  status: developed
  last_verified: n/a
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.1"
---

# Catalog import rules

Only the ISRC pattern and the name normalization have code behind them —
[`check-splits.ts`](../scripts/check-splits.ts) validates the same regex and
strips diacritics the same way. Everything else here is prose the model
re-derives on every import, so two runs over one file can differ; where the
prose and the script disagree, the script wins.

## The MISSING contract

- Any field the extractor cannot determine is the literal string `MISSING`
  (exact uppercase) — never guessed, never null in preview.
- All preview values are strings; they are coerced on confirm. `MISSING`
  becomes NULL in the database.
- Vision mode adds a hedge: `MISSING` for anything not readable **with
  confidence**.
- Import is blocked until every row has a non-`MISSING` title.

## Extraction

- **One row per unique song**, not per earning or stream line. Multi-store and
  multi-territory lines merge into one row.
- **Skip preamble rows** (statement titles, period rows, blanks) — find the real
  header row.
- **`source_label`** — the label, distributor or platform that produced the
  file; `MISSING` if unclear.
- **Field formats:** artists comma-separated; writers semicolon-separated;
  master_splits `"Name (role) 50%; ..."`; `registered_with` comma-separated
  acronyms; dates ISO `YYYY-MM-DD`; durations integer seconds or `MM:SS`.
- **Strict JSON only** — no prose, no fences; every unique track.
- **File routing:** CSV → LLM; XLSX → first sheet only, flattened to CSV; PDF →
  document block; images → vision. Text truncates at ~60k characters; 15 MB
  cap. Warn before extracting a large catalog — data past the limit is lost
  silently.

## Deduplication (within the import)

- Key = normalized ISRC, else normalized title + first artist.
- Later rows fill gaps in earlier ones; report the collapsed-duplicate count.

## Matching (against the existing catalog)

1. **ISRC** — strip non-alphanumerics, uppercase, 12 characters, pattern
   `^[A-Z]{2}[A-Z0-9]{3}\d{7}$`, lenient fallback on any 12 alphanumerics.
2. **Title + artist** — NFD diacritic strip, lowercase, drop
   `(feat./ft./with/avec X)`, strip punctuation; require one overlapping
   normalized artist.
3. **None** — no match.

Any match → **merge**; no match → **create**; the artist overrides per row to
merge / create / skip. Title normalization strips `(feat. X)`, so remixes and
alternate versions can collide, and the lenient ISRC fallback accepts any 12
alphanumerics — surface every match decision for confirmation.

## Merge (fill-only, non-destructive)

- **Scalars** fill empty fields only; a non-empty value is never overwritten.
- **String arrays** union with case-insensitive dedup.
- **Writers** dedup by normalized name, keeping the entry with more filled
  fields (IPI / publisher / share).
- **Master splits** dedup by normalized name, keeping the richer entry
  (payout_email / share).

Commit returns `{inserted, merged, skipped, error}`.
