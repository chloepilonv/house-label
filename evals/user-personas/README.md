# Personas

Simulated artists, used by `bun run evals:converse <department>` to hold a real
multi-turn conversation with a department and write a transcript nobody had to
sit through.

**Why more than one.** A department that works for a confident, well-documented
artist can still be useless to a first-timer, and one written for a beginner can
be condescending to somebody with three records. The failures are opposite and
neither shows up without the other persona.

| Persona | Who | Catches |
|---|---|---|
| [`indie-persona`](./indie-persona.md) | Sam Reyes — first release ever, guitar over synths, non-technical, $50–150, camera-shy, Montreal/US | Jargon, unexplained steps, plans that assume assets and a distributor, question sets that assume experience |
| [`odile-ray`](./odile-ray.md) | Three records, 120+ shows, 18.4k monthly listeners, GAMIQ, Le Devoir, bilingual, five-date tour on top of the release | Condescension, re-asking what the presskit already holds, English-only plans for a French record, promises with no number behind them |
| [`portland-punk`](./portland-punk.md) | Lamprey Season — an invented punk trio from **Portland, Oregon**. Self-released, English only, a 7-inch and a cassette behind them, a vinyl LP coming, $2,000 pooled | Anything Canadian offered to a US band (SOCAN, FACTOR, CanCon), one writer assumed where there are three, a plan that forgets the pressing plant, French anywhere |
| [`ines-laval`](./ines-laval.md) | Montréal indie pop in Spanish and French, three records, on a label with a booking agency. Scenario: $5,000 of her own to launch *Marea alta* in Mexico and the US on 2027-03-12 | A plan that treats Spanish as a detail, work the label or the agency already does, a budget answered in adjectives instead of lines, Mexico ignored |

**Invented, every one.** The names, records, teams and venues they claim are
made up. Never write anything as, about, or on behalf
of a real person, and never let a department produce copy naming one.

**They are not helpful users, on purpose.** They interrupt, correct, change their
minds, answer a different question, and ask what a word means. A cooperative
simulated user proves nothing: it answers in the shape the prompt asked for and
every question looks fine.

## Adding one

One `.md` file here. Frontmatter `name`, `description`, `locale`; then who they
are, what they have, how they talk, what they push back on, and the `[DONE]`
rule. The whole file becomes the system prompt — it is read verbatim, so write
it as instructions to a person, not notes about one.

Seed a matching `artist.profile` row in the eval database first, or the
department opens with an empty brief and the conversation tests nothing.

**A fixture wipes every artist table except `connections`.** The truncate list
is the whole `artist` schema (the Google token in `connections` stays; a
persona run must never disconnect the operator). It used to name eleven
tables, so `registrations`, `saved_distributors`, `press_campaigns` and the
rest carried over from the previous persona: on 2026-09-05 the Portland trio
was told they were already SOCAN members with Odile Ray's IPI. Views
(`platform_latest`, `song_share_totals`) are not listed because they cannot be
truncated; they read from tables that are.

**No API credit?** The same personas can be played by a subagent against a
department subagent on the Claude Code subscription — the procedure is
[`recruit-evaluate` step 0b](../../agents/agent-recruitor/skills/recruit-evaluate/SKILL.md).
Claude quality, skills and knowledge only; the engine's own plumbing still needs
`evals:converse`.
