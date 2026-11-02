---
name: press-fundamentals
description: >
  Use when the artist asks who could write about their release, what those
  outlets want and how early, whether to hire a publicist, or which paid
  pitching service is worth it — the media types in Quebec, Canada and the US,
  their lead times, embargo and premiere conventions, and the tools an indie
  artist reaches them with.
metadata:
  agent: press
  status: developed
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "2.0"
---

# Press fundamentals

Publicity gets the record **written about**; promotion gets it **played**. Radio
is [`radio-pitch.md`](../../promotion/knowledge/radio-pitch.md) and playlists are
[`playlist-pitch.md`](../../promotion/knowledge/playlist-pitch.md); the whole
release sequence is
[`release-path.md`](../../label-manager/knowledge/release-path.md).

## What coverage is worth

- **Journalists build on PR.** 66% rely on PR-provided content (releases,
  pitches, media kits) for story ideas, the single largest source
  ([Cision, *State of the Media 2026*](https://www.prnewswire.com/content/dam/prnewswire/resources/white-papers/Cision_2026_State_of_the_Media_Report.pdf),
  1,899 journalists in 19 markets incl. Canada and the US, Jan–Feb 2026); 86% say
  at least some stories began with a pitch
  ([Muck Rack, *State of Journalism 2026*](https://www.globenewswire.com/news-release/2026/03/19/3259178/0/en/muck-rack-s-2026-state-of-journalism-report-finds-82-of-journalists-use-ai.html),
  897 retained of 1,044, mostly US, 30 Jan–2 Mar 2026).
- **A review or feature outlives the campaign** — it is the pull-quote in the
  presskit, the credibility line in the next pitch and in a grant application.
- **Reviews do not play the record.** Airplay and playlist adds are a separate
  pipeline with separate gatekeepers (promotion, above).

## Types of media, per market

The department's list is **`catalog.press_outlets`** — one row per MEDIA,
never a person, with `outlet_type` (`newspaper` · `magazine` · `blog` ·
`webzine` · `tv`), `market` (`quebec` · `canada` · `us`), `tier` 1–3,
`language`, `desk_email` (a role address or nothing), `submission_method`,
`lifecycle` and `last_verified`. The people behind a desk are the artist's own:
found with their Hunter key, kept in `artist.contacts`. Radio is promotion's
(`catalog.promotion_radio_stations`). Names below are examples of a *type*; the rows,
routes and addresses live in the table.

| Type | Quebec | Rest of Canada | United States | What it runs |
|---|---|---|---|---|
| Dailies, culture desk | La Presse, Le Devoir, Le Journal de Montréal (FR); The Gazette (EN) | Globe and Mail, Toronto Star, regional dailies | NYT, LA Times, city dailies — publicist territory | news, interviews, show previews; local angle required |
| Public broadcaster, written | Radio-Canada / ICI Musique | CBC Music | NPR Music — [Tiny Desk Contest open only to US residents](https://tinydeskcontest.npr.org/rules/) | features, sessions, premieres |
| Culture TV | Télé-Québec (*Belle et Bum*, FAB) | CBC arts | late-night — publicist territory | live performance, video segments |
| Lifestyle & culture magazines | ELLE Québec, Clin d'œil, Châtelaine, Vita, 7 Jours (FR) | ELLE Canada, Chatelaine, FASHION, Toronto Life | NYLON, Teen Vogue, Interview | artist profiles, "à écouter" picks, shoots, playlists — reach readers no music outlet has |
| Alt-weekly / monthly | Cult MTL (EN); *Voir* closed 2020 | NOW Toronto, BeatRoute (digital) | LA Weekly, city alt-weeklies | previews, reviews, scene features |
| National music press | — | Exclaim!; Billboard Canada (trade) | Pitchfork, Stereogum, Consequence, BrooklynVegan, The FADER | reviews, premieres, Best New Track |
| Specialist web / blogs | PAN M 360, Le Canal Auditif, Sorstu | Canadian Beats | genre blogs — Hype Machine indexes them and takes no submissions by design | album reviews, emerging-artist columns |
| Podcasts, campus papers | | | | interviews; 4–8-week recording lead (practitioner, unsourced) |

Quebec has no national music magazine of Exclaim!'s kind; the dailies' culture
desks and the specialist sites carry that role. Most tier-1 US outlets publish
no artist submission route — the catalog's `submission_method` says which do.

## What each type wants, and when

| Type | Wants | Lead before release | Source |
|---|---|---|---|
| National music press (CA) | advance stream, story angle, release date | reviews assigned "as early as a month ahead"; "submissions without music will not be considered" | [Exclaim!](https://exclaim.ca/contact/getcoverage), read 2026-09-08 — the one Canadian outlet publishing a window |
| National music press (US) | premiere or exclusive, FFO line, publicist | 6–8 weeks | practitioner convention, unsourced |
| Mid-tier press, established blogs | exclusive premiere offer, story | 4–6 weeks | practitioner, unsourced |
| Smaller blogs | link, angle, short pitch | 2–4 weeks | practitioner, unsourced |
| Lifestyle & culture magazines, print | a person and a story (style, a cause, the making of), HD photos | monthlies close issues 2–3 months ahead — an EP or album, not a single | practitioner, unsourced |
| Lifestyle & culture magazines, web desk | short angle, photo, live link | 1–2 weeks; the realistic target for a single | practitioner, unsourced |
| Dailies | news or community angle, a date to hang it on | no Quebec or Canadian daily publishes a window | — |
| Release-day roundups | live link on release morning | day of | practitioner |

- **Embargo** — material sent early with a date before which it may not run;
  45% of journalists want more embargoed or early-access material (Cision 2026).
  The line reads `EMBARGOED UNTIL <date>` at the top (practitioner).
- **Exclusive / premiere** — one outlet runs it first; offered to exactly one,
  24–48 h before release (house convention, unsourced). Two outlets offered the
  same premiere ends both relationships.
- **The advance link** — an unlisted YouTube video or private SoundCloud stream;
  Exclaim! discourages Dropbox, Drive and download-only folders. Never an
  attachment; never a link that expires.

## Reaching them: yourself, or a publicist

**A publicist** writes the release, pitches, books interviews and is the outlet's
contact — on a monthly retainer, typically a 4–6-month contract around a
release, and "there are no guarantees … PR is not advertising"
([Ari's Take](https://aristake.com/whats-a-publicist-and-should-i-get-one/),
practitioner, updated 2020). Hire one when there is a story, a following and a
release or tour to point it at — not before. No trade body in Canada or the US
publishes what one costs; vendors' own rate cards cluster at USD 1,500–5,000 a
month with 2–4-month minimums, which is the vendors' account, not a benchmark.
Nobody publishes how rarely US national press covers an unsigned non-US artist
without a publicist; treat it as the long shot it is.

**Yourself** — cheap first, local first:

- Hometown papers, campus media and the cities on the tour route are the likeliest
  yes ([Ari's Take](https://aristake.com/how-to-write-a-press-release-and-get-press/)).
- 84% of journalists say the way to start a relationship is an email introducing
  yourself with nothing to pitch (Cision 2026).
- One person per outlet — the writer who covered a comparable act — never
  `info@`.
- Every edit the artist makes to a contact (tier, personal email, note) has no
  storage yet; see [`press-manage-contacts`](../skills/press-manage-contacts/SKILL.md).

## Tools and services for indie artists

The rows are **`catalog.tools`**, category `promotion` (SubmitHub, Hype Machine,
PlaylistPush, and the radio servicers promotion uses). What a paid pitching
service buys and never buys:

- **Buys** a guaranteed listen and a reply inside a window, per credit; Groover
  refunds the credit if no answer comes within 7 days
  ([Ari's Take](https://aristake.com/pr-for-indie-artists/), 2024).
- **Never buys** coverage. A product sold as "guaranteed coverage" is
  advertising, and the outlet's readers know it.
- **A press-release wire** (Cision, PR Newswire) sells reach to newsrooms, not
  music coverage; a per-contact, hand-adapted pitch is what journalists ask for
  (see [`press-writing.md`](./press-writing.md)).

## Where the three markets diverge

| | Quebec | Rest of Canada | United States |
|---|---|---|---|
| Language | French first; English only for outlets flagged `en` or `bilingual` | English | English |
| Angle that lands | community and local — the small-outlet audience *is* the community | national music press is reachable directly | competing globally; a Canadian angle is a curiosity, not a hook |
| Published lead times | none | Exclaim!'s month | none first-party; practitioner tiers above |
| Realistic without a publicist | dailies' culture desks, specialist web, culture TV via production | Exclaim!, alt-weeklies, blogs | blogs, alt-weeklies, college media |

## Sources

- [Cision, *State of the Media 2026* (PDF)](https://www.prnewswire.com/content/dam/prnewswire/resources/white-papers/Cision_2026_State_of_the_Media_Report.pdf) — read 2026-09-08.
- [Muck Rack, *State of Journalism 2026* press release](https://www.globenewswire.com/news-release/2026/03/19/3259178/0/en/muck-rack-s-2026-state-of-journalism-report-finds-82-of-journalists-use-ai.html) — the report page itself is bot-gated.
- [Exclaim! — Get Coverage](https://exclaim.ca/contact/getcoverage) — read 2026-09-08.
- [NPR Tiny Desk Contest rules](https://tinydeskcontest.npr.org/rules/) — read 2026-09-08.
- Ari's Take (practitioner): [publicist](https://aristake.com/whats-a-publicist-and-should-i-get-one/) · [press release](https://aristake.com/how-to-write-a-press-release-and-get-press/) · [PR alternatives](https://aristake.com/pr-for-indie-artists/).
