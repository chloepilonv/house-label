---
name: recruit-audit
description: >
  Use when checking whether the agent roster still matches the format contract
  — reports structural drift (missing sections, non-conforming skill names,
  frontmatter that would fail packaging, stale staff-table rows) and proposes
  the fix for each. Triggers on "do our agents still match the template?",
  "audit the agents", "why won't this skill package?".
metadata:
  agent: recruit
  status: developed
  author: Chloe Bibiane Pilon Vaillancourt
  version: "1.0"
---

# recruit-audit

**Status:** developed — the spec is complete; no code behind it yet.

Structure decays quietly: a skill gains a fifth section, a new agent copies an
old shape, a rename lands in six places out of seven. `bun run agents:check`
covers the mechanical half in CI; this covers the half that needs judgment.

## Input

| Field | From | Notes |
|---|---|---|
| roster | `agents/*/AGENT.md` | every department |
| skills | `agents/*/skills/*/SKILL.md` | every skill directory |
| knowledge | `agents/*/knowledge/*.md` | every knowledge file |
| evals | `agents/*/evals/evals.json` | presence, assertions, skill coverage |
| the contract | [`agents/README.md`](../../../README.md) | the shape being checked against |
| staff table | [`agents/README.md`](../../../README.md) | its Status · Skills · Knowledge · Database columns are generated; Name · Description · Input · Output are hand-written and can go stale |

## Process

1. **Re-run the mechanical rules** that `agents:check` enforces, so the two
   never disagree — skill naming, spec-only frontmatter, section order and no
   extra H2, `data:` resolution, knowledge dating (`last_verified` a date,
   `name` the file name, no `## Open questions` / `## Sources to answer them
   from` / `## What the numbers say`, no `- [ ]`, every relative link resolving,
   every file linked from `## Knowledge`), eval coverage, staff-table mirroring.
   `AGENT_SECTIONS` in [`agents/sync.ts`](../../../sync.ts) is the list; when
   this skill and that constant drift, the audit passes what CI hard-fails.
2. **Check the cross-references.** Skills table matches disk both ways; every
   knowledge file is linked; every relative link resolves.
3. **Check that each department can actually reach the artist.** Every skill
   whose agent declares `data: artist:` needs a `## Data` section naming
   commands, not table names — `agents:check` cannot tell the difference. Every
   department needs a `Rule` in
   [`data/artist/brief/rules.ts`](../../../../data/artist/brief/rules.ts) —
   `bun test data/artist` fails when that map and the folders disagree. Run
   `bun run artist:brief <slug>` and read what comes back: a department whose
   brief is core-only when it holds real state is drift a linter cannot see.
4. **Check that `google:` still matches what the skills claim.** Every
   `AGENT.md` declares one, `[]` included — `agents:check` enforces the key's
   presence, not its truth. A skill that promises a deck in the artist's Drive
   under `google: []` is the drift: either the capability is missing or the
   promise is. A department declaring a capability no skill uses is the same
   defect pointing the other way. **`drive:` drifts the same way**: a skill
   that reads the artist's masters or photos while `drive.read` is `[]`, or a
   department listing folders no skill ever opens. `agents:check` enforces that
   both lists exist and that every token is real, never that they are true.
   **`services:` drifts the same way**: a skill that promises "I'll put it in
   your Buffer" under `services: []`, or `buffer` declared with no skill that
   drafts a post; `hunter` declared with no skill that offers the lookup, or
   without `contacts` in its `data.artist` list (the engine then builds no tool).
5. **Check for hollow content** — the drift a linter can't see. A `## Process`
   restating the description instead of naming steps. A question cut rather
   than answered — a fact a skill needs that no knowledge file states. A
   `last_verified` bumped on a page whose claims were not re-read. A number
   with no source beside it. A knowledge file restating a sibling department's
   fact instead of linking it. Assertions that can't fail.
6. **Check the house style.** Sections opening with a paragraph where bullets
   would do, bullets past two sentences, prose restating the bullet below it, a
   rule followed by an em-dash aside that only restates it, repeated shapes that
   should be tables.
7. **Report, don't fix.** Group by agent, most structural first.

## Output

A table — agent · file · what drifted · the fix — mechanical failures before
judgment calls. Every row names a specific file and section, never "several
skills". When nothing drifted, say so in one line and name what was checked, so
an empty report is distinguishable from one that didn't run.

## Guidelines

- **Report, don't rewrite.** Fixing a roster in one pass flattens it. Findings
  are proposals; the human picks.
- **A repeated finding is a template bug.** Six agents growing the same section
  means the contract is missing it — say that instead of filing six rows.
- **Never flag content as drift.** Unusual knowledge or a long Process is not a
  violation. Shape, cross-links, and honesty markers — not editorial judgment.
- **Spec-key violations block distribution.** A top-level `status:` fails
  `package_skill.py` and claude.ai upload. Rank those first; they aren't style.
