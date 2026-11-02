---
name: platform-conventions
description: >
  Use when drafting a caption, an ad, a hashtag set or a profile asset for a
  specific platform — the hard limits and which surface they describe, caption
  style per platform, the hashtag taxonomy, AIDA and PAS for ad copy, posting
  windows and what the platforms themselves say about them, profile and banner
  specs, and the mechanics of Remix, Duet, Stitch, Collabs and polls.
metadata:
  agent: digital-marketing
  status: developed
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "2.0"
---

# Platform conventions

Six platforms: Instagram, TikTok, Facebook, X, YouTube and YouTube Shorts.
Which platforms one asset publishes to together is computed by
[`format-groups.ts`](../skills/digital-marketing-plan/scripts/format-groups.ts),
never restated here. Everything below is identical in Quebec, Canada and the
United States; what a platform sells differently by country is in
[`paid-promotion.md`](./paid-promotion.md).

## Hard limits, and which surface each describes

API limits are not in-app limits. Every row names its surface.

| Limit | Value | Surface | Source (read 2026-09-08) |
|---|---|---|---|
| Instagram caption | 2,200 chars · 30 hashtags · 20 @-tags | Graph API | [Meta](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media) |
| Instagram Reel · Story | 3 s–15 min · 3–60 s | Graph API | same |
| Instagram carousel | up to 10 images, videos or a mix | Graph API | same |
| TikTok caption | 2,200 UTF-16 runes; TikTok publishes no in-app figure — vendor counters report 4,000 | Content Posting API | [TikTok for Developers](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post) |
| Facebook post | **Meta publishes no cap**; the circulating 63,206 is a vendor-observed in-product figure, never a Meta page | — | no Meta source |
| X post | 280 chars (URL = 23, emoji = 2); **25,000 for X Premium** long posts | product | [X counting](https://docs.x.com/fundamentals/counting-characters) · [help.x.com, types of posts](https://help.x.com/en/using-x/types-of-posts) |
| X video | 0.5–140 s, ≤512 MB | API | [X docs](https://docs.x.com/x-api/media/quickstart) |
| YouTube title · description | 100 · 5,000 chars | product | [YouTube Help](https://support.google.com/youtube/answer/57404) |
| YouTube Shorts | ≤3 min, square or vertical; title 100 chars | product | [YouTube Help](https://support.google.com/youtube/answer/12779649) · [10059070](https://support.google.com/youtube/answer/10059070) |

Write to the style below, never to the edge of a limit: feeds truncate long
before the cap.

## Caption style per platform

House convention. **No platform publishes evidence that hashtag count changes
reach**; Instagram's 30 is a ceiling, not a target.

| Platform | Shape |
|---|---|
| Instagram | ~150–200 words, a call to action, emoji fine, 8–12 hashtags across the taxonomy |
| TikTok | hook-first — the first line stops the scroll; short; 2–3 hashtags |
| X | under 280, punchy, 1–2 hashtags |
| Facebook | conversational, slightly longer, a CTA, few hashtags |
| YouTube | title-style first line, 200–500-char description, 3–5 hashtags at the end |
| YouTube Shorts | title under 100 chars, `#Shorts` plus 2–3 niche tags, hook in the first 1–2 s |

One caption per platform per post — never one pasted six times. **One call to
action per post.** Burn captions into every clip with speech; the on-screen text
is for the mute viewer, the caption for the one who stopped.

## Hashtag taxonomy

Four categories, high-volume mixed with niche tags real listeners search:

- **branded** — artist name variants, release title, campaign tag
- **community** — genre and scene (`#IndieRock`, `#HipHopCanada`)
- **trending** — discovery tags (`#NewMusicFriday`, `#MusicDiscovery`)
- **location** — city, province or state, country

A bilingual artist gets **separate FR and EN sets per category — eight sets**,
never mixed inside one caption. Regional vocabularies for Quebec, Canada and the
US are in [`quebec-and-canada-market.md`](./quebec-and-canada-market.md). No
public dataset gives search volume for any of these tags; the counts are
convention.

## Ad copy — AIDA and PAS

Two or three variations per paid task, at least one of each, one in French for a
bilingual artist.

- **AIDA** — Attention, Interest, Desire, Action: the hook stops them, the body
  builds want, the CTA names the click.
- **PAS** — Problem, Agitation, Solution: open on something the listener already
  feels, sit in it one line, the song is the answer.
- Each variation: a hook **under ten words**, a two-to-three-sentence body, a
  specific CTA (*Stream now*, *Pre-save* — never "check it out"), its platform.
  Meta takes longer, emotional copy; TikTok takes ultra-short and native.

## Posting windows

- **YouTube says upload time does not matter**: "Publish time is not known to
  impact a video's long-term performance"; live streams and Premieres excepted.
  ([YouTube Help](https://support.google.com/youtube/answer/141805))
- **No other platform publishes a best time.** The three largest vendor studies
  sample their own scheduling customers and contradict each other:

| Platform | Sprout Social ([2026-03-31](https://sproutsocial.com/insights/best-times-to-post-on-social-media/), ~2bn engagements) | Buffer ([2026-03-25](https://buffer.com/resources/best-time-to-post-social-media/), 52M posts) | Hootsuite ([2025-11-19](https://blog.hootsuite.com/best-time-to-post-on-social-media/), 1M+ posts) |
|---|---|---|---|
| Instagram | Tue 1–7 pm · Wed 12–9 pm | Thu 9 am | Mon 3–9 pm |
| TikTok | Tue 2–6 pm | Sun 9 am | Thu 7–11 am |
| Facebook | Tue–Wed 12–8 pm | Thu 9 am | Tue 9 am |
| X | Tue–Thu 12–6 pm | Tue 9 am | Wed–Fri 9–11 am |

The rule, ordered: the artist's own analytics win · otherwise Sprout Social's
window, named as such · never blend the three · YouTube gets no window. Vendor
times are viewer-local; tasks are scheduled in the artist's IANA timezone, so
they match only while the audience is in the artist's region.

## Profile picture and banner

| Platform | Profile picture | Banner | Source |
|---|---|---|---|
| YouTube | renders 98×98; JPG/GIF/BMP/PNG, no animated GIF, <15 MB | min 2048×1152 (16:9), text-safe area 1235×338, recommended 2560×1440, <6 MB — one image crops differently per device | [YouTube Help](https://support.google.com/youtube/answer/10456525), read 2026-09-08 |
| Spotify for Artists | ≥750×750, 1:1 | ≥2660×1140 (≈7:3); the bottom ~35% is covered by name, listener count and buttons on every screen | [Spotify for Artists](https://support.spotify.com/us/artists/article/artist-image-guidelines/), read 2026-09-08 |
| Instagram | 320×320 min, upload 1080×1080; rendered as a ~110 px circle | none | **no Meta page publishes it** — vendor consensus |
| TikTok | 200×200 min, upload 720×720; <10 MB | none | **no TikTok page publishes it** — vendor consensus |

A simple, centred, recognisable image (a face, not a scene) reads at circle
size; whether the *same* image everywhere helps a musician be recognised has no
published evidence — house convention. Cover-art upload specs are
[`../../distribution/knowledge/delivery-requirements.md`](../../distribution/knowledge/delivery-requirements.md);
press-photo and palette specs are
[`../../presskit/knowledge/visual-direction.md`](../../presskit/knowledge/visual-direction.md).

## Interactive mechanics — what a fan can do with the post

| Feature | Platform | Mechanic | Permission | Source (read 2026-09-08) |
|---|---|---|---|---|
| Remix | Instagram | a new Reel beside or after a public Reel | global toggle in Settings → Reels and Remix, or per post | [Instagram Help](https://help.instagram.com/139004934231412) |
| Collabs | Instagram | one post, two names, both followings | invite per post | [Instagram for Creators](https://creators.instagram.com/blog/tips-for-improving-your-reach) |
| Poll · Questions stickers | Instagram Stories | two-option tap, or open text the creator can reshare anonymously; gone with the Story at 24 h | — | [Instagram Blog 2017](https://about.instagram.com/blog/announcements/introducing-polls-in-instagram-stories) · [2018](https://about.instagram.com/blog/announcements/introducing-the-questions-sticker) |
| Duet | TikTok | original and new video side by side; four layouts | per account or per video; public accounts only | [TikTok Newsroom, 2020-09-30](https://newsroom.tiktok.com/en-us/feature-highlight-new-layouts-for-duet) |
| Stitch | TikTok | up to a few seconds of the original clipped onto a new video | Everyone · Friends · Only you; revoking is not retroactive | [TikTok Support](https://support.tiktok.com/en/using-tiktok/creating-videos/stitch-settings) |
| Community post · poll | YouTube | text, image, quiz or a poll of up to 4 options × 65 chars; no subscriber threshold | — | [YouTube Help](https://support.google.com/youtube/answer/9409631) · [7124474](https://support.google.com/youtube/answer/7124474) |

**Original audio carries the artist's name** on Instagram and TikTok; every fan
use is attribution — the point of seeding a sound. No platform quantifies what
any of these features does to streams; the 84% TikTok figure in
[`marketing-fundamentals.md`](./marketing-fundamentals.md) is aggregate virality,
not a per-feature effect.

## Creator monetization, US and Canada

| Program | US | Canada | Source |
|---|---|---|---|
| YouTube Partner Program | 1,000 subs + 4,000 watch hours/12 mo, **or** 1,000 subs + 10M Shorts views/90 d | same | [YouTube Help](https://support.google.com/youtube/answer/72851) |
| YouTube Shopping affiliate | listed, but closed to music channels | not listed | [YouTube Help](https://support.google.com/youtube/answer/13376398) |
| Instagram bonuses | invite-only, no country list published | same | [Instagram for Creators](https://creators.instagram.com/bonuses) |
| TikTok Creator Rewards | country list not on any TikTok page reachable | same | — never promise a payout |
