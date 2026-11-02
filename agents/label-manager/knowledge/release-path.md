---
name: release-path
description: >
  Use when the artist asks "what happens when, and who does it" — every step
  of a release from recording to the post-release read, each with the department
  that owns it, its sourced lead time, and at most three best practices. The
  exact day offsets the plan prints are code, in
  skills/manager-plan-release/scripts/milestones.ts.
metadata:
  agent: manager
  status: developed
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "2.0"
---

# The release path

Every date counts back from the street date — a Friday
([IFPI, 2015](https://www.musicweek.com/news/read/ifpi-confirms-friday-global-release-day/060991)).
The plan starts at the longest lead time in it: vinyl (12 weeks), else the
press advance (8 weeks), else the upload (4 weeks). Each step below names the
department that owns it; that department's `knowledge/` holds the detail and
the Label Manager may read it. Why these dates matter, and the gates between
them, are in [release-fundamentals.md](./release-fundamentals.md).

## 1. Creation

- **What happens.** Writing, tracking, mixing, mastering, cover art, lyrics.
- **Who.** Nobody on staff — the artist and their engineer. No agent makes
  music; no department makes visual art.
- **When.** No studio, mix or mastering turnaround is published by anyone we
  could cite (searched 2026-09-08), so the plan asks the artist for the
  masters date. Masters are due at the first thing that needs them: the plant
  (12 weeks out), the advance link (9 weeks — one week before the link goes
  up), or the upload.
- **Best practice.**
  - Choose the lead single before the upload: Spotify allows one pitch per
    song and none once it is live
    ([Spotify](https://support.spotify.com/us/artists/article/pitching-music-and-videos-to-playlist-editors/), 2026-09-08).
  - Artwork is due with the upload, or with the pressing order when there is
    a jacket ([CD Baby](https://diymusician.cdbaby.com/releasing-music/music-distribution-guide/), 2026-09-08).
  - Splits are agreed in writing before the mix exists — after, it is a
    negotiation.

## 2. Rights and credits

- **What happens.** Splits, ISRC/UPC, society registrations, licences for
  covers, the CREDITS document.
- **Who.** [`rights`](../../rights/knowledge/rights-fundamentals.md) for
  every row that pays someone; the Label Manager assembles the credits
  (`manager-build-credits`).
- **When.** Splits two weeks before the masters. Codes at the upload, or at
  the pressing order when a barcode goes on a jacket. Registrations filed with
  the codes and no later than release day, so week-one plays resolve to the
  right person. A cover on a **physical** release needs a CMRRA
  Pay-As-You-Press licence with the pressing order — the application requires
  a "Confirmation of Units Pressed", minimum 500 per format; digital needs
  none ([CMRRA](https://www.cmrra.ca/pay-as-you-press/), 2026-09-08).
  Copyright registration is voluntary in Canada and has no deadline
  ([CIPO](https://ised-isde.canada.ca/site/canadian-intellectual-property-office/en/what-you-should-know-about-copyright), 2026-08-27).
  Quebec: works declared to [MétaMusique](https://metamusique.ca/) with the
  codes; Canada: Re:Sound via Artisti / ACTRA RACS and Panorama; US:
  [SoundExchange](https://www.soundexchange.com/artist-copyright-owner/register/)
  — who joins what is [rights-fundamentals](../../rights/knowledge/rights-fundamentals.md).
- **Best practice.**
  - Credits are finished before the upload; they travel in the distributor's
    DDEX delivery and a credit added after never appears.
  - A session performer with no IPN is unpaid money, not a formatting nit.
  - An uncleared sample blocks delivery.

## 3. Manufacturing

- **What happens.** Vinyl or CD run, test pressing, merch.
- **Who.** Nobody on staff — the artist sources the plant. `distribution`
  delivers to stores; it never presses.
- **When.** Vinyl: "8 to 12 weeks, depending on plant workload, though this
  can stretch during peak seasons (like Record Store Day)"
  ([Microforum](https://www.microforum.ca/blog/how-to-get-an-album-pressed-on-vinyl), 2026-09-08);
  the plan uses 12. The test pressing sits inside that window on the plant's
  day. No Canadian plant we read publishes a CD turnaround or a merch lead
  time; those steps ship undated with the reason on the line.
- **Best practice.**
  - Listen to the test pressing "all the way through, more than once, on
    different systems" (Microforum); a refusal moves the run.
  - The plant quotes; no list price exists.
  - Reserve a merch window so it never collides with release week.

## 4. Distribution

- **What happens.** Distributor chosen, release uploaded with audio, artwork,
  codes, writer and publisher credits, track attributes, discovery text and a
  payment method ([CD Baby](https://diymusician.cdbaby.com/releasing-music/music-distribution-guide/), 2026-09-08).
- **Who.** [`distribution`](../../distribution/knowledge/distribution-fundamentals.md);
  specs in [delivery-requirements](../../distribution/knowledge/delivery-requirements.md).
- **When.** Distributors state their own floors: CD Baby "set a release date at
  least four weeks out"; DistroKid "at least 3 weeks ahead" for Spotify
  editorial consideration
  ([DistroKid help](https://support.distrokid.com/hc/en-us/articles/360052022173), 2026-09-08).
  Spotify's floor is 7 days before release
  ([Spotify](https://support.spotify.com/us/artists/article/pitching-music-and-videos-to-playlist-editors/)).
  Delivery itself is hours to days and no distributor publishes it.
- **Best practice.**
  - Claim Spotify for Artists and Apple Music for Artists right after the
    upload — the distributor grants it at once; a manual request takes days
    ([Spotify](https://support.spotify.com/us/artists/article/getting-access-to-spotify-for-artists/), 2026-09-04).
  - Lyrics go through Musixmatch before release to be live on day one
    ([Spotify](https://support.spotify.com/us/artists/article/managing-your-lyrics-on-spotify/), 2026-08-27).
  - US only: Pandora takes a submission once the record is out
    ([CD Baby](https://diymusician.cdbaby.com/releasing-music/boring-important-album-release-checklist-ever/), 2026-08-27).

## 5. Presskit

- **What happens.** Bio, photos, one-sheet, the deck press and radio open.
- **Who.** [`presskit`](../../presskit/knowledge/presskit-fundamentals.md).
- **When.** Finished 8 weeks out, before the advance link — the first pitch
  goes out with it ([press-fundamentals](../../press/knowledge/press-fundamentals.md)).
- **Best practice.**
  - French first for Quebec, English as soon as the release goes past it.
  - One private, non-expiring listening link: Exclaim! refuses download-only
    folders ([exclaim.ca](https://exclaim.ca/contact/getcoverage), 2026-08-14).

## 6. Press

- **What happens.** Advance link, pitches, one follow-up, one premiere, the
  release-day send.
- **Who.** [`press`](../../press/knowledge/press-fundamentals.md); the pitch
  itself is [press-writing](../../press/knowledge/press-writing.md).
- **When.** 8 weeks before to 8 weeks after. Advance link at 8 weeks; pitch
  at 4–6 — Exclaim! assigns album reviews up to a month ahead
  ([exclaim.ca](https://exclaim.ca/contact/getcoverage), 2026-08-14); one
  follow-up 2 weeks out; premiere 24–48 h before; press release wide on
  release day.
- **Best practice.**
  - A story angle, never "review my record".
  - One follow-up; two is the cap.
  - Exactly one premiere.

## 7. Promotion

- **What happens.** Radio serviced, Spotify editorial pitched, independent
  curators pitched, follow-ups, charts read.
- **Who.** [`promotion`](../../promotion/knowledge/radio-pitch.md) —
  [radio-pitch](../../promotion/knowledge/radio-pitch.md) and
  [playlist-pitch](../../promotion/knowledge/playlist-pitch.md).
- **When.** Radio 6–8 weeks before release; first follow-up three weeks after
  servicing, the second and last in release week. Editorial pitch ≥7 days
  before release (Spotify's floor), 2 weeks in Spotify's own release guide
  ([Spotify](https://artists.spotify.com/en/blog/release-guide-preparing-for-release-day), 2026-09-08);
  the plan aims at 4 weeks and names the floor. Independent curators need a
  live link: release week, one follow-up two weeks later. Canada: !earshot
  charts weekly, weeks 1–8 ([earshot-online.com](https://www.earshot-online.com/charts.cfm), 2026-08-14).
- **Best practice.**
  - Canada: campus and community first — 35% Canadian content, 65% French on
    French-language stations ([CRTC](https://crtc.gc.ca/eng/cancon/r_cdn.htm)).
    US: no quota; college radio is the same door.
  - A lead single gets its own pitch two weeks before *its* day.
  - Delivery services buy no airplay; the follow-up is the job.

## 8. Marketing

- **What happens.** Content shot, campaign live, pre-save, Countdown Page,
  Canvas, ads.
- **Who.** [`digital-marketing`](../../digital-marketing/knowledge/marketing-fundamentals.md).
- **When.** The arc is 4 weeks before to 4 weeks after
  ([marketing-fundamentals](../../digital-marketing/knowledge/marketing-fundamentals.md));
  content exists one week before the campaign. Pre-save the day after the
  upload. Countdown Page: option appears within 72 hours of delivery; albums
  and EPs only; ≥3,000 monthly listeners
  ([Spotify](https://support.spotify.com/us/artists/article/getting-started-with-countdown-pages-on-spotify/), 2026-09-08).
- **Best practice.**
  - A Canvas per track, 3–8 seconds (Spotify release guide).
  - Milestones here, tasks there: "post the teaser Tuesday" is marketing's.
  - Budget: [paid-promotion](../../digital-marketing/knowledge/paid-promotion.md).

## 9. Release day

- **What happens.** Friday, 00:01 local. Press release goes wide; curators
  get the live link; the single, once live, can never be pitched again.
- **Who.** The artist. Nothing to hand off.
- **When.** Day 0.
- **Best practice.**
  - Check credits and lyrics on the stores the same morning; a fix goes
    through the distributor and shows within about 7 days on Spotify
    ([Spotify](https://support.spotify.com/us/artists/article/song-credits/), 2026-09-08).

## 10. Post-release

- **What happens.** Numbers read, radio and curator follow-ups, charts,
  campaign tail.
- **Who.** [`platforms`](../../platforms/knowledge/reading-a-trend.md) reads;
  `promotion`, `press`, `digital-marketing` finish their windows.
- **When.** Spotify: "a week after your release date is a perfect time to
  dive into your numbers"; "75% of a release's first-year streams happen after
  the first month" ([Spotify](https://artists.spotify.com/en/blog/release-guide-preparing-for-release-day), 2026-09-08).
  Press to week 8; charts weeks 1–8; campaign to week 4.
- **Best practice.**
  - Do not stop the campaign at week one.
  - Read change, never cause ([reading-a-trend](../../platforms/knowledge/reading-a-trend.md)).
