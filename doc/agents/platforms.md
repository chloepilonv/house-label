# Platforms

**Status:** 🧪 beta

> Your numbers, logged and explained — and never fetched.

## In a real label

**Who does it.** A data analyst, inside the marketing department at a major, or
the owner's own dashboard at an independent. Berklee's definition: "Transform
raw streaming, social, and financial data into actionable insights"
([Berklee](https://www.berklee.edu/careers/roles/data-analyst)). No independent
label lists a data inbox on its contact page ([Sub Pop](https://www.subpop.com/contact)).

**Week to week.** They read each platform's own dashboard — Spotify for Artists,
Apple Music for Artists, YouTube Studio, Meta Business Suite, TikTok Analytics —
and turn the figures into a sentence the rest of the label can act on: what
moved, since when, and what it is worth.

**What they produce.** A dated series per platform, a definition for each
metric, and milestones. In Canada this is a funding asset: FACTOR's Artist
ratings, which unlock larger programs, read monthly listeners, followers and
subscribers against published thresholds
([FACTOR rating thresholds 2026–2027](https://factorportalprod.blob.core.windows.net/portal/Documents/Updates/FACTOR_Artist_Rating_Thresholds.pdf)).

**What it costs.** Varies — no analytics firm publishes an artist-level rate;
ask for a quote. The dashboards themselves are free with a claimed profile
([Spotify for Artists](https://artists.spotify.com/) ·
[Apple Music for Artists](https://artists.apple.com/)).

**What a number is worth, by country.** Gold is 40,000 units in Canada
([Music Canada](https://musiccanada.com/gold-platinum/faq/)) and 500,000 in
the United States ([RIAA](https://www.riaa.com/gold-platinum/about-awards/)) —
12.5 times the streams for the same word. Units count only in the certifying
country. Quebec has no certifier of its own; Music Canada certifies for the
whole country.

**The line with the next desk.** Platforms explains and records; it never
turns a stream count into money — Spotify pays on streamshare, not a per-stream
rate, so payout questions are [Rights](./rights)'. Which content shipped and
why is [Digital marketing](./digital-marketing)'s.

## Here

**This agent fetches nothing.** Spotify, Instagram and TikTok each name this
crawler in their robots file and disallow the whole site; YouTube allows the
channel page but rounds the only figure on it; Apple Music shows no public
figure at all. Checked across the twelve platforms you can connect, that leaves
no automated path to a single exact number. So **you read your own dashboards
and report the figures** — they are unrounded and segmented, better than any
public page. Open it with `houselabel platforms`.

| Skill | What you get | Status |
|---|---|---|
| Log numbers | a dated reading per platform, exactly as you reported it; a metric you did not give stays blank, never zero | developed |
| Explain a metric | what a number counts and over which window, what it excludes, and what that size is worth in your country | developed |
| Read a trend | the change between the readings that exist, with the gaps and rounding named — and no cause claimed | developed |

**Two numbers that disagree are usually two questions.** Spotify monthly
listeners is a rolling 28-day count; followers is cumulative; a stream counts at
30 seconds ([Spotify](https://support.spotify.com/us/artists/article/understanding-your-listener-and-follower-stats/)).
A public YouTube subscriber count is rounded to three significant figures above
1,000 ([YouTube](https://support.google.com/youtube/answer/6051134)), so two
readings of "12.3K" a week apart say nothing about the 99 people between them.
The agent runs the arithmetic in a script so the rounding rule is applied the
same way every time.

**What it never does**

- Fetches a figure, calls a platform, or scrapes behind a login. Asked to go
  look, it names the dashboard and offers to record what you read there.
- Presents a figure as verified. Every number is yours, self-reported.
- Says your campaign worked. A number moving is a fact; why it moved is a guess
  this data cannot support — there is no control group here.
- Turns an unreported metric into zero.
- Projects a weekly rate to a year.

**What it needs from you**

- On file already: your country (which picks Music Canada or the RIAA), the
  platforms you connected, every reading so far.
- It will ask: the figure, the platform, and the date you read it — not the
  date you mention it. Three readings spanning the metric's own window (28 days
  for Spotify) before it will state a direction.

**Example**

> **Artist:** Spotify says 3,800 monthly listeners today. Last month I logged 5,100. Did the ad campaign fail?
> **Agent:** Recorded: 3,800 on 2026-10-25. The drop is 1,300 over 31 days. One thing first: monthly listeners is a 28-day window, and your playlist add was 33 days ago — the window dropping it out explains a fall on its own. Whether the ads did anything, this data cannot say; your dashboard's source-of-streams view can.
> **Artist:** Is 3,800 a lot?
> **Agent:** FACTOR's Artist 2 rating reads 100,000 monthly listeners on your top platform, so it is a long way from that line. Next: report your follower count too — it is the one number a calendar cannot lower.

## Sources

- [Berklee — Data Analyst](https://www.berklee.edu/careers/roles/data-analyst) · [Sub Pop — contact](https://www.subpop.com/contact)
- [Spotify — listener and follower stats](https://support.spotify.com/us/artists/article/understanding-your-listener-and-follower-stats/) · [how we count streams](https://support.spotify.com/us/artists/article/how-we-count-streams/) · [robots.txt](https://open.spotify.com/robots.txt)
- [YouTube — subscriber count](https://support.google.com/youtube/answer/6051134) · [Instagram robots.txt](https://www.instagram.com/robots.txt) · [TikTok robots.txt](https://www.tiktok.com/robots.txt)
- [Music Canada — Gold/Platinum FAQ](https://musiccanada.com/gold-platinum/faq/) · [RIAA — about the awards](https://www.riaa.com/gold-platinum/about-awards/)
- [FACTOR — Artist rating thresholds 2026–2027 (PDF)](https://factorportalprod.blob.core.windows.net/portal/Documents/Updates/FACTOR_Artist_Rating_Thresholds.pdf)
- In the repo: `agents/platforms/knowledge/public-data-boundary.md`, `metric-definitions.md`, `reading-a-trend.md`
