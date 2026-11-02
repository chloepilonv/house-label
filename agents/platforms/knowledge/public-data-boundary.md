---
name: public-data-boundary
description: >
  Answers "can't you just look it up" — for each of the twelve platforms an
  artist can connect, what figure the public page shows and at what precision,
  what its robots.txt and Terms permit an automated reader, and where the
  artist reads the exact number themselves.
metadata:
  agent: platforms
  status: developed
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "2.0"
---

# Where the numbers come from

The rule is *public data only — no platform API keys, no scraping behind a
login, no fetching a page whose robots.txt names us*. Checked against all
twelve platforms on 2026-09-08, that rule leaves no automated path to a single
exact figure.

- **We fetch nothing.** Every platform either names this crawler and disallows
  the site, defaults to `Disallow: /`, publishes a rounded figure, or publishes
  no figure at all.
- **The artist reads their own dashboard and tells us.** Every stored figure is
  self-reported, and the dashboards are unrounded, segmented and historical —
  better than any public page.
- **A scope is a key.** Instagram Insights, TikTok stats and the YouTube Data
  API each need a token; the no-API-keys rule closes them even where robots.txt
  would not.

## The twelve platforms

Precision marked *observed* is what a logged-out visitor sees in 2026; none of
these platforms publishes its display rounding except YouTube.

| Platform | Public figure · precision | robots.txt / Terms (2026-09-08) | Where the artist reads the exact number |
|---|---|---|---|
| Spotify | monthly listeners on the artist page · abbreviated, "12.4K" (observed) | `ClaudeBot`, `anthropic-ai`, `Claude-Web` `Disallow: /`; `Claude-User` gets `/embed/` and `/oembed` only, which carry no metric ([robots](https://open.spotify.com/robots.txt)). Developer Terms ban "any robot, spider… to retrieve, duplicate, or index" (§IV.2.d) and "ingesting Spotify Content into a machine learning or AI model" (§IV.2.a.i) ([terms](https://developer.spotify.com/terms)) | [Spotify for Artists](https://artists.spotify.com/) → Audience; profile must be claimed |
| Apple Music | none — the artist page lists releases only | `*` disallows `/api/`, `/search`, `/v1/` ([robots](https://music.apple.com/robots.txt)); the allowed page carries no figure | [Apple Music for Artists](https://artists.apple.com/) |
| YouTube | subscribers on the channel page · exact under 1,000, then three significant figures ([help](https://support.google.com/youtube/answer/6051134), [Data API](https://developers.google.com/youtube/v3/docs/channels)) | no AI-crawler block; `*` disallows 22 paths, not `/channel/` or `/@handle` ([robots](https://www.youtube.com/robots.txt)). Rounded is the only public number | YouTube Studio → Analytics, unrounded |
| Instagram | followers, following, posts on the profile · exact below ~10,000, then abbreviated (observed) | `ClaudeBot` and the default `*` both `Disallow: /`; header: "Collection of data on Instagram through automated means is prohibited unless you have express written permission" ([robots](https://www.instagram.com/robots.txt)). Insights need a token, a professional account and `instagram_manage_insights` ([reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/insights/)) | Instagram Insights in-app, or Meta Business Suite |
| TikTok | followers and likes on the profile · abbreviated (observed) | `ClaudeBot`, `anthropic-ai`, `Claude-User`, `Claude-SearchBot` `Disallow: /` ([robots](https://www.tiktok.com/robots.txt)); follower count sits behind the `user.info.stats` OAuth scope ([scopes](https://developers.tiktok.com/doc/tiktok-api-scopes/)) | TikTok Analytics, in-app under Creator tools |
| SoundCloud | followers and per-track plays on the profile · exact (observed) | `anthropic-ai`, `ClaudeBot`, `Claude-Web` `Disallow: /` outside the homepage and legal pages ([robots](https://soundcloud.com/robots.txt)) | SoundCloud Insights on the artist's own account |
| Bandcamp | no follower figure; per-release "supported by" lists only (observed) | `ClaudeBot`, `CCBot`, `GPTBot`, `Bytespider` `Disallow: /` ([robots](https://bandcamp.com/robots.txt)) | artist dashboard → Stats (plays, sales, supporters) |
| Facebook | followers on the page · abbreviated (observed) | `*` `Disallow: /`; same written-permission notice as Instagram ([robots](https://www.facebook.com/robots.txt)) | Meta Business Suite → Insights |
| X | followers on the profile · abbreviated (observed) | `*` `Disallow: /`; only named search and preview bots get exceptions ([robots](https://x.com/robots.txt)) | account analytics in the X app |
| Deezer | fans on the artist page · exact (observed) | `ClaudeBot`, `anthropic-ai`, `Claude-Web`, `Claude-User` disallowed on artist, album, track and playlist paths ([robots](https://www.deezer.com/robots.txt)) | Deezer for Creators |
| Linktree | none — views and clicks are private to the owner | `ClaudeBot` allowed outside `/admin`; there is no figure on the page ([robots](https://linktr.ee/robots.txt)) | Linktree Insights ([help](https://linktr.ee/help/en/articles/5434178-understanding-your-insights)) — 28 days on Free, longer by plan |
| Website | none | the artist's own site; nothing to permit | the artist's own analytics tool — see [`digital-marketing`'s website reference](../../digital-marketing/skills/digital-marketing-build-website/references/artist-website.md) |

What each figure counts is in [`metric-definitions.md`](./metric-definitions.md).

## What the boundary means in practice

- **Robots.txt settles what we may fetch, not what a person sees.** A logged-out
  human still sees the public figures above; the artist can read them without
  us.
- **The written-permission exception has never been requested.** Instagram,
  Facebook and Spotify each allow collection with express permission; until a
  request is granted, the door is treated as shut.
- **A distributor dashboard is another dashboard.** Its stream counts arrive
  the same way — read by the artist, reported to us. What each distributor
  shows is [`distribution`'s file](../../distribution/knowledge/distributor-knowledge.md).
- **Null means not reported, never zero** — including a YouTube channel whose
  subscriber count is hidden (the option was withdrawn on 2022-07-29, but the
  API's `hiddenSubscriberCount` flag still exists for channels that used it).
- **Asked to go look, the answer is the dashboard name in the table above**,
  then an offer to record whatever the artist reads there.
