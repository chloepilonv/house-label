---
name: paid-promotion
description: >
  Use before naming a single paid tactic — each ad product's published floor to
  start and the eligibility gates that outrank price, the house budget tiers and
  goal allocation, CPMs labelled as the vendor data they are, how targeting works
  on Meta, TikTok and YouTube, what an influencer post really costs, whether an
  ad spend can pay back in streams, and what differs between a US and a Canadian
  ad account.
metadata:
  agent: digital-marketing
  status: developed
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "3.0"
---

# Paid promotion

The one department file about money the artist would actually spend. Every
figure is a heuristic to confirm with the vendor before committing; where a
vendor publishes nothing, the sentence says so. Budget arithmetic is
[`reconcile-budget.ts`](../skills/digital-marketing-plan/scripts/reconcile-budget.ts);
it scales proportionally and enforces no floor, so every paid line is re-read
against this file after it runs.

## Floors — what a channel costs to start

The vendor's own published minimum, never a price. **Never tell an artist their
budget is too small before opening this table**: Meta has no floor, so $50 can
advertise.

| Product | Floor | Source (read 2026-08-14) |
|---|---|---|
| Meta (Instagram, Facebook) | **none published** on a page reachable by fetch; $5–10/day is a working budget (practitioner) | [Meta Business Help](https://www.facebook.com/business/help/203183363050448) |
| Google Ads video (YouTube) | none published; "start small" | [Google Ads Help](https://support.google.com/google-ads/answer/2375454) |
| TikTok Ads | campaign **above $50/day**, ad group above $20/day; Spark Ads have no separate floor | [TikTok Ads Help](https://ads.tiktok.com/help/article/budget) · [Spark Ads](https://ads.tiktok.com/help/article/spark-ads) |
| Spotify Ads Manager (audio/video; "Ad Studio" is the same product, renamed 2024) | **250.00 in local currency** — CA$250 in Canada, US$250 in the US | [ads.spotify.com/en-CA](https://ads.spotify.com/en-CA/help-center/ad-studio-overview) · [en-US pricing](https://ads.spotify.com/en-US/pricing/) |
| Spotify Marquee / Showcase (in-app display) | **$100 USD** self-serve, $250 via a Spotify rep, $10,000 cap, billed per click | [Spotify for Artists](https://support.spotify.com/us/artists/article/forecasting-and-budgeting-for-marquee-showcase-campaigns/) |

## Gates — eligibility outranks price

| Product | Gate | Source |
|---|---|---|
| Marquee **and** Showcase | ≥1,000 streams in the last 28 days in a target market; 40 markets incl. Canada | [Spotify for Artists](https://support.spotify.com/us/artists/article/getting-started-with-campaign-tools/) · [markets](https://support.spotify.com/us/artists/article/target-markets-for-marquee-and-showcase-campaigns/) |
| Marquee only | ≥5,000 monthly active listeners in the market, within 21 days of release | same |
| Discovery Mode | ≥25,000 monthly listeners, ≥3 songs each live ≥30 days; costs a **30% commission on recording royalties** from those streams, no cash | [Spotify for Artists](https://support.spotify.com/us/artists/article/using-discovery-mode-in-spotify-for-artists/) |
| Spotify Ads Manager | payment card issued in an eligible country — the card decides, not the passport | [ads.spotify.com](https://ads.spotify.com/en-CA/help-center/ad-studio-overview) |

- **Say the Discovery Mode lawsuit out loud**: a proposed US class action filed
  2025-11-05 calls it pay-for-play; Spotify disputes it
  ([Forbes](https://www.forbes.com/sites/conormurray/2025/11/05/spotify-hit-with-class-action-lawsuit-alleging-discovery-mode-is-a-pay-for-play-scheme/)).
- Spotify's "Marquee delivers 10× more listeners per dollar" is the vendor's own
  2022 study, self-comparative
  ([Spotify, 2022-11-17](https://artists.spotify.com/en/blog/new-study-marquee-delivers-10x-more-listeners-per-dollar-than-social-ads)).

## Never buy placement or streams

Spotify prohibits "any service that claims to offer guaranteed placement on
playlists … in exchange for money"; artificial streams earn nothing, count for
nothing, and can get the track removed and the distributor penalised
([Spotify](https://support.spotify.com/us/artists/article/third-party-services-that-guarantee-streams/) ·
[artificial streaming](https://artists.spotify.com/artificial-streaming)). Spotify
charges distributors per flagged track since 2024-04-01 and has never published
the amount. Playlist pitching and submission services (which sell a curator's
attention, not a placement) are the promotion department's:
[`../../promotion/knowledge/playlist-pitch.md`](../../promotion/knowledge/playlist-pitch.md).
This department buys **paid social** only.

## Budget tiers and goal allocation — house defaults

Decisions, not findings; nobody has measured them against outcomes.

| Budget | Reachable |
|---|---|
| under $100 | Meta at $5–10/day, plus organic; every other floor is above this |
| $100–500 | Meta; Marquee/Showcase if the artist clears the gate. **TikTok is out** — $50/day eats $500 in ten days |
| $500–1,000 | add TikTok as a short deliberate burst |
| $1,000+ | several platforms at once; a publicist becomes arguable — our threshold, no market survey exists ([Ari's Take](https://aristake.com/whats-a-publicist-and-should-i-get-one/), 2020, says only "four figures") |

| Primary goal | Split |
|---|---|
| Streams | 50% Meta → Spotify · 20% Marquee (if eligible) · 20% content · 10% creator seeding |
| Video views | 40% YouTube in-stream · 30% TikTok Spark · 20% production · 10% creator seeding |
| Followers | 40% TikTok Spark · 25% Reels ads · 20% nano/micro creators · 15% content |

Ticket sales are not a selectable goal — shows are out of scope. Spend follows
the goal; ads are fuel for content that exists, never the strategy. A $0 budget
rewrites every paid task into its organic equivalent.

## What a click costs — vendor data, quoted as such

| Metric | Figure | Source (vendor, 2026-08-14) |
|---|---|---|
| Meta CPM, music/entertainment | $8.19; $0.37 per link click | [Gupta Media](https://www.guptamedia.com/social-media-ads-cost), data to Oct 2025 |
| TikTok · YouTube CPM, same tracker | $4.82 · $4.99 | same |
| Meta CPM, **Canada** vs **United States** | ~$13 vs ~$23 | [Superads CA](https://www.superads.ai/facebook-ads-costs/cpm-cost-per-mille/canada) · [US](https://www.superads.ai/facebook-ads-costs/cpm-cost-per-mille/united-states), self-selected sample |

The two Meta figures differ ~3× by mix and geography — which is why neither is
quoted as *the* CPM. Google publishes no CPV range.

## Targeting

| Platform | Tools | Threshold | Source (read 2026-09-08) |
|---|---|---|---|
| Meta | Custom Audiences (uploaded list, Page or pixel engagers); Lookalikes as a % of a country's population | none readable on Meta's pages — any "100 emails minimum" is a blog figure | [Custom](https://www.facebook.com/business/help/341425252616329) · [Lookalike](https://www.facebook.com/business/help/164749007013531) |
| TikTok | demographics, interests, device; OR within a dimension, AND across; Custom and Lookalike audiences | **1,000 matched users** to use a Custom Audience or seed a Lookalike | [targeting](https://ads.tiktok.com/help/article/ad-targeting) · [custom](https://ads.tiktok.com/help/article/custom-audiences) · [lookalike](https://ads.tiktok.com/help/article/lookalike-audience) |
| YouTube | demographics, affinity and custom segments, in-market, remarketing, placements, topics, keywords | none | [Google Ads Help](https://support.google.com/google-ads/answer/2454017) |

For a musician, the list to upload is the mailing list
([`owned-audience.md`](./owned-audience.md)) and the seed is people who watched
the last video.

## Influencer and creator rates

| Source | Figure | What it measures |
|---|---|---|
| [IZEA, 2023-02-08](https://www.globenewswire.com/fr/news-release/2023/2/8/2604135/0/en/IZEA-Releases-The-2023-State-of-Influencer-Earnings.html) — $70M of real payments, 2015–2022; no newer edition exists | nano (1K–10K) **$1,105** · micro (10K–50K) $1,674 · mid $3,396 per post; TikTok $2,741 · Instagram Story $2,784 · YouTube $2,102 · Facebook $642 | professional brand deals, 2022 |
| [Influencer Marketing Hub, 2026-05-04](https://influencermarketinghub.com/influencer-marketing-benchmark-report/) — creator survey, 600+ | ~55% of nano and ~45% of micro creators charge **under $500** | self-reported, informal deals included |

Give the artist the range and say why it is wide. Seeding a sound to nano
creators in the genre is the version that fits a $100–500 plan.

## Will the spend pay back in streams? Almost never

- **There is no per-stream rate.** Spotify: "no service pays a fixed amount per
  stream"; payout is streamshare — the artist's streams over the market's
  streams, times the market's pool. In 2025, one in every million Spotify
  streams averaged **$11,000** across $11B paid out.
  ([Loud & Clear FAQ](https://loudandclear.byspotify.com/faq/), read 2026-09-08)
- **Apple Music** publishes a stale average: **$0.01 per play**, 2020, same
  headline rate to every label
  ([Apple Music for Artists](https://artists.apple.com/support/1124-apple-music-insights-royalty-rate)).

| Spend | Streams to recoup at ~$0.011 (Spotify 2025 blend) | at $0.01 (Apple 2020) |
|---|---|---|
| $500 | ~45,000 | ~50,000 |
| $1,000 | ~91,000 | ~100,000 |

88% of tracks got under 1,000 streams in 2025
([`marketing-fundamentals.md`](./marketing-fundamentals.md)). The return on ad
spend is discovery, algorithmic placement and fan lifetime value — never the
royalty. How the royalty itself travels is
[`../../rights/knowledge/rights-fundamentals.md`](../../rights/knowledge/rights-fundamentals.md).

## United States vs Canada

| Mechanic | United States | Canada | Source |
|---|---|---|---|
| Spotify Ads Manager floor | US$250 | CA$250 — local currency, not converted | [ads.spotify.com](https://ads.spotify.com/en-CA/help-center/ad-studio-overview) |
| Spotify Ads location targeting | country · state · city · postal code · **DMA** | country · city · postal code — no DMA, no province; a Montréal push is built from cities and postal codes | [location targeting](https://ads.spotify.com/en-CA/help-center/location-targeting/) |
| Marquee / Showcase | eligible market, USD pricing | eligible market, USD or local equivalent | [Spotify for Artists](https://support.spotify.com/us/artists/article/forecasting-and-budgeting-for-marquee-showcase-campaigns/) |
| Ad-account currency | fixed at creation on TikTok — the remedy is a second account | same | [TikTok Ads](https://ads.tiktok.com/help/article/ad-account-information-faq) |
| Google/YouTube election ads | after US verification | not allowed during Canada Elections Act periods | [Google Ads policy](https://support.google.com/adspolicy/answer/6014595) |
| Sharing press links on Meta | works | **blocked** — see [`quebec-and-canada-market.md`](./quebec-and-canada-market.md) | |

Public funding can reimburse marketing spend (FACTOR, Musicaction); the two
numbers a plan needs are in
[`quebec-and-canada-market.md`](./quebec-and-canada-market.md).

## Zero budget

Feature swaps with an artist at the same level · a themed playlist the artist
curates with peers · genre subreddits and Discords, contextually · one shoot cut
many ways ([`content.md`](./content.md)) · a street team of superfans with early
access. Practices, not claims.
