---
name: radio-pitch
description: >
  Use when the artist wants their record on the radio — why Canadian stations
  must play Canadians and American ones need not, which kind of station an
  unsigned artist can actually enter in Quebec, Canada and the US, how each is
  reached, when to deliver and follow up, and how to read the charts afterwards.
metadata:
  agent: promotion
  status: draft
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.2"
---

# Radio: who plays an independent record, and how it reaches them

Getting the record **played** is this department; getting it **written about**
is [`press`](../../press/AGENT.md). Canada and the United States are two
campaigns: a Canadian station is legally obliged to play Canadians, an American
station owes nobody anything.

## Canada — the quota is the demand

All figures are the CRTC's. Broadcasting Notice of Consultation
[CRTC 2025-52](https://crtc.gc.ca/eng/archive/2025/2025-52.htm) states the
preliminary view that "all existing Canadian and French-language content
requirements should be maintained for traditional radio undertakings"; the
May 2026 decision that followed
([CRTC 2026-95](https://crtc.gc.ca/eng/archive/2026/2026-95.htm)) covers
audio-visual only.

| Licence class | Requirement ([CRTC, Canadian content](https://crtc.gc.ca/eng/cancon/r_cdn.htm) · [French vocal music](https://crtc.gc.ca/eng/cancon/r_french.htm), read 2026-08-14) |
|---|---|
| Commercial — popular music | ≥35% Canadian each week, **and** ≥35% between 6 a.m. and 6 p.m. Mon–Fri |
| Campus and community — popular music | ≥35% Canadian each week |
| Campus and community — special-interest music | ≥12% Canadian each week |
| Commercial — special-interest music | ≥10% Canadian; ≥25% of concert music; ≥20% of jazz and blues |
| French-language commercial | ≥65% of popular vocal music in French each week, **and** ≥55% between 6 a.m. and 6 p.m. Mon–Fri |
| French-language campus and community | ≥65% of vocal music in French each week |
| Ethnic radio, during ethnic programming | ≥7% Canadian |

- **Canadian is scored, not assumed.** A selection qualifies under **MAPL** —
  Music, Artist, Performance, Lyrics — by meeting **2 of the 4**
  ([CRTC](https://crtc.gc.ca/eng/info_sht/r1.htm), read 2026-08-14).
- **A French-language artist has two quotas working for them.** The 65%
  francophone floor is stricter than the 35% CanCon floor, which is why Quebec
  is a different market, not a smaller one.
- **The United States has no equivalent.** No FCC rule sets a content share; a
  US commercial playlist is a commercial decision end to end.

## Station types, and how each is entered

The tier is the whole ranking: an unsigned artist is answered by campus,
community and public radio, and is not answered by commercial radio without a
promoter. Station rows — call sign, tier, route, quoted rules, `last_verified`
— are `catalog.promotion_radio_stations`; this file holds the pattern, never the
list.

| Tier | Quebec | Canada | United States |
|---|---|---|---|
| **Campus / community** — student or volunteer music directors, rotate each semester | ~10 stations (Montréal, Québec, Trois-Rivières, Sherbrooke); pitched **directly**, one station at a time; 3 of them also take **!earshot Distro** | NCRA/ANREC members — "125 not-for-profit campus and community radio stations, with 97 of them being licensed" ([earshot-distro.ca](https://earshot-distro.ca), read 2026-09-03); reached directly or through **!earshot Distro** | College radio; reached directly, or through a **Play MPE** package by format; no national association sells one door |
| **Public / non-commercial AAA** — paid music directors | ICI Musique (Radio-Canada), reached through **45tours** like every francophone station | CBC Music: `music.library@cbc.ca`, WAV with art and credits plus bio or kit; the address does not reply ([CBC help](https://cbchelp.cbc.ca/hc/en-ca/articles/360053110533)) | KEXP, KCRW, WXPN, KUTX, WFUV, WFMU each publish a route (below). **NPR Music** publishes none for artists: `nprmusicpitches@npr.org` is "not the place… for artists or publicists to lobby for coverage" ([NPR](https://www.npr.org/2022/03/30/1084320603/npr-music-feature-pitch-guide)) |
| **Commercial** — programmers; a promoter's relationship | francophone commercial radio receives singles through **45tours** | delivery through **Yangaroo DMDS**; the follow-up is a radio promoter's, whose rates no association or trade body publishes | delivery through **Play MPE** or DMDS; same promoter economics, no published rates |

### What a station's published rules look like

Every rule below is quoted from the station's own page and stored in
`catalog.promotion_radio_stations.stated_rules`; read the station, never
generalize.

- **Singles refused.** CKUT: "No singles" except 7″ vinyl, ≥3 distinct tracks
  ([ckut.ca](https://ckut.ca/submit-music-to-ckut/)); CJSW: "WE DO NOT ACCEPT
  SINGLES!", digital only, released within 3 months
  ([cjsw.com](https://cjsw.com/music/submit/)); CFBX prefers a physical CD and
  **rejects all music made with generative AI** ([thex.ca](https://thex.ca/contact/)).
- **Attachments refused, links required.** KEXP: "Streaming and download (WAV
  files) links for your music - no attachments please!", to `md@kexp.org`,
  "Don't send physical submissions" and "Don't expect a response (even from
  individual DJs)" ([kexp.org](https://www.kexp.org/about/submission-guidelines/),
  read 2026-09-08). KUTX: `music@kutx.org`, subject "Music Submission –
  [Artist]", a streaming link **and** "a link to download a WAV file (Dropbox
  or Google Drive preferred—no MP3 attachments!)"; "we receive a large amount of
  music and do not have capacity to respond"
  ([kutx.org](https://kutx.org/submit-your-music/), read 2026-09-08). CISM:
  MP3 320 with clean metadata, transfer links **including WeTransfer**, no CDs
  ([cism893.ca](https://cism893.ca/soumettre-un-album)).
- **Expiring links refused.** CKRL: Dropbox or Drive only, "no attachments and
  no expiring links like WeTransfer" ([ckrl.qc.ca](https://ckrl.qc.ca/contactez-nous)).
  The WeTransfer rule is per-station, not a house rule.
- **Physical only.** WFMU: vinyl, CD, CD-R or cassette to PO Box 2011, Jersey
  City NJ 07303-2011, no digital option
  ([wfmu.org](https://wfmu.org/sendmusic.html), read 2026-09-08). WFUV: CDs to
  the Music Dept., Fordham University, Bronx NY 10458; "Call Wednesdays 5-7pm
  for feedback"; its local-artist slot *NY Slice* takes an FCC-clean MP3 or WAV,
  bio and links at `nyslice@wfuv.org` ([wfuv.org/about](https://wfuv.org/about)
  · [wfuv.org/nyslice](https://wfuv.org/nyslice), read 2026-09-08).
- **A form, not an address.** WXPN: "Complete the form below to submit your
  music for on-air programming consideration"
  ([xpn.org/submit-music](https://xpn.org/submit-music/), read 2026-09-08).
  KCRW: an FCC-clean `.wav` or `.aiff` to `music@kcrw.org`; *Morning Becomes
  Eclectic* has no separate route
  ([KCRW help](https://help.kcrw.com/hc/en-us/articles/52458315602331), read 2026-09-04).
- **No route at all.** CHOQ.ca, CFOU, CFLX and CKCU publish no artist music
  channel; a general contact address is a last resort, printed as unknown.
  "CHOQ 106.1 Montréal" does not exist — CHOQ.ca is UQAM's web-only station,
  and CHOQ-FM 105,1 is a Toronto francophone community station.
- **The Tiny Desk Contest is closed to Canadians** — residents of the fifty US
  states, DC, USVI and Puerto Rico only ([rules](https://tinydeskcontest.npr.org/rules/)).

## Delivery and tracking services — what a paid service buys and never buys

The priced rows — currency, unit, tiers, published or login-walled, reach as
the vendor states it — are `catalog.promotion_radio_services`; the link-level
row is `catalog.tools` (category `promotion`). Neither buys a second of
airplay, and every vendor says so on its own page.

| Buys | Service · unit | Never buys |
|---|---|---|
| **Delivery** to francophone Canadian radio, all tiers; listens and downloads per station in real time | 45tours — per title, per EP, per album ([commentCaMarche](https://www.45tours.ca/commentCaMarche), read 2026-09-04) | the music director's name or email; the follow-up |
| **Delivery** to Canadian campus and community radio, run by the NCRA/ANREC | !earshot Distro — per song, per album; referral discount ([earshot-distro.ca/cost](https://earshot-distro.ca/cost/), read 2026-08-14) | airplay; a FACTOR rating — NCRA says charting "gives you an opportunity to increase your FACTOR rating", [FACTOR's own ratings page](https://www.factor.ca/artists/artist-profiles-ratings/) never mentions campus radio |
| **Delivery** to commercial radio, Canada and US; PRO tier adds "reports detailing who has accessed your music" | Yangaroo DMDS — free BASIC or monthly PRO, priced per format package; a US example is published, Canadian formats sit behind the estimator ([yangaroomusic.com/pricing](https://yangaroomusic.com/pricing/), read 2026-09-04) | airplay; any contact |
| **Delivery** to "radio programmers, music directors, media professionals, and music supervisors" by format, US and international; opens, downloads, clicks reported | Play MPE Caster — per package ([plaympe.com/promote](https://www.plaympe.com/promote/), read 2026-09-04) | airplay |
| **The follow-up** (*la relance*): radio edit, pitch, upload, "suivis auprès des directeurs et programmeurs musicaux" | a radio promoter / *pisteur radio*, e.g. Promo-Radio Gébé on [45tours.ca/pisteurradio](https://45tours.ca/pisteurradio/promo-radio-gebe); quote-only — no body publishes promoter rates in Canada or the US | a guaranteed add |
| **Tracking** — where the song was actually spun | Spinitron — free keyword search of 24 hours, paid history tiers ([spinitron.com](https://spinitron.com/m/about/for-music-industry), read 2026-09-03) | anything forward-looking |
| **Guaranteed placement** | — | legitimate at any price; see [`playlist-pitch.md`](./playlist-pitch.md) |

- **No delivery tool hands you a contact list.** All four report *who listened*;
  none gives an address. The follow-up is built from each station's own site.
- **A campus campaign in Canada starts at one song on !earshot Distro**, which
  is why this department never opens with a service the artist cannot afford.

## From delivery to follow-up

| Step | When | Why |
|---|---|---|
| Deliver to campus/community (CA) and college/public (US) | **6–8 weeks before release** | stations program weeks ahead. No station or chart publishes a lead time; this is the practitioner range ([ReverbNation blog](https://blog.reverbnation.com/college-radio-promotion/), tier 5) |
| Deliver to francophone radio through 45tours | same window, all titles notified on one chosen day | the EP rate assumes one notification day |
| First follow-up to every music director who received it | **2 weeks before release** | one email or call, five sentences, link only |
| Second and last follow-up | release week | the two-follow-up cap [`press`](../../press/AGENT.md) also keeps |
| Read the charts | weekly, **weeks 1–8** after release | !earshot and NACC publish weekly; "at college radio, an album will keep current for about two months" (ReverbNation, tier 5) |

**Before delivering:** the final master (WAV), a radio edit if the song runs
past 3:30 or has language a station cannot air, the cover, a five-sentence pitch
in the station's language, and the ISRC ([`rights`](../../rights/AGENT.md)
issues it).

## The follow-up in Quebec: doing it yourself, or hiring a pisteur

A *pisteur radio* (radio promoter, "tracker") gets music directors to add the
song, then pushes its rotation up week after week. Martin Véronneau (Local9,
three Félix for radio promotion team of the year) says an independent can do it
alone first: "il peut être très bien de faire d'abord ses premières expériences
seul" ([Local9, *Comment jouer à la radio*, 2021](https://local9.ca/docs/guide_promotion_radio.pdf), read 2026-09-28).

**Doing it yourself — his steps:**

1. **Pick the one single most stations can play.** The target is the Top 100
   of the *Palmarès de l'ADISQ* — the industry's weekly chart, "deux Top 100
   différents". Hire the pisteur (if any) *before* choosing: their read of the
   format changes the choice.
2. **Write the communiqué.** Title, performer, length, writer and composer, and
   the story behind the song — hosts read it on air too, so no typos.
3. **Deliver** through 45tours, Yangaroo DMDS or PromoJukeBox (PromoJukeBox
   needs your own address list). Never send an unsolicited WAV: "ils
   n'acceptent pas les chansons non sollicitées".
4. **Call each music director a few days later.** Introduce yourself; confirm
   the song fits that station's format. "Faites vos devoirs avant."
5. **Once added, call weekly** at the day and hour agreed with each director
   ("prévoyez d'avance ces périodes de pistage avec lui"). Ask for the number
   of spins, not just "light / medium / heavy". The goal is most stations
   ranking it high *in the same week* — that is what reaches the Palmarès.
   "Le pistage radio consiste en 90 % de psychologie et 10 % de connaissances."

Keep expectations low for Montréal and Québec City commercial stations; the
guide says so plainly.

**Hiring one.** Find agencies in the ADISQ member directory, category *Agence
de promotion*, or at the bottom of other artists' single announcements. Ask
for references from clients *and* music directors, check their radio record in
your style, and hire only one who genuinely likes the song. A pro runs
"suivis hebdomadaires assidus par courriel et par téléphone" and sends "le
rapport hebdomadaire à chaque lundi" ([PURCOM](https://purcom.ca/le-metier-de-pisteur-radio-demystifie/), read 2026-09-28).
Examples: Local9, PURCOM, Promo-Radio Gébé. **No agency publishes a rate** —
always a quote.

**This is not the two-follow-up cap.** Before an add, the cap in the table
above holds. After a station adds the song, the weekly call is the job itself,
agreed with that director.

## Reading the charts

- **!earshot** (Canada) — public weekly charts at
  [earshot-online.com](https://www.earshot-online.com/charts.cfm). "Around 20
  stations submit weekly charts"; "charted" is "typically being played on more
  than 5 stations/week"; the guide recommends complete releases (7+ tracks)
  over singles ([NCRA guide](https://earshot-distro.ca/how-to-distribute-music-to-canadian-radio/),
  read 2026-09-08). How many stations receive from Distro is not settled by the
  vendor itself — 125 and "over 115" on two of its pages, 52 in the directory.
- **NACC** — the North American College & Community Radio Chart, US **and**
  Canada; "The weekly NACC 200 and Top 30 Genre Charts". Free: "the free NACC
  200 industry blast in your inbox weekly"; paid subscribers get "Weekly raw
  reporting data from all reporting stations"
  ([naccchart.com](https://naccchart.com/), read 2026-09-08).
  **Stations report; artists do not submit** — "Please have your radio station's
  music or program director reach out to support@naccchart.com". NACC publishes
  no reporter list; its "new reporters" post names ~40 (CILU Thunder Bay, CJAM
  Windsor, KRUA Anchorage, KTRU Houston, WMSE Milwaukee, WSUM Madison…)
  ([naccchart.com/news](https://naccchart.com/news/new-nacc-reporters-this-week/),
  undated). Charting is a consequence of being played, never a thing to buy.
- **Spins, not charts** — Spinitron (above) answers "was I played" station by
  station; it is the only radio-tracking product with a published price.
