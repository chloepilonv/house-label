# Our data: the catalog

> The industry's public facts — media, radio, playlists, distributors —
> crawled once by us so that thousands of artists do not each rediscover that
> FACTOR exists.

## What it is

The catalog is the half of the data that is **ours**. It holds what exists out
there: which stations play which genres, which journalists cover which scene, what each distributor charges.
Your own data is the other half, and the two never mix: the catalog cannot see
you, and nothing you tell a department is written into it
([How it works](../start/how-it-works)).

Every install reads it live, through a read-only login that can see the
public tables and nothing else. There is nothing to download and nothing to
keep up to date on your side.

## What is in it

Counts as of 2026-10-25:

| Dataset | Rows | Used by |
|---|---|---|
| Media contacts | 309 | Press |
| Playlists | 131 | Promotion |
| Distributors | 39 | Distribution |
| Tools | 43 | every department, when it suggests a product |

Also there, without a count worth quoting yet: the collection societies a
rights department registers you with (a hand-kept list), the stores the
distributors deliver to, and radio stations — which hold **zero rows** today;
seeding Quebec from the CRTC licence list is on the
[roadmap](../DEVELOPMENT#roadmap).

Every dataset but Tools is marked **partial**: a growing sample, not the whole
market. A department reading a partial dataset may say "here is what I found"
and never "these are all of them". Tools is the one dataset marked complete.

What an artist does **not** get: the crawled work emails and phone numbers of
named real people. Those columns are withheld from the public catalog, because
they are the one thing that cannot be un-published. The press and promotion
departments find the person behind an outlet with your own Hunter key instead,
and the result lands in your database, never in ours.

## How it stays current

A crawl runs **every week**. Each source has its own cadence; a program page
that changes yearly is not re-read daily. Every row carries:

- **where it came from** — the page the crawler read, as a link;
- **last verified** — the date the fact was last seen on that page;
- **first seen** — so "added this week" means something;
- a state: *active*, *unconfirmed* (we stopped seeing it) or *retired*.

*Unconfirmed* is our observation, not the world's: far more often a page moved
than an outlet closed. So it triggers a re-check, not a deletion. Nothing is
ever deleted — a distributor you saved last year still resolves to its row, and
comparing the price you saved with the live one is how a department notices
it moved.

A handful of rows are **protected**: checked by a person, refreshable by the
crawl, never retired by it.

## Read-only

The catalog is read-only for everyone, including the departments. A department
can search it and show you rows; it cannot add, edit or remove one. When a
department says "want me to save it?", the saved copy goes into **your**
database, with the name and terms frozen as they were that day.

## When a row is wrong

A price that changed, an outlet that closed, a contact who moved desk:

1. Ask the department where the row came from. It shows the source link and
   the last-verified date.
2. Open that page. If the page changed, the next weekly crawl usually catches
   it; if the page is gone or the row was misread, it will not.
3. Report it at
   [github.com/chloepilonv/house-label/issues](https://github.com/chloepilonv/house-label/issues)
   with the row's name and the correct page. A person checks it and marks the
   row protected if it needed a hand.

Next: [What the agents never do](./limits).

## Sources

- This repo: [How it works](../start/how-it-works); the catalog README and the dataset manifest (completeness and withheld columns); [Development → Roadmap](../DEVELOPMENT#roadmap), rows 2–4 and 28
- Row counts: the catalog's own count on 2026-10-25, as given in the docs brief
