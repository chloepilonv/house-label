# {{PATTERN_NAME}} Loop

**Goal**: {{ONE_SENTENCE_GOAL}}

## Scheduling

**Recommended**:
- Claude Code: `{{CLAUDE_COMMAND}}`
- GitHub Actions: only if it must run unattended — and it copies
  `.github/workflows/README.md`, the ten cron rules, without exception.

Run **report-only for the first cycle**. Write nothing until a human has read
one full cycle's output.

## Required Skills

- `{{SKILL_1}}` — {{DESCRIPTION}}
- `{{SKILL_2}}` — {{DESCRIPTION}}

## State

Filename: `{{STATE_FILE}}`

```markdown
<!-- Minimal example schema -->
```

## How the Loop Runs (Typical Cycle)

1. {{STEP_1}}
2. {{STEP_2}}
3. {{STEP_3}}

## Post-Run Critique

Append to `{{STATE_FILE}}` every run:
- What was proposed and rejected, and why
- Where the loop found nothing — bad query, or genuinely nothing there?
- One change to improve the next cycle

## Verification Strategy

**The exit condition is a number, not an opinion.**

| Item | Target | Check |
|---|---|---|
| {{ITEM}} | {{NUMBER}} | {{EXACT_COMMAND_OR_QUERY}} |

- `bun test` exits 0
- {{QUALITY_METRIC — coverage alone is not success}}
- Maker never grades itself: spawn `loop-verifier` (see
  `doc/templates/loop-verifier.agent.md`). Default stance REJECT.
- **Stop after {{N}} rounds with no progress**, whatever the metric says.

## Human Handoff Points

- {{GATE_1}}
- {{GATE_2}}

## Tool-Specific Notes

**Claude Code**:
```text
/loop {{CADENCE}} Read {{LOOP_FILE}} and {{STATE_FILE}}. Run one cycle on the
item furthest from target. Spawn loop-verifier to check independently. Update
STATE. Report-only for cycle one — no writes.
```

## Failure Modes & Mitigations

| Failure | Mitigation |
|---------|------------|
| {{FAILURE}} | {{MITIGATION}} |

## Cost Profile

| Scenario | Tokens/run | $ | Notes |
|---|---|---|---|
| Report-only cycle | ~{{30k}} | $0 | |
| {{WORKING_CYCLE}} | ~{{150k}} | {{$}} | |

**Cadence**: {{CADENCE}} · **Tier**: {{low/medium/high}} · **Daily cap**: {{800k}}

`CRAWL_BUDGET_USD` bounds only the `catalog:enrich:*` passes, **not** `catalog:refresh`.

## Success Metrics

- {{METRIC_1 — the number in Verification Strategy}}
- {{METRIC_2 — the quality that makes the number mean something}}
- Proposals accepted / proposals made (verifier precision)

## Known-broken — do not rediscover

{{Anything already investigated. Saves the next agent a day.}}