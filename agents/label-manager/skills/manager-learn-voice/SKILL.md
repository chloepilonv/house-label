---
name: manager-learn-voice
description: >
  Use when the artist wants drafts that sound like them — reads emails they
  actually sent, distils how they write into a guide with verbatim samples, and
  hands the artist the file to save with `houselabel voice`. Never writes the
  row itself. Triggers on "learn how I write", "my pitches sound like AI",
  "use my tone", "read my emails and copy my style".
metadata:
  agent: manager
  status: beta
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# manager-learn-voice

**Status:** beta — the collecting, the filtering and the redaction are code
(`houselabel voice learn`, rules in
[`engine/voice-learn.ts`](../../../../engine/voice-learn.ts)); the distilling is
the model's; the save is `houselabel voice set`, which shows the artist the
file and asks.

A draft that reads as generated gets deleted by the person who receives it. The
fix is not an adjective in a prompt: a model copies an example far better than
it follows "warm but professional". So this skill collects real excerpts and
writes the rules it can see in them, and every department gets both through the
brief's `Voice` section.

## Data

```bash
bun run artist:brief manager
```

The `Voice` section says whether a guide is on file and when it was learned. A
guide older than a year, or learned from fewer than ten emails, is worth redoing.

Writes nothing to `artist.*`. `artist:set voice` is refused: the artist owns
that row. The artist runs one of:

```bash
houselabel voice learn --gmail          # their Sent folder, read-only, once
houselabel voice learn --from ./mail    # a folder of .eml / .txt they exported
houselabel voice set voice.md           # a file written by hand, or by this skill
```

## Input

| Field | From | Notes |
|---|---|---|
| sent emails | the Gmail connector, when the session has one — `in:sent` — else a folder of `.txt`/`.eml` the artist points at, else emails pasted in chat | **at least 10, ideally 30–50**, spanning a year; fewer than 10 gives a guide of one mood |
| languages | `artist:brief manager`, `Writes in` | sample every language the artist works in; French and English habits differ |
| what to skip | this skill | receipts, replies under 15 words, forwards, newsletters, anything sent to a family member, anything with a password, an address or a number that looks like an account |

## Process

1. **Point at the command first.** `houselabel voice learn --gmail` (Google
   connected) or `--from <folder>` does steps 2 to 6 by itself: it keeps only
   emails the artist wrote to a person, cuts quotes and signatures, redacts
   numbers and addresses, balances languages, and shows the file before
   saving. Say what it reads — sent mail only, never the inbox — and that with
   a cloud provider the emails go to that provider once. Stop here unless the
   command cannot run.
2. **By hand only when it cannot.** No Google, no export, or the session has a
   mail connector of its own: pull 30–50 sent emails to people outside the
   artist's household, across at least a year, in every language they work
   in. Search by recipient type when the volume allows: venues, journalists,
   curators, funders, collaborators.
3. **Read for habits, not content.** Note the greeting, the first sentence's
   job, paragraph length, sentence length, punctuation tics (dashes, ellipses,
   exclamation marks, emoji), how they ask for something, how they sign off,
   how formal each language is, the words they use often, the words a model
   would use that they never do.
4. **Pick 4–8 verbatim excerpts.** One per recipient type and language. Each is
   a paragraph, cut from the middle of a real email, quoted exactly — spelling,
   casing, punctuation. Strip names of third parties, addresses, amounts and
   anything private; keep the words.
5. **Write `voice.md`** in the shape below, in the artist's own language, and
   put it where they will find it (their working folder, never the repo).
6. **Hand it over.** Print the exact `houselabel voice set` command with a
   `--source` that names the count and the date range. The artist reads the
   file, edits what is wrong, and saves. Never run the command for them.
7. **Redo it when it is stale.** A guide learned from fewer than ten emails, or
   more than a year ago, is worth running again; the `Voice` section says
   when it was learned.

## Output

```markdown
# Voice

- Opens with the first name, no "Bonjour à vous".
- First sentence says why they are writing. No warm-up.
- Two to three sentences per paragraph, never a wall.
- Asks directly: "Est-ce que le 14 marche ?" — not "I was wondering if".
- Never: "I hope this email finds you well", "excited", "reach out", "circle back".
- Signs "à bientôt," then the first name. In English: "talk soon,".
- French is tu with people they have met, vous otherwise. English is casual either way.

## Samples

### fr · to a booker
<verbatim paragraph>

### en · to a playlist curator
<verbatim paragraph>
```

Ten to twenty rules. Every rule is something the excerpts show; a rule the
artist would not recognise as theirs is a guess and comes out.

A missing language, or fewer than 10 emails, is said in the file's first line
and to the artist, never silently.

## Guidelines

- **Never invents an excerpt.** A sample the artist did not write is the one
  thing that makes every future draft worse than no guide.
- **Never reads the inbox.** Other people's mail is not the artist's voice and
  was not offered.
- **Never keeps a third party's name, address, amount or account in a sample.**
  The file lives outside the repo; the row lives in the artist's database; a
  persona fixture in `evals/` never carries real excerpts.
- **Never writes `artist.voice`.** The artist sees the file and says yes; that
  is the whole point of the command.
- **Says when the material is thin.** Ten emails in one language give a guide
  for that language only, and the file says so.
