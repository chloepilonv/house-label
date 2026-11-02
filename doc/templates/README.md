# doc/templates/

Loop definitions, in the [loop engineering](https://github.com/cobusgreyling/loop-engineering)
format. A loop is a recurring, self-correcting cycle with memory on disk — not a
briefing document handed to an agent once.

```
doc/templates/
├── loop.template.md            copy to start a new loop
├── loop-STATE.template.md      copy to <name>-loop-STATE.md at repo root (gitignored)
└── loop-verifier.agent.md      the checker half of maker/checker
```

`loop.template.md` and `loop-STATE.template.md` are the upstream
`templates/pattern-template.md` and `templates/STATE.md.template`, adapted:
Grok/Codex rows dropped, and `Post-Run Critique` + `Cost Profile` added because
`patterns/daily-triage.md` demonstrates both and the blank template omits them.

## Starting a loop

```bash
cp doc/templates/loop.template.md my-loop.md
cp doc/templates/loop-STATE.template.md my-loop-STATE.md
cp doc/templates/loop-verifier.agent.md .claude/agents/loop-verifier.md
# fill every {{placeholder}}, then:
```

```text
/loop 30m Read my-loop.md and my-loop-STATE.md. Run one cycle. Spawn
loop-verifier to check independently. Update STATE. Report-only for cycle one.
```

## The three rules a loop must satisfy

1. **Memory on disk.** The model forgets everything between runs. `STATE.md` is
   the spine, and the loop re-queries live facts rather than trusting numbers it
   wrote last cycle.
2. **The exit condition is objective** — an exit code or a row count, never an
   opinion — plus a bound: *stop after N rounds with no progress*.
3. **Maker/checker.** The agent doing the work never marks it done.
   `loop-verifier` defaults to REJECT and runs the tests itself rather than
   believing the implementer.

## Why the verifier lives in `.claude/agents/`

It belongs to no department, so `agents:sync` generates nothing for it. Until
`fd610fe`, sync did a blanket `rm -rf` on `.claude/agents/` and deleted it on
every run — the skills writer had a comment explaining why that is wrong, and the
agents writer did it anyway. Sync now removes only the files it generates, so a
hand-written agent parked there survives. Commit it like any other source file.

## Section order is fixed

`Scheduling · Required Skills · State · How the Loop Runs · Post-Run Critique ·
Verification Strategy · Human Handoff Points · Tool-Specific Notes · Failure
Modes & Mitigations · Cost Profile · Success Metrics`
