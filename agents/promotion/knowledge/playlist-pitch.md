---
name: playlist-pitch
description: >
  Use when the artist wants to be on playlists — the three ways in and which one
  cannot be pitched at all, what each platform's editorial form asks and when it
  closes, how independent curators are actually reached, what a paid submission
  buys and never buys, and why a guaranteed placement is the one thing to refuse.
metadata:
  agent: promotion
  status: draft
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.1"
---

# Playlists: the three doors, and how each is pitched

A playlist is not one thing. Three routes put a song on one; they need different
work at different times, and one of them cannot be pitched at all. The same
rules apply in Quebec, Canada and the United States — the platforms are global;
only the language and location fields of a pitch change.

## The three doors

| Door | Who decides | How you get in | When |
|---|---|---|---|
| **Editorial** | a platform's own editors | a form inside the platform's artist tool — no contact, no email | **before** release |
| **Independent** | a person who runs the playlist | direct message, email, or a paid submission platform | **at** release week — they need a live link |
| **Algorithmic** | the platform's model | **not pitchable.** It responds to what listeners do | after |

What can honestly be said about the algorithmic door, all first-party:

| Playlist | Cadence | Size | Source |
|---|---|---|---|
| Release Radar | every Friday | carries a song up to 4 weeks; 1 song per artist per listener per week | [Spotify support](https://support.spotify.com/us/artists/article/getting-music-on-release-radar/), read 2026-09-04 |
| Discover Weekly | every Monday | 30 songs | [Spotify Newsroom, 2025-06-30](https://newsroom.spotify.com/2025-06-30/discover-weekly-turns-10-celebrating-100-billion-tracks-streamed-and-a-decade-of-personalized-discovery/) |
| Daily Mix | daily | up to 6 per listener | [Spotify Newsroom, 2018-05-18](https://newsroom.spotify.com/2018-05-18/how-your-daily-mix-just-gets-you/) |

- **The only threshold Spotify publishes is 30 seconds**, and it is a counting
  rule: a stream is "counted when a listener plays your song for at least 30
  seconds" ([Spotify](https://support.spotify.com/us/artists/article/how-we-count-streams/)).
  Spotify publishes no skip penalty and no save-rate benchmark; the "4% is
  strong" figures that circulate have no publisher.
- **Pitching early is what feeds Release Radar**, not being picked: submit at
  least 7 days ahead and "we'll include that song in your followers' Release
  Radar"; don't, and "we'll pick which songs from your release." The page never
  mentions pre-saves — a pre-save earns library adds and day-one signal, never
  Release Radar.

## Editorial — the four platforms

| | Spotify | Apple Music | Deezer | Amazon Music |
|---|---|---|---|---|
| Who submits | the artist, in Spotify for Artists | the **distributor** — Apple Music Pitch lives in Apple Music Connect and needs an Admin or Marketing role an independent artist does not have | the **distributor** — the tool is restricted to Label and Provider accounts | the artist, in Amazon Music for Artists (Owner or Admin) |
| Window | ≥7 days **before** release; never reopens | ≥10 days before for full consideration, ≥7 for late adds | 7 days before, accepted to 14 days after | up to 14 days **after** street date, not before; ineligible once past, or if a team member already pitched |
| Songs per pitch | one at a time; the next once it goes live | one focus track per release | one focus track (ISRC) per release | one track per release |
| Cannot pitch | compilations; songs you are only featured on | — | — | music Amazon does not count as "New (never released before)" — the page does not define whether that means released elsewhere |
| The form asks | genre, mood, culture and location tags, and a free-text description — under **Music → Upcoming**; a 500-character limit is reported by a pitch-platform guide, not by Spotify | format, name, artist, mood, genre, language, release date, promotion detail, target territories | Provider, Label, UPC, main artist, release date, title, priority, configuration, release type, focus track and its ISRC, ≥1 genre, ≥1 target editorial team | track, artist and marketing-plan detail, target audience geography, featured collaborators, sync or video |
| Source | [Spotify support](https://support.spotify.com/artists/article/pitching-music-to-playlist-editors), read 2026-09-08 · [SubmitHub guide](https://www.submithub.com/story/the-ultimate-spotify-editorial-pitch-guide-with-template) for the character count | [Apple Music Connect](https://musicconnect.apple.com/support/5575-apple-music-pitch), read 2026-09-04 | [Deezer for Creators](https://creatorsupport.deezer.com/hc/en-us/articles/14963453830045-Pitching-Tool), read 2026-09-04 | [Amazon Music for Artists](https://artists.amazonmusic.com/pitch), read 2026-09-04 |

- **Access comes before the pitch, and it is not instant.** A distributor that
  is a Spotify preferred provider grants Spotify for Artists access
  "automatically … when you submit a request"; otherwise "approval can take a
  few days". An artist with nothing released yet asks the distributor for the
  artist URI and contacts Spotify "with your artist link and the UPC or EAN of
  your upcoming release" ([Spotify support](https://support.spotify.com/us/artists/article/getting-access-to-spotify-for-artists/),
  read 2026-09-04). Order: distributor chosen → release delivered → access
  claimed → pitch, with a seven-day floor on the last step.
- **Half of DSP editorial is a distribution question.** Apple and Deezer route
  through whoever delivers the release; "will you forward my editorial pitch?"
  is asked of [`distribution`](../../distribution/AGENT.md) before signing.
  Never send an artist to `artists.apple.com` to pitch — the tool is not there.
- **One "pitch by" date on a release plan is wrong for at least two platforms.**
  Spotify closes 7 days before; Amazon opens only at release.
- **Say what the record is.** The Spotify description is where a French-language
  or Quebec record says so; editors filter on language and location tags.
  Quebec-owned editorial playlists exist (Spotify confirms *Du Québec* and *Rap
  québ* as its own); their current names are a `catalog.promotion_playlists` row,
  never a memory.
- **Dolby Atmos on Apple needs an approved distributor or encoding house**;
  Atmos rendered from a stereo mix is refused, and there is no artist-facing
  flag ([Apple Music for Artists](https://artists.apple.com/support/5477-elevate-sound-spatial-audio-dolby-atmos)).

## Independent curators — a person

- **They need a live link**, so they come at release week, not before.
- **A playlist worth pitching sits between roughly 500 and 50,000 followers** —
  below that it moves nothing, above that it is usually editorial or bought.
  *House rule; no publisher.*
- **They are reached by hand or through a paid platform; there is no table of
  them.** The contact, when it exists, is free text in the playlist description.
  Spotify's playlist-owner object carries `display_name`, `id`, `href`, `type`,
  `uri`, `external_urls` and no contact field
  ([Web API](https://developer.spotify.com/documentation/web-api/reference/get-playlist),
  read 2026-09-03), and the terms forbid the dataset itself: "You may not store,
  aggregate or create compilations or databases of Spotify Content" and "Do
  not… use any robot, spider… to retrieve, duplicate, or index any portion of
  the Spotify Service" ([developer.spotify.com/terms](https://developer.spotify.com/terms),
  read 2026-09-03). `open.spotify.com` also blocks `ClaudeBot`, `anthropic-ai`
  and `GPTBot` in `robots.txt`.
- **So `catalog.promotion_playlists` holds only playlists whose curator published a
  submission route themselves**, plus the platforms that broker pitches. It is
  never a compiled directory of Spotify playlists, and must never be presented
  as one. Whether Apple Music or Amazon has an independent-curator ecosystem is
  published by nobody; treat both as editorial-only until a curator route is
  found.

## Paid submission — what it buys and never buys

Priced rows — currency, credits per pitch, smallest pack, response guarantee,
answer rate, `sells_placement` — are `catalog.promotion_pitch_services`; the
link-level row is `catalog.tools` (category `promotion`).

| Buys | Service · unit | Never buys |
|---|---|---|
| **A listen with a reply window** — a curator answers within 7 days or the credits are refunded | Groover — per credit ("Grooviz"), 2 per standard submission, more for top curators ([groover.co/pricing](https://groover.co/en/lp/pricing/), read 2026-08-14) | placement. Groover's ">85%" is an **answer** rate — the share of curators who reply — never a chance of being added |
| **A listen**; with **premium** credits, a reply within 72 hours and a listen of at least 60 seconds. With standard credits "a curator can choose to provide feedback if they wish, but may instead make a quick decision and move on" | SubmitHub — per credit, 1–4 credits per submission ([SubmitHub help](https://www.submithub.com/help/QPHgFWDSCm82W7vLJ), read 2026-09-04); the figures are in the help centre, `/pricing` 404s | placement; a response floor on standard credits. Quote the tier, never the platform |
| **A campaign** to a curator pool, priced per campaign not per submission | PlaylistPush — campaign minimum and calculator on [playlistpush.com/pricing](https://www.playlistpush.com/pricing), read 2026-09-04 | anything: "Playlist Push does not offer any guarantees for the results you will receive after your song is sent out" |
| **Guaranteed placement** | any service that sells one | legitimacy at any price — it is bought with artificial streams, and the penalty lands on the artist (below) |

### What a distributor sells on top

- **CD Baby — CDB Boost** is not playlist pitching despite the name: it
  registers the songs with The MLC and SoundExchange and puts them in front of
  CD Baby's sync team ([cdbaby.com/cdb-boost](https://cdbaby.com/cdb-boost/),
  read 2026-09-04). [`rights`](../../rights/AGENT.md) says whether the artist
  already collects both.
- **DistroKid — Wheel of Playlist** is a subscriber draw for a slot on
  DistroKid's *own* Spotify playlists ([distrokid.com/wheel](https://distrokid.com/wheel/))
  — neither editorial nor a curator; a lottery win, not a plan.
- **Apple and Deezer editorial go through the distributor** (above);
  [`distribution`](../../distribution/AGENT.md) compares who forwards a pitch.

## Never buy streams

Spotify withholds royalties, removes the tracks from public counts and charts,
blocks positive algorithmic effect, pulls playlist placements, and since
2024-04-01 charges labels and distributors per flagged track
([Spotify, artificial streaming](https://artists.spotify.com/en/artificial-streaming),
read 2026-08-14). The damage lands on the artist, not the seller; a service that
guarantees placement is buying the thing that triggers this. This warning is
repeated every time a guaranteed placement comes up, whoever is asking.
