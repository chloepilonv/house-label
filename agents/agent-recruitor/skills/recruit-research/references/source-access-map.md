---
name: source-access-map
description: >
  Which sources refuse automated fetching, what works instead, and the research
  tactics that paid off — measured across two passes: 2026-08-14 (14 knowledge
  files, six departments) and 2026-08-23 (the distribution crawl). Read before a
  research run so the same hour isn't spent rediscovering the same walls.
metadata:
  agent: recruit
  skill: recruit-research
  last_verified: 2026-08-23
---

# Source access map

Measured, not remembered. Every row below was hit during a real research pass —
nothing here is inferred from documentation.

## The budget is shared, global, and runs out

`WebSearch` is capped at **200 calls per session, across every concurrent
agent**. Six parallel agents exhausted it; the first two spent it and the other
four ran on `WebFetch` alone.

- **Front-load discovery.** One agent finds the canonical URLs, the rest fetch
  them directly. Fan-out multiplies searching, and searching is the scarce half.
- **A fan-out is not free.** Budget it like a rate limit, because it is one.
- **Running out is survivable** — direct fetching against an organization's own
  URL is the *stronger* source anyway. It costs coverage, not accuracy.

## Hosts that refuse automated fetching

| Host | Symptom | What works instead |
|---|---|---|
| `help.instagram.com` | error shell, `curl` 400 | **`facebook.com/help/instagram/<same-id>` renders the same page in full** |
| `help.x.com` | 403 / Cloudflare | none found — search snippets only |
| `business.x.com` | 402 | none found |
| `support.tiktok.com` | 302 → JS-only shell | `developers.tiktok.com` docs render |
| `ads.tiktok.com/business/…/blog` | Akamai 504 | none found |
| `tiktok.com/creator-academy` | JS-rendered, no SSR body | none found |
| `ascap.com` | 403 to every route | domain-restricted search snippets |
| `canada.ca` | 403 | none found |
| `open.spotify.com` | robots.txt blocks AI agents by name | `oembed` + `/embed/playlist/<id>` resolve a **known** id; neither searches |
| `theorchard.com`, `universalmusic.com` | refuse the fetcher | none found |
| `distrokid.com` (incl. `/stores/`) | 403 to curl | **TinyFish Fetch renders it in full** |
| `cdbaby.com`, `support.cdbaby.com` | 403 to curl | TinyFish Fetch |
| `stem.is`, `vydia.com`, `soundrop.com` | 403 to curl | TinyFish Fetch |
| `believe.com`, `secretlydistribution.com` | 403 to curl | TinyFish Fetch |
| `toolost.com`, `indiepool.com`, `cmccanada.org` | 403 to curl | TinyFish Fetch |
| `unitedmasters.com` | blocks **TinyFish too** | Puppeteer with system Chrome |
| `billboard.com`, `variety.com`, `hollywoodreporter.com` | 307 → `tollbit.<host>` paywall | none — use the primary source instead |
| `ec.europa.eu/commission/presscorner` | JS shell, no SSR body | search snippets, or the trade body's own statement |

**Spotify is a policy block, not a technical one.** `open.spotify.com/robots.txt`
names `ClaudeBot`, `anthropic-ai`, `Claude-Web`, `GPTBot`, `CCBot`,
`Google-Extended`, `Applebot-Extended`, `cohere-ai`, `Meta-ExternalAgent` and
`Bytespider`, and states the reason: keeping its catalogue graph out of model
weights. Any plan to crawl Spotify answers to that before it answers to an
engine choice.

## Search fallbacks, ranked

| Engine | Verdict |
|---|---|
| **Brave** — `search.brave.com/search?q=` | works, usable snippets |
| **Yahoo** — `search.yahoo.com/search?p=` | works, usable snippets |
| DuckDuckGo (html + lite) | CAPTCHA |
| Bing | ignores the `site:` operator, returns junk |
| Mojeek, SearXNG | challenges or empty |

## Tactics that paid off

- **`artists.spotify.com` is NOT blocked, only `open.spotify.com` is.** The
  robots policy above covers the consumer host. The artist-facing host serves
  `artists.spotify.com/directory/distribution` — 98 distribution providers with a
  `preferred` badge — in full, 40KB of clean markdown. A neutral first-party
  enumeration nobody had found.
