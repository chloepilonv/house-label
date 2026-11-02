# The sweep — step 9

Every surface a shipped department touches. `—` is a legitimate entry; silence
is not.

| Surface | What changes | Generated? |
|---|---|---|
| `agents/README.md` | Status · Skills · Knowledge · Database | ✅ `agents:sync` — never hand-edit |
| ” | **Input** and **Output**, as validated at step 4 | ✍️ |
| ” | any **open decision** this pass closed, struck through with the date | ✍️ |
| `README.md` | every command the pass added, one example each — AGENTS.md requires it | ✍️ |
| ” | the **Roadmap**, for anything deferred rather than done | ✍️ |
| `data/artist/brief/rules.ts` | the department's `Rule` in `RULES` + a case in `rules.test.ts`. Steps 5 and 7 changed what it asks and reads, so the brief rarely survives unchanged. `CORE_ONLY` is a real answer; absence is not. | ✍️ |
| `agent-recruitor/knowledge/label-departments.md` | any verdict this pass settled — one line in **Settled verdicts** — and any map row whose owner changed | ✍️ |
| `engine/modes.ts` | the name added to `SERVED` | ✍️ — the test refuses the line until it is true |
| `AGENT.md` frontmatter | `status:` — the earned rung, never the flattering one | ✍️ |
| ” | `google:` — re-decided against the skills this pass built, with the reason in the trailing comment. `[]` means "considered, needs nothing" | ✍️ — `agents:check` refuses a missing key, not a wrong one |
| `knowledge/*.md` frontmatter | `last_verified:` — the day this pass re-read the page's claims off their sources; never bumped on a page it did not re-read | ✍️ |
| `knowledge/*.md` body | every claim sourced and dated where it stands; no `## Open questions`, `## Sources to answer them from`, `## What the numbers say`, no `- [ ]` — a question is answered inline or cut | ✍️ — `agents:check` refuses all four |
| `AGENT.md` → `## Knowledge` | one line per file in `knowledge/`, none extra; spec the code enforces moved to the skill's `references/` | ✍️ — `agents:check` refuses an unlinked file |

Then: `bun run agents:check` · `bun run test` · `bun run evals:run <department>`.
