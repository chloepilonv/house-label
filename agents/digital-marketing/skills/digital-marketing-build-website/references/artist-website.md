---
name: artist-website
description: >
  Use when building or discussing the artist's website — what an artist site
  is for, which sections it carries, what it links out to instead of hosting,
  and where each section's data already lives in the label.
metadata:
  agent: digital-marketing
  status: developed
  last_verified: 2026-09-04
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.1"
---

# The artist's website

An artist site is a **hub**, not a content site. One release, one call to
action, and every deep thing — streaming, tickets, merch, the mailing list —
is a link out to the service that does it.

## What working artist sites do

Read on 2026-09-04 from four working artist sites, major and independent
([tameimpala.com](https://www.tameimpala.com/) among them, and
[odile-ray.com](https://odile-ray.com/) at indie scale), by fetching each
page and its source:

- **None embeds a player.** Music is a smart link — one URL, every store
  (ffm.to, lnk.to, found.ee).
- **None runs a store or a list.** Shopify, Bandcamp, lnk.to, Mailchimp,
  Community. The site links; the service does the work.
- **No 3D, no scroll library.** None loads GSAP, Lenis or Three.js. The premium
  feel is a custom typeface, a video or artwork hero, one accent colour, and
  page transitions. The renderer's default theme follows the same rule: one
  display face, one body face, one accent.

## The sections, and where the data lives

Consensus of [Bandzoogle's checklist](https://bandzoogle.com/blog/creating-a-band-website-a-complete-checklist),
[LANDR](https://blog.landr.com/build-band-website-actually-works/) and
[Wix's 2026 examples](https://www.wix.com/blog/best-musician-websites), in nav
order. Every section reads a table another department fills; the site copies
nothing.

| Section | Must carry | Reads |
|---|---|---|
| Home | the next release (else the latest), one call to action | `artist.releases` (`release_date` > today), `artist.website.presave_url`, the release's `smart_link_url` |
| Music | discography, each release linking to its smart link, else Bandcamp | `artist.releases`, `artist.platforms.bandcamp` |
| Shows | upcoming with tickets; past as proof | `presskit_items` kind `show` (its date decides upcoming vs past), or a Bandsintown widget (`artist.website.bandsintown_artist`) |
| About | bio, quotes, awards, photos | `artist.presskit.long_bio`, `presskit_items` kinds `quote` · `clipping` · `award` · `photo`, Drive `Artist/Photos` |
| Store | one link out | `artist.website.shop_url` |
| Contact | booking and press emails, socials, newsletter, the presskit | `presskit_items` kind `team`, `artist.presskit.booking_email`, `artist.platforms`, `artist.website.newsletter_url` / `sms_url`, `artist.presskit_versions` |

**Bilingual is a route, not a toggle in the footer.** Quebec, Canada and the US
are served as equals; the page carries both languages and opens on
`artist.website.default_locale`, else the profile's `preferred_locale`.

## Hosting

- **Vercel, the artist's own account.** [Vercel's REST API](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment)
  takes a file by SHA and returns a URL; a custom domain is one more call and
  a DNS record at the registrar. A personal token, so the project and the
  domain are the artist's. The label's cloud service would use the same
  endpoints with a platform token and hand ownership over with Vercel's
  ["claim deployment"](https://vercel.com/docs/platforms/platform-elements/actions/deploy-files) flow —
  not built.
- **One file.** Every image is inlined as a data URI: the photos live in Drive
  (not hotlinkable), the covers on Bandcamp's CDN, the press images on the
  outlets' servers. A page that carries its own images renders in five years.
- **Shows widget.** [Bandsintown's widget](https://www.artist.bandsintown.com/widget-api)
  renders upcoming dates from the artist's Bandsintown listing and syncs the
  same dates to Spotify; Tame Impala uses Seated for the same job.
- **Smart links** are asked for at build time (`artist.releases.smart_link_url`);
  [Feature.fm](https://www.feature.fm/) and [Linkfire](https://www.linkfire.com/)
  both have free tiers. Creating one at delivery time would be distribution's
  job and is not built. The release folder's `Video/` is not read for a hero
  video yet.

## Sources

- [Bandzoogle — creating a band website: a complete checklist](https://bandzoogle.com/blog/creating-a-band-website-a-complete-checklist)
- [LANDR — how to build a band website that actually works](https://blog.landr.com/build-band-website-actually-works/)
- [Wix — best musician websites, 2026](https://www.wix.com/blog/best-musician-websites)
- [Vercel REST API — create a new deployment](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment)
  and [deploy files](https://vercel.com/docs/platforms/platform-elements/actions/deploy-files)
- [Bandsintown widget and API](https://www.artist.bandsintown.com/widget-api)
- [tameimpala.com](https://www.tameimpala.com/) and [odile-ray.com](https://odile-ray.com/), fetched with their source on 2026-09-04
