---
name: presskit-fundamentals
description: >
  Use when the artist asks what a presskit is for, what goes in it, what each
  slide carries, or what a festival jury, a press desk, a radio station or a
  booker will actually ask them for — in Quebec, Canada and the United States,
  with each recipient's own submission rule and lead time.
metadata:
  agent: presskit
  status: developed
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "2.0"
---

# Presskit fundamentals

A presskit is the one document an artist hands to a stranger who decides
something — a review, a slot, a spin, a grant. The word is **Presskit**, never
"EPK", in both languages.

## Who opens it, and what they open first

| Recipient | Opens first | Ignores | Source |
|---|---|---|---|
| Festival or showcase jury | one **live-performance video**, then audio | a music video — "NOT an appropriate showcase submission and will not be judged" | [FAI Official Showcase Application](https://cdn.prod.website-files.com/65727bed66c9d47eed966a20/6811018523c045d495eca33a_osapdf.pdf), read 2026-09-08 |
| Press desk | the **music**, streamed in place | a kit with no listening link — "Submissions without music will not be considered" | [Exclaim!](https://exclaim.ca/contact/getcoverage), 2026-09-08 |
| Radio programmer | the **audio file** with its metadata | prose about the artist — the page names no written material at all | [CISM 89,3](https://cism893.ca/soumettre-un-album/), 2026-09-08 |
| Conference / market | a **short bio, listening and viewing links, recent photos**, in a form | email submissions — the form is the only route | [M pour Montréal, call for artists 2026](https://mpourmontreal.com/en/call-for-artists-m-for-montreal-2026/), 2026-09-08 |

- **Cloud-drive links are refused by two of the four.** FAI: "The jury WILL NOT
  review downloads or use Dropbox or Google Drive files." Exclaim!: "Dropbox,
  Google Drive or download-only folders are discouraged." The Slides and PDF in
  the artist's Drive are their own copy; a jury form or a press email needs a
  direct link — unlisted YouTube, SoundCloud, the artist's site.
- **The deck is the summary, not the submission.** Every recipient above scores
  the music first; the presskit is what makes the music's author legible.
- **The one-sheet has no published spec.** Practitioner pages agree on its
  content (release, bio, quotes, links, contact) but no distributor, label or
  outlet publishes a first-party dimension or word count.

## The fifteen fields, and where each lives

Three are read at generation time and never copied: discography, socials and
streaming metrics have their own tables, and a private copy drifts.

| Field | What it is | Lives in |
|---|---|---|
| Short bio | one to two sentences — a jury app caps it at 50 words (FAI 2027) | `artist.presskit.short_bio` |
| Long bio | three to five paragraphs, third person | `artist.presskit.long_bio` |
| Contact | press email, booking email — the ones to be printed | `artist.presskit` |
| Moodboard | the artist's aesthetic brief, appended across turns; see [`visual-direction.md`](./visual-direction.md) | `artist.presskit.moodboard_notes` |
| Visual identity | the palette and mood extracted from the moodboard | `artist.presskit.visual_identity` |
| Generated deck | Slides URL, PDF URL, generated at | `artist.presskit` |
| Press quotes | verbatim text, source, date | `artist.presskit_items` · `quote` |
| Press clippings | title, publication, date, URL | `artist.presskit_items` · `clipping` |
| Shows | venue (required), city, date, event | `artist.presskit_items` · `show` |
| Awards | title, organization, year — asked only past the emerging stage | `artist.presskit_items` · `award` |
| Team | name, role, email | `artist.presskit_items` · `team` |
| Music videos | title, URL, platform | `artist.presskit_items` · `video` |
| Photos | one URL per row, slotted hero / secondary / gallery; three is complete | `artist.presskit_items` · `photo` |
| Discography | title, type, year, label, cover art | `artist.releases` |
| Socials and audience | handle and URL per platform; followers and views as self-reported | `artist.platforms` · `artist.platform_latest` |

## The nine slides

Fixed order, the artist's language. An empty section prints exactly
`To be completed` / `À compléter` — never filler.

| # | English | French | Carries |
|---|---|---|---|
| 1 | Cover | Couverture | name, genre · city, the hero photo, one pull quote |
| 2 | Biography | Biographie | the long bio (short bio as fallback), the secondary photo |
| 3 | Discography | Discographie | four covers with title and format, the rest as a named list |
| 4 | Platforms | Plateformes | followers and views per platform, total first, source line underneath |
| 5 | Shows | Spectacles | five dated rows — date · venue · city |
| 6 | Recognition | Reconnaissance | three awards and one sourced pull quote |
| 7 | Press | Revue de presse | four cards — outlet · quote or headline · article image · link |
| 8 | Team | Équipe | roles with names and emails, then press and booking contacts |
| 9 | Gallery | Galerie | four photos, "high-resolution downloads on request" |

## What each recipient asks for — Quebec · Canada · United States

Every row is the recipient's own page, read 2026-09-08. A blank cell means the
page states nothing.

### Quebec

| Recipient | Asks for | Rule | Window |
|---|---|---|---|
| [Les Francouvertes](https://francouvertes.com/processus-de-selection/) (concours-vitrine, francophone song) | three original songs, a photo, a video (optional), a press kit (if available), a presentation text | lyrics more than 50 % French or in an Indigenous language of Canada; the artist co-wrote every song submitted; eligibility ceilings of 1,000 sales per album/EP and 1,000,000 streams across the catalogue ([28th-edition call, via Franconnexion](https://franconnexion.info/inscriptions-ouvertes-pour-les-francouvertes/)) | registration 22 Sept – 2 Nov 2025 for the 30th edition; the [31st edition](https://francouvertes.com/en-route-vers-la-31e-edition-des-francouvertes/) opens September 2026 for spring 2027 |
| [M pour Montréal](https://mpourmontreal.com/en/call-for-artists-m-for-montreal-2026/) (showcase market, November) | a short biography, listening and viewing links, recent photos — in the online form | $45 CAD fee, credited as a discount on a Pro pass; no email submissions | closes 30 April for a November festival; answer by August |
| [FME](https://www.fmeat.org/) (Rouyn-Noranda, early September) | — | no artist submission form is published on fmeat.org; the public calls ([CCAT](https://ccat.qc.ca/appels-de-projet/appel-de-candidatures-participe-au-festival-de-musique-emergente/), LOJIQ) are for industry delegates aged 18–35, not for performing | — |
| [CISM 89,3](https://cism893.ca/soumettre-un-album/) (campus radio) | MP3 at 320 kbps with metadata filled, sent through WeTransfer / Dropbox / Drive, not as an attachment | singles in French only; EPs and albums « autant francos qu'anglos » | — |
| [Le Canal Auditif](https://lecanalauditif.ca/contact/) (alternative-music site) | « des disques à nous proposer, des démos et des albums » by email | — | — |

- **No Quebec press outlet publishes a lead time.** Exclaim!'s one-month figure
  below is the only first-party number on either side of the language line.
- Radio beyond CISM is the promotion department's:
  [`../../promotion/knowledge/radio-pitch.md`](../../promotion/knowledge/radio-pitch.md).

### Canada

| Recipient | Asks for | Rule | Window |
|---|---|---|---|
| [Exclaim!](https://exclaim.ca/contact/getcoverage) (national music press) | a link to an unlisted YouTube video, SoundCloud stream or other private player, plus "any press releases or images for context" | no music, no consideration; Dropbox and Drive discouraged | "Album reviews are assigned as early as a month ahead of release" |
| [Folk Alliance International](https://www.folk.org/conference/official-showcases), Canada jury | the same application as the US row — FAI routes each act to a USA, Canada or INT jury by the market it works in | — | — |

- The media list itself is `catalog.press_outlets`, owned by the press
  department; this file never copies it.

### United States

| Recipient | Asks for | Rule | Window |
|---|---|---|---|
| [Folk Alliance International, Official Showcase 2027](https://www.folk.org/conference/official-showcases) (Chicago, 27–31 Jan 2027) | a 50-word third-person bio · two 750 px square, 300 dpi colour headshots · 1–2 audio links · one live-performance video link · media-coverage link · touring summary in chronological order · awards, "brief, chronological, and specific" · primary PRO · a stage plot as PDF · a one-year marketing plan | no downloads, Dropbox or Drive; a music video is not judged; no more than two consecutive years without a gap year | opened 1 May, closed 8 June 2026; $30 members / $60; notified 31 July; the act must register for the conference by 1 November or lose the slot |

- **The 2026 application asked for less** — a 250-character bio and a 2 MB,
  72 dpi headshot ([FAI OSA 2026 PDF](https://cdn.prod.website-files.com/65727bed66c9d47eed966a20/6811018523c045d495eca33a_osapdf.pdf)).
  Read the current year's page before quoting a limit.

## What a form asks for that the presskit does not hold

Mined during intake, never invented.

| The form asks for | Where it lives, or does not |
|---|---|
| A live-performance video, distinct from a music video | `presskit_items.video` — no live-vs-music-video distinction |
| Per-track audio links | `artist.releases` holds a release URL, not a track link |
| A bio under 50 words | `presskit.short_bio` is uncapped; write it to fit |
| A media-coverage page, not a list | the artist's website — the digital-marketing department's `build-website` skill |
| Primary PRO | `artist.registrations` — [`../../rights/knowledge/rights-fundamentals.md`](../../rights/knowledge/rights-fundamentals.md) |
| A one-year marketing plan | [`../../digital-marketing/knowledge/marketing-fundamentals.md`](../../digital-marketing/knowledge/marketing-fundamentals.md) |
| A stage plot, PDF only | nowhere; it goes to the venue when a show is advanced |

## Sources

- [FAI Official Showcase 2027 page](https://www.folk.org/conference/official-showcases) · [FAI OSA 2026 application PDF](https://cdn.prod.website-files.com/65727bed66c9d47eed966a20/6811018523c045d495eca33a_osapdf.pdf)
- [Exclaim! — Get coverage](https://exclaim.ca/contact/getcoverage)
- [CISM 89,3 — Soumettre un album](https://cism893.ca/soumettre-un-album/)
- [M pour Montréal — Call for artists 2026](https://mpourmontreal.com/en/call-for-artists-m-for-montreal-2026/)
- [Les Francouvertes — Processus de sélection](https://francouvertes.com/processus-de-selection/) · [31e édition](https://francouvertes.com/en-route-vers-la-31e-edition-des-francouvertes/) · [Franconnexion, 28e édition](https://franconnexion.info/inscriptions-ouvertes-pour-les-francouvertes/)
- [Le Canal Auditif — Contact](https://lecanalauditif.ca/contact/)
