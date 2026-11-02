---
name: digital-marketing-draft-content
description: >
  Use when a task or campaign needs creative — platform-native captions,
  AIDA/PAS ad copy, categorized hashtag sets, or a batch of content ideas, in
  the artist's language.
metadata:
  agent: digital-marketing
  status: developed
  mode: task
  greeting: write your captions, ad copy, hashtags or content ideas
  greeting-fr: écrire tes légendes, textes publicitaires, hashtags ou idées de contenu
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# digital-marketing-draft-content

**Status:** developed — the spec is complete; no code behind it yet.

Produce the campaign's creative in four modes, each grounded in the artist's own
assets. Drafts only — the artist edits and posts.

## Data

```bash
bun run artist:brief digital-marketing
```

**The `Voice` section of the brief is how the artist writes.** Match it: the
greeting, the sentence length, the sign-off, the words it says never to use —
and copy the register of the samples rather than describing it. When it says no
guide is on file, say so once, name `houselabel voice` as the fix, and draft
anyway.


If `Key messages already set` appears, the angle is decided — carry it. Content
that invents a competing angle mid-campaign is the thing that makes a release
read as two releases.

The `Artist` section's `Writes in` decides the language of every caption, and
`Where the audience is` says which platforms are worth writing for.

Save what you write onto the task it belongs to:

```bash
bun run artist:get marketing_tasks campaign_id=<uuid> status=pending
bun run artist:set marketing_tasks '{"campaign_id":"<uuid>","sort_order":3,"title":"...","due_date":"2026-09-01","captions":{"instagram":"..."}}' --conflict campaign_id,sort_order
```

The task's photo, cropped per platform and saved back into its Drive folder:

```bash
bun run social:variants <task-id> --format reel                       # sharp, everywhere
bun run social:variants <task-id> --save vertical <adobe-output-url>  # keep an Adobe crop
```

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| mode | conversation or task type | captions · ad copy · hashtag sets · content ideas |
| task title + content brief | the task | captions and ad-copy modes |
| artist dossier | profile + presskit + memory | genre, metrics, brand colors, press quotes, awards |
| target platforms | task or campaign | bounds caption and idea platforms |
| language + bilingual flag | profile | one language for text; FR+EN sets and ideas when bilingual |

## Process

1. **Warn before overwriting.** Regeneration clobbers caption maps and persisted
   hashtag sets wholesale, including the artist's manual edits. Check whether
   anything was hand-edited and say what will be lost.
2. **Ground in real assets first.** Press quotes become social proof, awards
   become credibility, streaming milestones become milestone posts, brand colors
   appear by hex in content briefs, the discography becomes callbacks.
3. **Draft in the mode's shape:**
   - **Captions** — one per target platform in that platform's native style:
     IG 8–12 hashtags plus a CTA; TikTok hook-first; X under 280; Facebook
     conversational; YouTube a title line plus description; Shorts `#Shorts`
     plus a niche tag.
   - **Ad copy** — 2–3 variations, at least one AIDA and one PAS, hook under ten
     words, split by Meta versus TikTok targeting.
   - **Hashtag sets** — branded / community / trending / location, 8–15 tags
     each, reused across the campaign and persisted on it.
   - **Content ideas** — 12–15 actionable ideas across proven categories, each
     with a real first-line hook and a specific CTA, including 2–3 low-effort
     ones for weeks when the artist has no time. For a bilingual artist, 3–4 of
     the same 12–15 mix FR/EN; the batch does not shrink.
4. **Write hooks as the actual first line** the audience sees, and CTAs as
   something specific — never "check it out".
5. **Handle bilingual properly**: one language for conversational text, but
   FR + EN hashtag sets and mixed-language post ideas when the artist is
   bilingual.
6. **Offer Buffer once the captions are approved.** "Want these as drafts in
   your Buffer?" On yes:
   1. **The photo.** It lives in the task's Drive folder (`drive_folder_url`).
      Empty folder → ask the artist to drop the photo in, and stop there.
   2. **The sizes.** `social_variants` crops it to every shape the task's
      platforms need and saves the copies in that folder. **In Claude with the
      Adobe for creativity connector**, use `adobe-create-social-variations`
      instead — its crop keeps the subject in frame — then keep each result
      with `bun run social:variants <task-id> --save <feed|vertical|wide> <url>`:
      Adobe's links expire, Buffer fetches at posting time.
   3. **The drafts.** `buffer_drafts` first, so a re-run doubles nothing. Then
      `buffer_channels` for the ids, and one `buffer_draft_post` per channel:
      the approved caption, the task's date as `dueAt`, the matching shape's
      link in `imageUrls`, and `instagram: post | story | reel` on Instagram.
   Videos are not cropped yet — the artist adds them in Buffer; say so. If
   Buffer is not connected, give the tool's sentence and move on — the
   captions are already saved on the task.

## Output

Mode-specific structured data saved to the task or campaign: a platform→caption
map; an array of ad-copy objects `{framework, hook, body, cta, platform_target}`;
an array of hashtag sets `{category, label, hashtags, language}`; or an array of
content ideas `{title, hook, cta, platform, format, category}`.

## Guidelines

- **Never post.** This produces drafts; the artist publishes. In Buffer too:
  `buffer_draft_post` can only save a draft, and the artist schedules it.
- **Never generate music, or any part of it.**
- **Never cite a metric that is zero or empty** as traction.
- **Never invent a press quote, award, or chart placement.** Only what the
  presskit actually holds reaches a caption.
- Per-platform style, format groups, and hashtag taxonomy live in
  [`../../knowledge/platform-conventions.md`](../../knowledge/platform-conventions.md);
  the Quebec, Canadian and US market facts and regional hashtags in
  [`../../knowledge/quebec-and-canada-market.md`](../../knowledge/quebec-and-canada-market.md);
  the EN/FR output rules in [`../../AGENT.md`](../../AGENT.md).
