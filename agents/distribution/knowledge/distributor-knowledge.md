---
name: distributor-knowledge
description: >
  Use when the artist already has a distributor and asks how to live with it —
  where its own rules are published, whether it can pitch Apple, Amazon or
  Deezer for them, when the money arrives and what the statement shows, what
  moves and what stays when they switch, and what a named add-on (CDB Boost,
  Store Maximizer, Leave a Legacy) costs and covers.
metadata:
  agent: distribution
  status: developed
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "2.0"
---

# Living with a distributor

## The company's own rules

| The question | The authority |
|---|---|
| "What does Spotify accept?" | the store — [`delivery-requirements.md`](./delivery-requirements.md) |
| "What does **CD Baby** accept, pay, take down?" | that company's help centre |

- The route is `catalog.distribution_services.help_center_url`, the front door;
  `spec_url` is one article. Send the artist to the article when the question
  matches it, to the root otherwise — payouts, takedowns, transfers, tax forms
  and lapses have no column.
- A `null` there means nobody looked; only a row listing `help_center_url` in
  `not_stated` publishes none (support by phone or a logged-in ticket) — say so,
  and give the route the company offers instead.
- A help centre is authoritative for *that company's upload form* only. One
  that says "3000×3000" is usually repeating Apple's recommendation as its own
  floor; the store spec caps every distributor at once.

## Pitching through the distributor

Each store runs its own editorial pitch; the distributor's job is delivery, and
only Apple and Deezer make the distributor the pitcher.

