# What a comparison compares

Skill-local: only `distribution-compare-services` reads this. The industry facts
behind each dimension — pots of money, fee models, exit terms, lead times — are
in [`knowledge/distribution-fundamentals.md`](../../../knowledge/distribution-fundamentals.md).

## Six dimensions, in this order

Price is one of six. The order runs from *what this costs forever* to *what is
merely nice*, so an artist who reads two rows has read the two that matter.

| # | Dimension | The artist's question | Columns in `catalog.distribution_services` |
|---|---|---|---|
| 1 | What you keep | "how much of my money do they take?" | `cut_streaming_pct`, `cut_social_pct`, `cut_downloads_pct` |
| 2 | What you're charged | "what do I pay, in what currency?" | `fee_model`, `price_tiers`, `currency`, `max_artists`, `max_tracks`, `addons` |
| 3 | What leaving costs | "can I get out, and what if I stop paying?" | `lapse_behavior`, `takedown_policy`, `term_length`, `exclusivity_required`, `catalog_transfer_in` |
| 4 | How fast it ships | "will it be live for my date?" | `delivery_lead_time_days`, `fastest_delivery_days`, `expedited_cost` |
| 5 | What it reaches | "will it get me where I need to be?" | `store_count_claimed`, `bandcamp_delivery`, `soundcloud_delivery`, `youtube_music_delivery`, `content_id`, `territories` |
| 6 | Whether it fits a Canadian | "is any of this priced or funded for me?" | `cad_pricing`, `canadian_office`, `grant_eligibility_ca`, `french_support` |

- **1 and 2 are one bill.** Report them as an effective rate,
  `fee + (cut × revenue)`, over the artist's own annual streaming revenue. With
  no revenue band, give the break-even instead ("these two cost the same at
  about $660 a year").
- **3 is the emptiest row and the most regretted.** Print it empty with a
  reason; never drop it.
- **4 is two numbers added, never one.** The distributor's window plus the
  platform's pitch deadline.
- **5 is a claim, never a measurement.** Print the vendor's number with the
  vendor's name on it.
- **6 is a column every row is scored on**, not a section shown to Canadians.
  For a US artist it resolves to "does not apply".

## Every dimension prints, on every row

| Column state | Meaning | What the artist is told |
|---|---|---|
| a value | a first-party page stated it | the value, with `last_verified` |
| listed in `not_stated` | pricing page *and* help centre were read; neither says | "they don't publish it" |
| `null` | nobody has read a page for this field yet | "not checked yet" |

- **Never render `null` as `0`, "free", or "none".** "0% cut" and "we have not
  looked" are opposite claims.
- **An empty `addons` array is `null`, not "no add-ons".** Only `addons` listed
  in `not_stated` earns "they don't sell any".
- **`cut_streaming_pct` is first-party only.** A reported rate (AWAL "reported
  at 15%") is printed as prose with who reported it, never written into the
  column.

## Never rank across layers

Filter on `layer` before scoring: `artist_facing` unless the artist is a label.
A label-facing company publishes no price because its buyer negotiates; scoring
that as "expensive" or "missing" is a category error. Platform-layer companies
(the white-label engine under a distributor) are provenance, never an option.

## Lifecycle

Offer only `lifecycle = 'active'`. An `unconfirmed` row — its own site stopped
confirming it — is offered only with that said aloud. A `retired` row is never
offered.
