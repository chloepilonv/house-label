---
name: {{slug}}-{{verb-phrase}}
description: >
  Use when {{the trigger situation}} — {{what it produces}}. {{The constraint
  that matters most, e.g. "Never sends." / "Prepares only; the artist submits."}}
metadata:
  agent: {{slug}}
  status: developed
  greeting: {{the clause after "I can", in the artist's words — e.g. find rooms that fit your show}}
  greeting-fr: {{the same in French}}
  author: {{author}}
  version: "1.0"
---

{{HOUSE STYLE, delete this block: bullets by default. Claim, then stop — never
append the justification as an em-dash aside. One idea per bullet, lead word
bolded, two sentences maximum. Tables for repeated shapes. Never a sentence
explaining what a section is. Full rules in agents/README.md.}}

# {{slug}}-{{verb-phrase}}

**Status:** developed — the spec is complete; no code behind it yet.

{{One paragraph: what this skill is for and why it exists as its own skill.}}

## Data

{{Delete this section only if the skill touches no artist data at all.}}

The artist's file, already shaped for this department:

```bash
bun run artist:brief {{slug}}
```

{{If this skill writes anything the artist signs — a pitch, a bio, a caption,
an application answer — keep the paragraph below verbatim. Delete it otherwise.}}
**The `Voice` section of the brief is how the artist writes.** Match it: the
greeting, the sentence length, the sign-off, the words it says never to use —
and copy the register of the samples rather than describing it. When it says no
guide is on file, say so once, name `houselabel voice` as the fix, and draft
anyway.

{{One or two sentences: which section of the brief this skill actually uses,
and the selection rule it relies on. If that rule lives in
data/artist/brief/rules.ts, say so — it is why two runs agree.}}

{{Anything the brief does not carry, and any write this skill makes:}}

```bash
bun run artist:get {{table}} {{col}}={{value}}
bun run artist:set {{table}} '{"...":"..."}' --conflict {{key}}
bun run artist:remember {{slug}} {{key}} "{{value}}"
```

{{Catalog data — ours, read-only — goes through data/catalog/client.ts, never
artist:get.}}

`artist:set profile` and `artist:set voice` are refused — the artist owns those
rows and edits them with `houselabel profile` and `houselabel voice`. If they
tell this skill something that belongs there, say it has been noted and point
them at the command.

Never write SQL and never open the database directly.

## Input

| Field | From | Notes |
|---|---|---|
| {{field}} | {{`artist:brief` \| `artist:get <table>` \| catalog \| conversation}} | {{shape, defaults, what wins on conflict}} |

## Process

1. **{{Step name}}.** {{What the agent does, concretely enough that two runs
   agree. Name the table it reads, the field it checks, the branch it takes.}}
2. **{{Step name}}.** {{What happens when the data is missing — this is where
   most skills go wrong, so make the null path explicit.}}
3. **{{Step name}}.** {{Produce the output described below.}}

## Output

{{The exact shape returned, formatting included. State what a missing value
looks like — a visible placeholder, a warning, a dash — never a silent guess.
If the result is saved, say what freezes at save time and what stays live.}}

## Guidelines

- {{What never to invent.}}
- {{What never to send or submit.}}
- {{What to disclaim every single time — the standing caveat this output
   carries.}}
- {{Where the domain rules live: link the knowledge file rather than restating
   it, so the numbers have one home.}}
