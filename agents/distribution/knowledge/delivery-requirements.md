---
name: delivery-requirements
description: >
  Use when preparing a release to hand to a distributor — what the stores
  require of the audio, the artwork, the metadata and the identifiers, whose
  rule each one is, and what actually gets a release rejected.
metadata:
  agent: distribution
  status: developed
  last_verified: 2026-09-08
  author: Chloe Bibiane Pilon Vaillancourt
  version: "2.0"
---

# What a release has to contain

A distributor forwards these requirements; it does not set them. The
specifications belong to Spotify, Apple Music and the rest, and the upload form
is a funnel for them. Every requirement has an owner, and the owner decides
what the artist can do about it:

| Owner | Example | Workaround |
|---|---|---|
| **Store** | Spotify wants 44.1 kHz or higher | none — every distributor forwards it |
| **Distributor** | DistroKid wants JPG, ≥ 1000 px | another distributor; the floors are `artwork_min_px`, `artwork_formats`, `audio_formats` in `catalog.distribution_services`, and that company's help centre where the column is null |
| **Neither** | "3000×3000 or it gets rejected" | folklore — see Artwork |

Same-store specs are the same for Quebec, Canada and the US; only the
distributor's rules differ, and none differ by country.

## Audio

Spotify: [audio file formats](https://support.spotify.com/us/artists/article/audio-file-formats/),
2026-09-01. Apple: [Music Specification](https://help.apple.com/itc/musicspec/en.lproj/static.html)
and [Video and Audio Asset Guide](https://help.apple.com/itc/videoaudioassetguide/en.lproj/static.html),
2026-09-08.

- **Deliver the master as mastered.** Spotify: "Keep the original sample rate
  and bit depth." Upconverting 16-bit to 24-bit adds nothing and can cost
  lossless eligibility.
- **44.1 kHz is the floor.** Spotify: 44.1 kHz or higher. Apple: 44.1, 48,
  88.2, 96, 176.4, 192 kHz.
- **24-bit if that is the native master; 16-bit only if nothing higher
  exists** — Spotify's rule is about provenance, not a preferred number.
- **FLAC is Spotify's stated preference; WAV accepted on the same terms.**
  Apple takes `.wav`, `.flac`, `.caf`, `.m4a` for stereo. Which distributors
  accept FLAC on their own form is nowhere published as a list — `audio_formats`
  per row, else the help centre.
- **Stereo.** Surround is a separate delivery (Apple: LPCM in `.mov`, ≥ 48 kHz,
  16- or 24-bit); Dolby Atmos is a separate, often paid, delivery.
- **MP3 is not a delivery format.** No store accepts a lossy master.

## Artwork

Spotify: [cover art requirements](https://support.spotify.com/us/artists/article/cover-art-requirements/),
2026-09-08. Apple: Asset Guide, 2026-09-08. DistroKid:
[artwork requirements](https://support.distrokid.com/hc/en-us/articles/360013534334),
2026-09-08.

| | Spotify | Apple Music | DistroKid (one distributor's floor) |
|---|---|---|---|
| Size | 640–10 000 px, square | minimum 1400×1400, **recommended** 3000×3000, square | minimum 1000×1000, ideally 3000×3000 |
| Format | TIFF, PNG or JPG, lossless encoding | JPEG or PNG at 100% quality | JPG |
| Colour | sRGB, 24 bits/px, no embedded profile, no orientation metadata | RGB; **CMYK refused** | RGB; CMYK or greyscale errors |
| Max file size | not stated | not stated (10 MB applies to digital booklets only) | not stated |

- **"3000×3000" is Apple's recommendation, not a rejection threshold.** 3000
  clears every store, so hit it — but an artist told they will be rejected below
  it is being told something no store says.
- **Never upscale.** Spotify says so; an upscaled image is rejectable as blurry.
- **JPG clears all three.**
- **One image per release, never reused.** Multi-page art is refused;
  duplicate art across releases may be rejected (DistroKid).

### What actually gets artwork rejected

Content, not pixels. Every store refuses artwork carrying:

- a URL, QR code or social handle
- a streaming logo (Spotify, iTunes) or a social logo (Instagram, TikTok, X)
- a price, or a reference to physical media ("CD", "Compact Disc")
- unlicensed or stock photography; nudity
- anything blurry, pixelated, rotated or low quality

**Apple adds:** no reference to the audio format on the cover — "Dolby Atmos",
"spatial audio", "lossless", "24-bit", "192 kHz".

## Metadata and identifiers

Apple Music Specification, 2026-09-01.

| Field | Required | Who issues it |
|---|---|---|
| **ISRC** — one per recording | mandatory at Apple | the distributor, or the artist's own registrant code — [`rights`](../../rights/knowledge/rights-fundamentals.md) |
| **UPC / EAN** — one per release | required unless the distributor supplies a vendor ID | the distributor, almost always |
| **Genre** | required, from the store's own list | the artist picks; not free text |
| **Explicit flag** | optional — `clean`, `explicit`, none | the artist declares |
| **℗ line** | optional, `YYYY holder` | the artist; ℗ vs © is [`label-manager`'s](../../label-manager/knowledge/release-fundamentals.md) |
| **Lyrics** | optional — TTML or plain text | the artist; feeds the lyric display on Spotify and Apple |

- An ISRC identifies one recording forever; a remaster is a new ISRC. Reusing
  one across two recordings breaks the royalty trail. The same recording on a
  single and later on an album keeps its ISRC and gets a second UPC
  ([CD Baby help centre](https://support.cdbaby.com/hc/en-us/articles/360013731031), 2026-09-08).
- Title capitalisation, "feat." formatting and version naming follow the
  [Apple Music Style Guide](https://help.apple.com/itc/musicstyleguide/); a
  distributor's form enforces it and rejects on it.
- Identity documents at signup: no distributor publishes a comparable list;
  `docs_required` is filled per row as it is read.

## Timing

Two deadlines add: the distributor's delivery window, then the store's pitch
window — Spotify's editorial pitch closes **7 days before release**, with the
track already delivered
([support.spotify.com](https://support.spotify.com/us/artists/article/pitching-music-to-playlist-editors/),
2026-09-08). Apple, Amazon and Deezer windows, and who may pitch each, are in
[`distributor-knowledge.md`](./distributor-knowledge.md#pitching-through-the-distributor);
the windows themselves are in
[`distribution-fundamentals.md`](./distribution-fundamentals.md#lead-time-is-two-numbers).
