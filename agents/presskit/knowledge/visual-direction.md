---
name: visual-direction
description: >
  Use when deriving the deck's look or judging a press photo — why the
  moodboard beats the genre, the WCAG contrast floors as ratios, and what a
  print desk, a festival app and a press desk can each actually use, in
  Quebec, Canada and the United States.
metadata:
  agent: presskit
  status: developed
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "2.0"
---

# Visual direction

Two decisions, two kinds of authority: the palette is the artist's taste under
a contrast floor; the photo spec is the recipient's and not ours to choose.

## Moodboard over genre

- **The artist's brand wins, then the moodboard, then the genre.** Colours the
  artist chose beat colours extracted from their references, which beat a
  baseline picked from their genre. The per-genre baselines and the last-resort
  default are code: `skills/presskit-build/scripts/theme.ts`.
- **"Dark academia", "70s psychedelia", "raw street photography" are a brief.**
  The genre baseline is only the answer when the artist gave none.
- **"No preference" is an answer.** Save it as `no strong direction — clean and
  professional` and never re-ask.
- **Primary comes from the dominant colour in the images.** Dark or moody
  imagery → dark background, light text; bright or airy → the inverse. Three to
  four colours, no more — the deck carries no charts.

## Contrast is a ratio, not the phrase "AA"

[W3C, WCAG 2.2](https://www.w3.org/TR/WCAG22/#contrast-minimum), Level AA:

| What | Minimum ratio | Criterion |
|---|---|---|
| Body text | 4.5:1 against its background | SC 1.4.3 |
| Large text — at least 18 pt, or 14 pt bold | 3:1 | SC 1.4.3 |
| Cards and graphical objects | 3:1 against adjacent colours | [SC 1.4.11](https://www.w3.org/TR/WCAG22/#non-text-contrast) |

- **A slide title is large text; body copy is not.** A pair that clears 3:1 on
  the title fails the moment it carries a paragraph.
- **A "subtle card" has a hard stop** at 3:1 against the background.

## Press photos — the recipient sets the spec

**dpi is not a property of the pixels.** It is a number stored in the file that
says how large to print them; "300 dpi" means nothing until a print size is
named. Pixel dimensions are the only fact worth checking.

### Print

- **1200 × 1800 px is the floor for a photograph** — 300 dpi at 4 × 6 in;
  CMYK; `.tiff` or `.jpeg` ([UCL Press](https://uclpress.co.uk/artwork-submission-guidelines/)).
- **That is a book-publishing spec.** No music publication in Quebec, Canada or
  the US publishes a print photo spec; a web-first outlet needs less.

### Screen — conference apps, festival sites, press desks

| Market | Recipient | Photo asked for | Source, read 2026-09-08 |
|---|---|---|---|
| United States | Folk Alliance International, Official Showcase 2027 | two headshots, **750 px square, 300 dpi, colour** | [folk.org](https://www.folk.org/conference/official-showcases) |
| United States | FAI, 2026 application | one headshot ≤ 2 MB, 72 dpi, PNG/JPEG, "square or slightly horizontal", colour preferred; one alternate photo ≤ 10 MB, any crop | [OSA 2026 PDF](https://cdn.prod.website-files.com/65727bed66c9d47eed966a20/6811018523c045d495eca33a_osapdf.pdf) |
| Canada | Exclaim! | "images for context" — no dimension, no format | [exclaim.ca](https://exclaim.ca/contact/getcoverage) |
| Quebec | M pour Montréal | "recent photos" — no dimension, no format | [mpourmontreal.com](https://mpourmontreal.com/en/call-for-artists-m-for-montreal-2026/) |
| Quebec | Les Francouvertes | "une photo" — no dimension, no format | [francouvertes.com](https://francouvertes.com/processus-de-selection/) |

- **Square is the working crop.** The one recipient that states a shape asks
  for square; the hero on a 16:9 slide is a different crop of the same frame,
  so the gallery needs at least one large, uncropped original.
- **The spec moves year to year.** FAI went from 72 dpi / 2 MB to 750 px /
  300 dpi in one edition. Read the current form before quoting a number.
- **No Quebec or English-Canada recipient publishes a photo spec.** Treat it as
  unknown, not as identical to the US figure.

## Sources

- [W3C — WCAG 2.2, SC 1.4.3 and 1.4.11](https://www.w3.org/TR/WCAG22/#contrast-minimum)
- [UCL Press — Artwork submission guidelines](https://uclpress.co.uk/artwork-submission-guidelines/)
- [FAI — Official Showcases 2027](https://www.folk.org/conference/official-showcases) · [OSA 2026 PDF](https://cdn.prod.website-files.com/65727bed66c9d47eed966a20/6811018523c045d495eca33a_osapdf.pdf)
- [Exclaim! — Get coverage](https://exclaim.ca/contact/getcoverage) · [M pour Montréal — Call for artists 2026](https://mpourmontreal.com/en/call-for-artists-m-for-montreal-2026/) · [Les Francouvertes — Processus de sélection](https://francouvertes.com/processus-de-selection/)
