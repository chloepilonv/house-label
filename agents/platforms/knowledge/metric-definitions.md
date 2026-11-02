---
name: metric-definitions
description: >
  Answers "what does this number mean" and "is that a lot" — what each
  platform's metric counts and over which window (Spotify, Apple Music,
  YouTube, Instagram, TikTok and the rest), the pairs artists confuse, and what
  a magnitude is worth under Music Canada, the RIAA and FACTOR.
metadata:
  agent: platforms
  status: developed
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "2.0"
---

# What each number measures

Every metric counts a different thing over a different window. Two numbers
that disagree are usually two questions, not one problem.

## Spotify

| Metric | Counts | Window |
|---|---|---|
| Monthly listeners | "your total listeners in the last 28 days — including both active and programmed listeners" | rolling 28 days |
| Followers | people who follow the artist profile | cumulative |
| Streams | plays "counted when a listener plays your song for at least 30 seconds" | the range selected |
| Listeners | unique accounts that streamed in the range | the range selected |

Sources: [audience segments](https://support.spotify.com/us/artists/article/audience-segments-on-spotify/) ·
[listener and follower stats](https://support.spotify.com/us/artists/article/understanding-your-listener-and-follower-stats/) ·
[how we count streams](https://support.spotify.com/us/artists/article/how-we-count-streams/).

- **Monthly listeners falls on its own.** A drop 28 days after a playlist add
  is the window moving, not an audience leaving.
- **Streams count every qualifying play; listeners count each account once.**
  400 streams from one fan is one monthly listener — the ratio is the repeat
  rate.
- **Followers is the only cumulative number of the four**, so it is the only
  one a calendar cannot lower.
- **Followers below monthly listeners is normal.** Most listeners arrive through
  programming and never press follow. "After following an artist, listeners are
  3 times more likely to stream their music in the next 6 months" (Spotify).
- **Offline plays count when the device reconnects**, which it must do every
  30 days — a late catch-up is not a late spike.
- **All stats are in UTC**, with no timezone setting: Spotify's "day" is not
  the artist's.

### The segments beneath monthly listeners

All from [audience segments](https://support.spotify.com/us/artists/article/audience-segments-on-spotify/):

| Segment | Definition |
|---|---|
| Monthly active listeners | "intentionally streamed your music in the past 28 days from active sources" — profile, release pages, own library and playlists |
| Programmed listeners | "only streamed your music from programmed sources" — editorial and algorithmic placement |
| Previously active | were active, "haven't intentionally streamed your music in at least 28 days" |
| Super / moderate / light | 15+ · 3–14 · 1–2 intentional streams in 28 days |

A monthly-listener spike with flat active listeners is a placement, not a
fanbase.

## Apple Music

Only inside [Apple Music for Artists](https://artists.apple.com/support/1105-understand-your-analytics);
the public artist page carries no audience figure.

| Metric | Counts |
|---|---|
| Plays | "recorded when a user initiates song playback in Apple Music for more than 30 seconds", radio included |
| Average daily listeners | "the average number of daily unique listeners in the time frame selected" |
| Shazams | songs recognised by the Shazam app or a partner app |
| Radio spins | plays on "more than 40,000 tracked terrestrial and digital radio stations" |
| Purchases | iTunes Store sales of the song or album |

New data takes 48 hours to appear; all in UTC.

## YouTube

- **Subscribers and views are cumulative**; neither has a window.
- **The public subscriber count is rounded.** Exact under 1,000, then
  `1.23 K` · `12.3 K` · `123 K` · `1.23 M`
  ([Check your subscriber count](https://support.google.com/youtube/answer/6051134));
  the API states the rule as "rounded down to three significant figures"
  ([Data API `channels`](https://developers.google.com/youtube/v3/docs/channels)).
  YouTube Studio shows the exact figure.
- **`viewCount` has changed meaning twice.** Shorts replays entered it on
  2025-03-31 (Data API reference, read 2026-08-14); from **2026-08-24** every
  format counts a view "the moment a video begins to play (includes
  autoplay…)" (same reference, read 2026-09-08). A series crossing either date
  is two series.
- **Video count is public videos only, "even to owners"** (same reference).
- **A hidden count is a null, not a zero.** The option to hide it was withdrawn
  on 2022-07-29 ([TechCrunch on YouTube's announcement](https://techcrunch.com/?p=2345259));
  the API still carries a `hiddenSubscriberCount` flag for channels that did.

## Instagram

Definitions from Meta's Insights API references
([account](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/insights/) ·
[media](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media/insights/)),
which are what the in-app Insights screens display.

| Metric | Counts |
|---|---|
| Followers | accounts following the professional account — cumulative |
| Reach | "unique accounts that have seen your content, at least once, including in ads" |
| Views | "times your content was played or displayed" — replaced *impressions*, deprecated for all API versions on 2025-04-21 |
| Accounts engaged | "accounts that have interacted with your content, including in ads" |
| Total interactions | likes + saves + comments + shares, "minus the number of unlikes, unsaves, and deleted comments" |
| Profile visits | "times your profile was visited" |
| Reels average watch time | "average amount of time spent playing the reel" |

- **Followers is who subscribed; reach is who saw.** They move independently.
- **A "views" series that starts in 2025 is not comparable to an older
  "impressions" one** — the definition changed with the name.

## TikTok

TikTok publishes no metric glossary. What exists:

- **Analytics** (in-app, [Help Center](https://support.tiktok.com/en/using-tiktok/growing-your-audience/understanding-your-analytics))
  shows post views, profile views, likes, comments, shares and follower count
  over the last 7 or 28 days or a custom range; per video: total views,
  average watch time, traffic source. Export covers up to 365 days.
- **API definitions** ([user info](https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info) ·
  [video query](https://developers.tiktok.com/doc/research-api-specs-query-videos)):
  `follower_count`; `likes_count` = "total number of likes received by the user
  across all of their videos"; `video_count` = "publicly posted videos"; per
  video `view_count`, `like_count`, `comment_count`, `share_count`.
- **Profile "likes" is a lifetime sum across every video**, not a per-post
  figure — the number artists most often misread as engagement on the latest
  post.
- **No published reach definition** exists for TikTok; a TikTok "reach" cannot
  be compared to Instagram's or to Spotify listeners.

## The other platforms

| Platform | Metrics the artist can read | Where | Window |
|---|---|---|---|
| SoundCloud | followers, plays, likes, reposts per track | SoundCloud Insights (own account) | cumulative; the platform publishes no glossary |
| Deezer | fans (follow count), streams | Deezer for Creators | cumulative; no glossary published |
| Bandcamp | plays, sales, supporters per release | artist dashboard → Stats | cumulative; no audience figure on the public page |
| Facebook | followers, reach, views | Meta Business Suite → Insights | reach follows Meta's Instagram definition above |
| X | followers, impressions per post | account analytics | cumulative; no glossary published |
| Linktree | views, clicks, click rate, unique vs total ([Insights help](https://linktr.ee/help/en/articles/5434178-understanding-your-insights)) | Linktree Insights | 28 days on Free, 90 Starter, 365 Pro, lifetime Premium |
| Website | page views, visitors | the artist's own analytics | whatever the tool sets |

Click rate is "the total number of clicks by the total number of views" —
1,000 clicks on 2,000 views is 50%, and unique clicks count "each person only
once" (Linktree).

## What a magnitude is worth

Certification is national, and the country on the artist's profile chooses the
table. Quebec has no certifier of its own: Music Canada certifies for the whole
country, and Musicaction funds rather than certifies.

### Canada — Music Canada

[Gold/Platinum FAQ](https://musiccanada.com/gold-platinum/faq/), read 2026-09-08:

| Award | Units (single or album) |
|---|---|
| Gold | 40,000 |
| Platinum | 80,000 |
| Multi-Platinum | 160,000, then every 80,000 |
| Diamond | 800,000 |

- **Albums:** "1500 on-demand audio streams = 1 unit" — one ratio, no
  premium/ad-supported split.
- **Singles:** "160 eligible Premium On-Demand Audio and/or Video streams count
  as 1 unit"; 240 ad-supported streams for the same unit. A free-tier listener
  is worth two thirds of a paying one.
- **Canadian units only:** "Sales and streams must occur within the Canadian
  market to count towards Certification."

**FACTOR reads these numbers.** Its Artist 2 and 3 ratings, which unlock larger
programs, are met by clearing "thresholds in a majority of these categories"
([FACTOR rating thresholds, 2026–2027](https://factorportalprod.blob.core.windows.net/portal/Documents/Updates/FACTOR_Artist_Rating_Thresholds.pdf)):

| Criterion | Artist 2 | Artist 3 |
|---|---|---|
| Top DSP monthly listeners | 100,000 | 1,000,000 |
| Top DSP followers | 25,000 | 50,000 |
| Live dates (past 12 + next 6 months) | 12 | 20 |
| Sync licences (3 years) | $5,000 | $10,000 |
| Radio chart entries (3 years) | 1 | 3 |
| Instagram followers | 10,000 | 25,000 |
| TikTok followers | 20,000 | 50,000 |
| YouTube subscribers | 10,000 | 25,000 |

A clean, dated stat history is therefore a funding asset in Canada, not a
vanity one.

### United States — RIAA

[About the awards](https://www.riaa.com/gold-platinum/about-awards/), read 2026-08-14:

| Award | Units (single or album) |
|---|---|
| Gold | 500,000 |
| Platinum | 1,000,000 |
| Multi-Platinum | 2,000,000, then every 1,000,000 |
| Diamond | 10,000,000 |

- **Albums:** "1,500 on-demand audio and/or video streams = 10 track sales = 1
  album sale".
- **Singles:** "150 on-demand streams is equivalent to one download sale" — one
  flat ratio, no tier split.
- **No federal funder reads streaming stats** the way FACTOR does; US support
  is state, foundation and private money.

### The border in one line

Both countries convert an album stream at 1,500 to the unit, but Gold is 40,000
units in Canada and 500,000 in the United States — 12.5 times the streams for
the same word (our division of the two published thresholds). Units count only
in the certifying country, so where the listeners live matters as much as how
many there are.