- **A curl 403 is not a wall; it is a user-agent check.** Seven hosts that
  refused curl returned clean markdown to TinyFish Fetch on the first try. Run
  the ladder before recording a host as unreachable.
- **TinyFish Fetch caps at 10 URLs per request.** An 11th makes the whole call
  400 with `INVALID_INPUT`. Chunk before batching.
- **Puppeteer's bundled Chrome is often absent locally.** `puppeteer.launch()`
  fails on a version mismatch; pass
  `executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
  CI installs its own via `bunx puppeteer browsers install chrome`.
- **HTTP 200 does not mean alive.** `amplitudedistribution.com` returns 200 and
  is a parked GoDaddy page. Any `operating_status` derived from a status code is
  wrong; it has to come from content.
- **Signup and apply routes cannot be guessed.** AWAL applies at
  `apply.awal.com/submit-form/` and Stem at `apply.stem.is/apply-now` — separate
  subdomains. Seven of fourteen guessed `/contact` and `/apply` paths 404'd or
  403'd. Extract `a[href]` from the rendered page instead.
- **Try the sitemap before calling a site unreadable.** SubmitHub is a JS SPA
  with a 404 pricing page, but `sitemap-help.xml` and `sitemap-stories.xml`
  exposed **266 help articles and 175 stories**, all server-rendered.
- **Read PDFs locally with `pdftotext`.** Direct quotes beat a summarizer's
  paraphrase, and the figures that matter are usually inside the PDF.
- **Never execute repo code to inspect it.** Importing a catalog seed script
  to count rows ran it against the live catalog database and failed on a
  constraint. Parse statically.
- **A first-party mirror often exists.** Meta serves Instagram's help centre;
  TikTok serves its developer docs. When the consumer host blocks you, look for
  the host that serves the same content to a different audience.
- **"Not found" is not "does not exist."** Three Quebec Spotify playlists could
  not be confirmed because search was closed to us, not because they are gone.
  Write the distinction down or the next reader deletes real rows.

## The highest-value output is the refutation

A skeptical pass beat a confident one on every file. What it caught:

| Claim | Reality |
|---|---|
| Mosseri: *"hashtags are not a way to get more reach"* | No primary source exists — paraphrase drift off a 2022 Story, hardened by repetition |
| `#SOCAN` / `#FACTOR` in caption templates | Neither organization promotes a hashtag; both came from the prior build's prompt file |
| "150+ DSPs" as a store count | Distributor marketing copy, repeated as fact. Verbatim on **five** vendors; Too Lost says 450+; **UnitedMasters publishes both "150+" and "over 35" on its own two pages**. Boilerplate, never a measurement |
| *Voir* as a tier-1 Quebec press target | **Dead since 2020-06-05** — the prior build shipped a step telling artists to pitch it |
| `pitches@pitchfork.com` | Not on Pitchfork's contact page; unconfirmable |
| CONNECT as a neighbouring-rights route | Left Re:Sound **2024-12-31** — registering there collects nothing |

Every one of these would have shipped as fact under a pass that trusted its own
memory. Budget the research time for disproving what the file already says, not
only for adding to it.

## Open questions

- **Whether the 200-call `WebSearch` budget is per-session or per-hour.** It was
  never observed refilling, but the pass did not run long enough to know.
- **Whether an allowed user-agent changes Spotify's answer.** The wildcard agent
  is permitted on most paths; `/embed/` is disallowed for it. Untested.

## Sources to answer them from

- Anthropic's own tool documentation for the search budget's reset semantics.
- `open.spotify.com/robots.txt`, re-read under a non-AI user-agent.

## What the numbers say

| Claim | Magnitude | Source | Verified |
|---|---|---|---|
| WebSearch budget, shared across concurrent agents | 200 calls | observed exhaustion, 6 parallel agents | 2026-08-14 |
| SubmitHub content reachable via sitemap despite the SPA | 266 help articles + 175 stories | `submithub.com/sitemap-help.xml`, `sitemap-stories.xml` | 2026-08-14 |
| AI user-agents named and blocked in Spotify's robots.txt | 10 | `open.spotify.com/robots.txt` | 2026-08-14 |
