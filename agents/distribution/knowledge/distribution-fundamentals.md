---
name: distribution-fundamentals
description: >
  Use when the artist asks what a distributor is, what a percentage applies to,
  why one plan costs more than another, what happens when they stop paying, or
  how far ahead of release day they must deliver — the three layers of the
  market, the pots of money, the fee models, exit terms, lead times, and what no
  vendor publishes, for Quebec, Canada and the United States.
metadata:
  agent: distribution
  status: developed
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "2.0"
---

# Distribution fundamentals

A distributor is the delivery company between a finished master and the
stores. Spotify, Apple Music and Amazon accept music only from approved
providers ([Apple Music for Artists](https://artists.apple.com/support/1108-get-your-next-release-on-apple-music),
2026-09-08), so an artist cannot upload directly.

## The three layers

"Distributor" names three businesses. Spotify's own provider directory
([artists.spotify.com/directory/distribution](https://artists.spotify.com/directory/distribution),
2026-08-23) lists 98 — 21 "artist distributors", 77 "label distributors" — and
the third layer hides inside the second.

| Layer | Sells to | Recognise it by | Examples |
|---|---|---|---|
| **Artist-facing** | an individual artist | public price, open signup, self-serve upload | DistroKid · CD Baby · Amuse · Too Lost · Distribution Amplitude |
| **Label-facing** | a label, or an artist with a team | application, negotiated terms, no rate card | The Orchard · ADA · IDOL · AWAL · Believe |
| **Platform** | other distributors | an API, a white-label portal, DDEX versions quoted | AudioSalad · SonoSuite · Revelator · FUGA |

- A company can sit in two layers: LabelGrid sells annual plans to artists and
  an API to distributors; ONErpm starts self-serve and escalates to selective
  services.
- Layer is not quality. Label-facing needs traction an emerging artist does not
  have; AWAL and Stem select on existing streaming numbers.
- The platform under a distributor is provenance, not a choice: Amplitude runs
  on AudioSalad and says so; the artist's contract is with Amplitude.
- Ownership cuts across layers. Universal's acquisition of Downtown closed on
  European Commission approval dated 2026-02-13 ($775M;
  [ec.europa.eu, IP/26/385](https://ec.europa.eu/commission/presscorner/detail/en/ip_26_385)),
  bringing CD Baby (artist-facing), FUGA (platform) and Songtrust under Virgin
  Music Group; Curve was divested as a condition. "Independent" is a claim to
  check, not a category.

## The pots of money — a distributor collects one

| Pot | Triggered by | Quebec | Canada | United States |
|---|---|---|---|---|
| **Recording (master) royalties** | your *recording* is streamed or sold | **the distributor** | **the distributor** | **the distributor** |
| **Songwriting (publishing)** | the *song you wrote* is played | SOCAN (performance + reproduction) | SOCAN | ASCAP / BMI / SESAC / GMR + The MLC |
| **Performer / neighbouring rights** | the recording is played on radio or in public | Artisti · Re:Sound | ACTRA RACS / MROC · Re:Sound | SoundExchange |

- Every percentage in `catalog.distribution_services` applies to pot one. "CD
  Baby keeps 9%" is 9% of streaming royalties, not of everything earned.
- "Keep 100%" is a claim about one pot. Pots two and three are
  [`rights`](../../rights/knowledge/rights-fundamentals.md)' — who joins what,
  and why a US PRO collects US-only.
- Some distributors sell publishing collection as an add-on (CD Baby's CDB
  Boost, Ditto Pro). That is a second product, priced in
  [`distributor-knowledge.md`](./distributor-knowledge.md#add-ons-the-second-bill).

## Fee models

| Model | How it bills | Verified example | Read |
|---|---|---|---|
| **Flat subscription** | annual fee, 0% of store revenue | DistroKid $24.99 / $44.99 / $89.99 per year, "Keep 100% of earnings" ([distrokid.com/pricing](https://distrokid.com/pricing/)) · TuneCore $24.99 / $44.99 / $54.99 per year, 100% of digital-store sales ([tunecore.com/pricing](https://www.tunecore.com/pricing); [help centre](https://support.tunecore.com/hc/en-us/articles/115006501627-Do-I-keep-100-of-my-Digital-Sales)) | 2026-09-08 |
| **Free, funded by a cut** | no fee, a % of pot one | RouteNote 15% · UnitedMasters 10% · Symphonic 30% (each company's pricing page) | 2026-08-23 |
| **Pay per release** | one-time fee, then a permanent % | CD Baby $9.99 per single + 9% of streaming ([cdbaby.com/cd-baby-cost](https://cdbaby.com/cd-baby-cost/)) | 2026-08-21 |
| **Per track** | priced by track count | Soundrop $4.99/track + 15% ([soundrop.com/pricing](https://soundrop.com/pricing)) | 2026-08-23 |
| **Fee *and* a cut** | both; the cut falls as the plan rises | LabelGrid $99/yr keeps 85%, $499/yr keeps 90% ([labelgrid.com/pricing](https://labelgrid.com/pricing)) | 2026-08-23 |
| **Negotiated** | no rate card until they accept you | the whole label-facing layer | — |

- **Compare on the effective rate**: `fee + (cut × annual streaming revenue)`.
  A $99 fee and a 15% cut are the same bill at $660 a year; below that the cut
  is cheaper, above it the fee is.
- **"100%" stops at the store.** TuneCore takes 20% of TikTok, Meta and YouTube
  earnings on every paid plan ([tunecore.com/pricing](https://www.tunecore.com/pricing),
  2026-09-08). Social and UGC money is frequently a separate, higher rate;
  always name which pot a percentage applies to.
- **The plan price is not the bill.** Add-ons sit beside every artist-facing
  deal — [`distributor-knowledge.md`](./distributor-knowledge.md#add-ons-the-second-bill).

### DIY against the negotiated tier

- No company in the negotiated tier publishes a rate. Believe reports revenue by
  segment without one commission figure: Premium Solutions (negotiated)
  €942.2M against Automated Solutions (TuneCore) €64.6M in FY2024 — the DIY
  product is about 6% of that business
  ([MBW, 2025](https://www.musicbusinessworldwide.com/believe-generated-over-1-billion-in-2024-as-annual-revenues-grow-11-5-yoy/),
  read 2026-08-24). AWAL, The Orchard and ADA publish nothing.
- Industry write-ups put AWAL's entry tier at 15%, mid tier 20–30%, Believe
  premium at 15–30%. Every one is a third party's account — say "reported at",
  name who reported it, never quote it as the company's rate.
- The two tiers are different products: a DIY fee buys delivery; a negotiated
  share buys marketing, pitching, sync representation and often an advance. 15%
  and 0% are not one product at two prices.
- A term sheet the artist holds is the only real number. Explaining a clause is
  knowledge; whether to sign is not this department's call.

## Exit and lapse terms

| Company | If the subscription lapses | Source | Read |
|---|---|---|---|
| **DistroKid** | releases "may be removed" from stores; restored automatically when the past-due charge succeeds; earnings still paid. Leave a Legacy ($29 single / $49 album, one-time) keeps a release live through a lapse or cancellation | [help centre](https://support.distrokid.com/hc/en-us/articles/360013535494-What-Happens-If-I-Stop-Paying-the-Annual-Fee) | 2026-09-08 |
| **Too Lost** | releases stay live; the royalty share drops from 100% to 85% until the artist re-subscribes | [toolost.com/pricing](https://toolost.com/pricing/) | 2026-08-23 |
| **CD Baby** (pay per release) | no lapse — the fee was paid once; the 9% continues | [cdbaby.com/cd-baby-cost](https://cdbaby.com/cd-baby-cost/) | 2026-08-21 |
| every other subscription | silent — an unpriced risk; say so, never assume takedown or survival | pricing pages read 2026-08-23 | — |

- DistroKid is non-exclusive: an artist may use another distributor alongside
  or instead ([help centre](https://support.distrokid.com/hc/en-us/articles/360013647813),
  2026-09-08). `exclusivity_required` holds the others.
- What switching moves and what it loses is in
  [`distributor-knowledge.md`](./distributor-knowledge.md#switching-what-moves-what-stays).

## Lead time is two numbers

1. **The distributor's delivery window.** Three publish one: Amuse 24 hours,
   Too Lost same-day, LANDR 2–3 days (pricing pages, 2026-08-23). DistroKid's
   Spotify-pitch article asks for upload **3 weeks** before release day
   ([help centre](https://support.distrokid.com/hc/en-us/articles/360052022173),
   2026-09-08). Distributors' general guidance is 4–6 weeks.
2. **The platform's pitch deadline, added on top.** Spotify: delivered at
   least **7 days** before release ([Spotify for Artists](https://support.spotify.com/us/artists/article/pitching-music-to-playlist-editors/),
   2026-09-08). Apple, Amazon and Deezer are in
   [`distributor-knowledge.md`](./distributor-knowledge.md#pitching-through-the-distributor).

Release day is Friday; the whole sequence is
[`label-manager`'s](../../label-manager/knowledge/release-fundamentals.md).

## Three markets

### Quebec

- **Distribution Amplitude** is the only distributor priced in CAD: 40 / 109 /
  219 / 429 / 649 per year by artist count, a Montréal non-profit
  ([distributionamplitude.com](https://distributionamplitude.com/en/nos-forfaits/),
  2026-08-23), FR-first, sells labour (metadata entry, pitching, a consultation)
  where US companies sell automation.
- **A distributor is a funding gate.** Musicaction's album-production program
  requires "une entente avec une entreprise canadienne de distribution" —
  incorporated in Canada, in business two years or more, distributing more than
  one label ([musicaction.ca](https://musicaction.ca/programmes/production-dun-album/),
  2026-09-08). A US subscription does not qualify; Amplitude's claim that its
  members are eligible for Musicaction, Fonds RadioStar and FACTOR
  ([distributionamplitude.com](https://distributionamplitude.com/en/), 2026-09-08)
  holds on this rule. Programs and amounts are on each funder's own page.
- **Propagande** routes digital through Believe and competes on physical, about
  250 Canadian record stores (company site, 2026-08-23). Believe runs Montréal
  and Toronto teams in both languages; LANDR is headquartered in Montréal.

### Canada

- **FACTOR** keeps two lists (PDF published April 2023,
  [factor.ca](https://factorportalprod.blob.core.windows.net/portal/Documents/Updates/FACTOR_Recognized_Distributor_List.pdf),
  read 2026-09-08): a label qualifying as an Eligible Music Company needs a
  signed agreement with a **Recognized Distributor** (The Orchard, Outside,
  Propagande, Indie Pool, Sonic Unyon, Symphonic Canada…); an artist's proof of
  sales is accepted from those or from an **Accredited International
  Distributor** — DistroKid, CD Baby, TuneCore, LANDR, Believe, AWAL are on it.
  Choosing a DIY distributor does not cost an artist FACTOR eligibility; it
  costs a *label* its Eligible Music Company status.
- Every other price in the market is USD; a Canadian comparing them is
  comparing pre-exchange numbers.

### United States

- No CAD pricing and no funding hook — compare on cost, cut and service.
- Major ownership is the check: CD Baby reads as a DIY aggregator and is
  Universal-owned since 2026-02-13; ADA is Warner's; AWAL is Sony's.

## What no vendor publishes

- **Bandcamp and SoundCloud delivery.** No standard distributor delivers to
  Bandcamp; the artist uploads there. SoundCloud runs its own distributor and
  takes no others (both sites, 2026-08-23).
- **A real store list.** Five companies claim "150+", Too Lost 450+, Amplitude
  40+; UnitedMasters prints "150+" and "over 35" on two of its own pages
  (2026-08-23). A store count is a claim with the vendor's name on it, never
  coverage.
- **A negotiated rate**, in any filing or agreement found; Believe's segment
  report is the closest and states none.
- **Symphonic's percentage on YouTube, Meta and TikTok** — it confirms a charge
  and withholds the rate ([symphonic.com/pricing](https://symphonic.com/pricing/),
  2026-08-23). **LANDR's, Indie Pool's and Propagande's prices** — none
  published.
