---
name: digital-marketing-build-website
description: >
  Use when the artist wants their website — built, refreshed, or put online.
  Five skippable questions, then a script renders one bilingual page from the
  presskit, releases, platforms and shows and deploys it to the
  artist's own Vercel. Writes no HTML in conversation; deploys only after the
  artist has seen the preview. Triggers on "build my website", "update my
  site", "put my site online", "my site still shows the old single".
metadata:
  agent: digital-marketing
  status: developed
  mode: task
  greeting: build or refresh your website and put it online
  greeting-fr: construire ou rafraîchir ton site web et le mettre en ligne
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# digital-marketing-build-website

**Status:** developed — the renderer, the build and the deploy are scripts with
tests; no artist has deployed yet.

The artist's site is the landing page of every campaign, and a hub, not a
content site: one release, one call to action, links out for streaming, tickets
and merch ([`references/artist-website.md`](./references/artist-website.md)).
Everything on it is already in the artist's tables. This skill asks for the five
things that are not, runs the build, reads the missing list back to the artist,
and deploys when they say so.

## Data

```bash
bun run artist:brief digital-marketing
```

The `Website` section says whether a site is live, whether the build is newer
than the deploy, and which link-outs are blank. `What the campaign has to work
with` is the same dossier the page is rendered from — if it says the presskit is
empty, the page will be too.

The five answers land on `artist.website`, one row:

```bash
bun run artist:get website
bun run artist:set website '{"id":1,"default_locale":"fr","domain":"odile-ray.com"}' --conflict id
bun run artist:set website '{"id":1,"shop_url":"https://odile-ray.bandcamp.com/merch","newsletter_url":"https://mailchi.mp/…","bandsintown_artist":"Odile Ray"}' --conflict id
```

A release's smart link goes on the release, not here:

```bash
bun run artist:set releases '{"id":"<uuid>","smart_link_url":"https://found.ee/…"}' --conflict id
```

The bio in the other language is memory, so the presskit keeps one bio:

```bash
bun run artist:remember digital-marketing website.bio "<the translation the artist approved>" --lang en
```

Then the two scripts. Both print what they did and what is still missing:

```bash
bun run website:build              # preview: every gap is a labelled dashed box → content/website/index.html
bun run website:build --public     # what fans see: gaps render nothing
bun run website:deploy             # content/website/ → the artist's Vercel; URL recorded on artist.website
```

Never write SQL, never open the database directly, and never write HTML in the
conversation — the page is `scripts/render.ts`, the same for every build.

## Input

| Field | From | Notes |
|---|---|---|
| five answers | `scripts/questions.ts` | first language, domain, store, newsletter, Bandsintown — every one skippable |
| identity | `artist.profile` | name, city, genre, markets, disciplines, `preferred_locale` |
| bio, contact, deck | `artist.presskit`, `artist.presskit_versions` | the bio in the language it was written; the current deck's URL |
| photos, quotes, clippings, awards, shows, team | `artist.presskit_items` | read, never copied |
| discography | `artist.releases` | title, type, date, cover art, `smart_link_url`; the next release is the hero |
| socials | `artist.platforms` | every row except `website` |
| upcoming and past shows | `artist.presskit_items` kind `show` | its date decides upcoming vs past; or the Bandsintown widget |
| colours and type | `artist.brand` | the default theme when empty |
| the artist's photos | Drive `Artist/Photos` | read by the build script when Google is connected; first photo is the hero |
| translated bio | `artist.memory` key `website.bio` | one row per language |

## Process

1. **Read the brief.** If `Website` says the build is newer than the deploy, the
   artist may only want `website:deploy`; ask that before anything else.
2. **Ask the five questions**, one per turn, skipping any `artist.website`
   already answers. "None" is a real answer for all five. Save each one the turn
   it is given.
3. **Run `bun run website:build`.** Paste the file path and the missing list. Do
   not describe the page; the artist opens the file.
4. **Work the missing list top down.** Each line names the command that fills
   it. A gap another department owns (bio, photos, releases, shows) is handed
   to that department by name, not asked for here — this skill re-asking for a
   bio the presskit intake asks for is asking twice. The translated bio is the
   one thing this skill drafts, and it is saved only after the artist approves
   the text.
5. **Rebuild until the artist says it is right.** Every rebuild is
   `website:build` again; nothing is edited by hand in `dist/`.
6. **Deploy when told.** `bun run website:build --public` then
   `bun run website:deploy`. Paste the URL. If a domain was given, paste the DNS
   record the script printed — that step is the artist's, at their registrar.

## Output

- `content/website/index.html` — one file, both languages, every image inlined;
  `content/website/site.json` beside it, the exact object the page was rendered
  from.
- The missing list, each line with the command that fills it.
- After deploy: the live URL on `artist.website.vercel_url`, and the DNS
  record for the domain if one was given.

## Guidelines

- **Never invent a fact to fill a gap.** No bio, quote, show, award, merch item
  or number appears on the page that is not in a table. A gap is a dashed box
  in preview and nothing in public.
- **Never deploy before the artist has opened the preview and said yes.** A
  site is outward-facing; a wrong one is seen.
- **Never hand-edit `dist/`.** A fix goes in the row or in `render.ts`, never in
  the output — the next build would erase it.
- **Never host what the industry links out to.** No store, no mailing list, no
  ticketing, no comments. Merch and mailing lists are out of scope (see the
  roadmap in `doc/DEVELOPMENT.md`) and this page does not reopen them.
- **Both languages, always.** The toggle is on every page; only the opening
  language is the artist's call. A missing translation is a gap, not an excuse
  to ship one language.
- **The artist's account, the artist's site.** `VERCEL_TOKEN` is theirs, the
  project lands in their Vercel, the domain is theirs. Nothing of the site
  passes through the label.