| Store | Who pitches | Where | Timing | Source | Read |
|---|---|---|---|---|---|
| **Spotify** | the artist or team (Admin / Editor) | Spotify for Artists | deliver ≥ **7 days** before release; one song at a time; a pitch ≥ 7 days early guarantees the followers' Release Radar | [support.spotify.com](https://support.spotify.com/us/artists/article/pitching-music-to-playlist-editors/) | 2026-09-08 |
| **Apple Music** | the label or distributor only | Apple Music Pitch, inside Apple Music Connect ("Apple Music for Partners") | Apple publishes no public deadline; distributors' own guidance says ≥ 10 days, reported not published | [musicconnect.apple.com](https://musicconnect.apple.com/) | 2026-09-08 |
| **Amazon Music** | the artist team (Owner / Admin) — the label team may pitch once too | Amazon Music for Artists → Profile & Tools → Pitch | the track must already be delivered; one track per release; accepted **up to 14 days after** street date; a previously released track is ineligible | [Amazon help centre](https://intercom.help/amazon-music-for-artists/en/articles/6971478-pitch-tool) | 2026-09-08 |
| **Deezer** | Provider or Label accounts only — "artists and managers cannot directly access" | Deezer for Creators Pitching Tool | pitch and deliver **7 days** before release; accepted up to 14 days after; no edits within 24 h of release; needs UPC, focus-track ISRC, genre, target team | [creatorsupport.deezer.com](https://creatorsupport.deezer.com/hc/en-us/articles/14963453830045-Pitching-Tool) | 2026-09-08 |

- Ask the distributor two things before signing: *do you submit Apple Music and
  Deezer pitches for self-serve artists, and by what date do you need the
  pitch text?* Amplitude sells this as a paid service (see add-ons); no US
  subscription company publishes whether it pitches Apple on an artist's behalf.
- Which playlists to pitch and what to write is
  [`promotion`'s](../../promotion/knowledge/playlist-pitch.md).

## Payout cadence and statements

Stores report to the distributor one to two months after the month of
listening; the distributor pays after that. First money usually lands about
three months after release.

| Company | Statement cadence | Payout | Minimum and fees | Source | Read |
|---|---|---|---|---|---|
| **DistroKid** | as each store reports, "every 1–2 months", some once or twice a year; majority visible ~3 months after release | withdraw on request from the Bank page; 100% passed through minus banking fees and taxes | not stated on the page | [help centre](https://support.distrokid.com/hc/en-us/articles/360013547274-How-and-When-Do-I-Get-Paid) | 2026-09-08 |
| **TuneCore** | stores report a whole month on a two-month delay (January sales post in March); posted every weekend as reports arrive | into the TuneCore balance, then withdrawn | publishing-admin royalties separately, 45 days after each quarter; first publishing payment 9–12 months | [sales reports](https://support.tunecore.com/hc/en-us/articles/115006684648-When-Will-I-Receive-My-Music-Sales-Reports) · [publishing](https://support.tunecore.com/hc/en-us/articles/115006502487-When-do-I-get-paid) | 2026-09-08 |
| **CD Baby** | as partners pay | **weekly**, automatic once the balance passes the artist's Pay Point | ACH $1 · SEPA $3 · SWIFT $20; fees $2.50 PayPal, $3 non-US bank, $10–25 wire; **24% (US) / 30% (non-US) withheld without a valid tax ID** | [help centre](https://support.cdbaby.com/hc/en-us/articles/211074743-How-do-I-get-paid-from-CD-Baby) | 2026-09-08 |
| **Too Lost** | monthly | PayPal, Venmo, Stripe, ACH, Tipalti | stated on the pricing page | [toolost.com/pricing](https://toolost.com/pricing/) | 2026-08-23 |

- A statement line at zero earnings is normal: free-trial listeners, and
  Spotify's country-weighted payout, can round a stream below a cent
  ([DistroKid help centre](https://support.distrokid.com/hc/en-us/articles/360013534654), 2026-09-08).
- Artificial-streaming penalties arrive as negative lines — Spotify about
  $10–11 per flagged track per month, Apple a percentage adjustment
  ([CD Baby help centre](https://support.cdbaby.com/hc/en-us/articles/43828121344525), 2026-09-08).
- The tax form behind the withholding (W-8BEN for a Canadian) is
  [`rights`'](../../rights/knowledge/rights-fundamentals.md).

## Switching: what moves, what stays

1. **Upload to the new distributor first, with identical ISRCs, UPC, titles,
   artist names, audio and original release date.** Stores match on ISRC; a
   new ISRC is a new track with zero plays
   ([DistroKid](https://support.distrokid.com/hc/en-us/articles/360013648133) ·
   [CD Baby](https://support.cdbaby.com/hc/en-us/articles/360029584792), both 2026-09-08).
2. **Take the old release down only after the new one is live.** A duplicate
   for a few days is expected.
3. **Play counts and playlist positions usually carry over, and no distributor
   guarantees it** — CD Baby: "can't guarantee all partners will carry over
   counts, reviews, or playlist placements".
4. **What does not move:** a release a store removed for artificial streaming or
   a policy breach — delivery fails again and the distributor will not appeal.
5. **Identifiers stay yours if they were yours.** A distributor-issued ISRC is
   free and portable once assigned; a distributor-issued UPC is reused on the
   same release. Who issues what is
   [`rights`'](../../rights/knowledge/rights-fundamentals.md).

## Add-ons: the second bill

An add-on is chosen and billed separately from the plan. A feature inside a
plan already paid for is not one; calling it one invents a bill.

| Shape | How it bills | Example |
|---|---|---|
| **1 · A fee** | one-time or annual, per release or track | DistroKid Store Maximizer, $7.95 per album per year |
| **2 · A fee *and* a cut** | charges to exist, then keeps a share of what it collects | any YouTube Content ID product: annual fee plus a % of recovered revenue |
| **3 · Free inside something else** | a sticker price, waived in a higher product | CDB Boost, $39.99 alone, free on CD Baby Pro releases |

Never quote shape 2 as shape 1: "$14.95 a year" for a product that also keeps
20% understates the bill at every revenue level. `addons` keeps `price` and
`cut_pct` apart for this reason.

| Distributor | Add-on | What it does | Price | Source | Read |
|---|---|---|---|---|---|
| CD Baby | **CDB Boost** | registers the songs with The MLC, the recordings with SoundExchange, and enters the catalog in CD Baby's sync pitching | $39.99 per single or album, one-time; free on CD Baby Pro releases (help centre, not the product page) | [cdbaby.com/cdb-boost](https://cdbaby.com/cdb-boost/) | 2026-09-04 |
| TuneCore | **Additional artist profile** | a second artist under one account | $14.99 per profile | [tunecore.com/pricing](https://www.tunecore.com/pricing) | 2026-09-08 |
| TuneCore | **Social monetization** | collects TikTok, Meta and YouTube earnings — not opt-in, a cut on that pot | 20% of social revenue, every paid tier | [tunecore.com/pricing](https://www.tunecore.com/pricing) | 2026-09-08 |
| TuneCore | **Dolby Atmos delivery** | Atmos master delivered to Apple Music | $16.99 per release | [help centre](https://support.tunecore.com/hc/en-us/articles/10511913953812) | 2026-09-08 |
| DistroKid | **Store Maximizer** | auto-delivers to stores DistroKid adds later | $7.95 per album per year | [Album Extras](https://support.distrokid.com/hc/en-us/articles/360013534274-What-Are-Album-Extras) | 2026-09-04 |
| DistroKid | **Leave a Legacy** | keeps the release live after a lapse or cancellation | $29 single · $49 album, one-time, per release | [help centre](https://support.distrokid.com/hc/en-us/articles/360013535494-What-Happens-If-I-Stop-Paying-the-Annual-Fee) | 2026-09-08 |
| DistroKid | **Cover song licensing** | mandatory through DistroKid for every cover, even with a licence bought elsewhere | priced in the upload flow, not on the page | [help centre](https://support.distrokid.com/hc/en-us/articles/360013533894) | 2026-09-08 |
| Amuse | **Cover Song Licensing** · **Mastering** · **Store Sync** | licence a cover · master a track · auto-delivery to new stores | $14.99 per cover · $5.99 per track · $9.99 per release | amuse.io | 2026-09-04 |
| LabelGrid | **Gate** · **Preflight QC** · **Stream Radar** | smart links and pre-saves · pre-release QC · artificial-stream warning | $39/yr for Gate; the other two unpriced | labelgrid.com | 2026-09-04 |
| Distribution Amplitude | **7 services** | editorial pitching (Spotify, Apple, Amazon, Deezer, Qobuz, Tidal, YouTube), smartlinks, metadata entry, a 30-minute consultation | none priced on the page | distributionamplitude.com | 2026-09-04 |

- **CDB Boost and covers.** The MLC registers original songs; a cover or
  public-domain work gets the SoundExchange and sync thirds only. Every
  mechanical-collection add-on has the same carve-out; none states it on the
  sales page.
- **DistroKid prices its extras inside the upload flow**, not on
  `distrokid.com/pricing` — a pricing-page read finds no add-on and proves
  nothing. Content ID, Shazam/Siri and Atmos are named there and unpriced on any
  public page.
- A distributor not in this table has not been read for add-ons. The honest
  line is "we haven't read their add-on pricing", never a figure from a blog
  round-up.
