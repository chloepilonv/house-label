# Cron jobs — the convention

Every scheduled workflow in this repo follows the template below. It exists
because [`crawl.yml`](./crawl.yml) fired on **two consecutive Mondays and failed
in under 25 seconds each time**, and nobody found out until someone went
looking. A cron that fails quietly is worse than no cron: it produces the
feeling of freshness without the fact.

**Adding a scheduled job? Copy [the template](#the-template) and change only the
marked lines.** An agent creating one reads this file first — `AGENTS.md` points
here, and so does
[`recruit-dataset`](../../agents/agent-recruitor/skills/recruit-dataset).

## The ten rules

| # | Rule | Why |
|---|---|---|
| 1 | **Preflight every secret, and name the missing one** | The two silent failures were a missing `CATALOG_DATABASE_URL` surfacing as a stack trace at `db.ts:15`. A cron must say *"secret X is not set"* in the run summary. |
| 2 | **Always ship `workflow_dispatch`** | A schedule you cannot trigger by hand cannot be debugged. |
| 3 | **Always open an issue on failure** | GitHub emails the repo owner about scheduled-workflow failures inconsistently, and never for a job that "succeeded" with zero rows. The issue is the alarm. |
| 4 | **Always `concurrency` with `cancel-in-progress: false`** | Two crawls writing the same table is corruption, not contention. Queue, never overlap. |
| 5 | **Always `timeout-minutes`** | An unbounded job burns runner minutes until GitHub's 6-hour cap. |
| 6 | **Never publish on a schedule** | A bad run must not reach an artist because a cron fired. Publishing is `workflow_dispatch` with an explicit input, always. |
| 7 | **Write the outcome to `$GITHUB_STEP_SUMMARY`** | Logs are for debugging, the summary is for a human deciding whether to care. |
| 8 | **Config lives in the database, never in the workflow** | Which topics crawl is `select distinct topic from catalog.crawl_sources where status='active'`. A matrix in YAML is a second source of truth that drifts. |
| 9 | **Zero output is a failure, not a success** | The first green run of `crawl.yml` had `sources_ok: 0, sources_failed: 19` and still reported success. A job that did none of its work must exit non-zero — the script decides this, not the YAML. |
| 10 | **A workflow that does not parse fails invisibly** | `crawl.yml` failed on every push for weeks with a 0-second run, no jobs, and no logs, because a bare column-0 line inside a `run: |` block ended the block scalar and broke the document. GitHub reports this by naming the run after the file *path* instead of its `name:` — that is the only symptom. Keep every line of a `run:` block indented past the scalar, and build multi-line text with `printf`, never a literal newline in a shell string. |

## Cadence

Per-source, in the data — not per-workflow. `catalog.crawl_sources.cadence_days`
decides whether a source is due; the workflow runs weekly and skips what isn't.

| Data | Typical cadence | Why |
|---|---|---|
| Press contacts | `30` | mastheads change slowly |
| Distribution | `30` | prices moved twice in 2026; link rot is the real risk |

**Never add a second workflow to get a second cadence.** That reintroduces the
topic matrix rule 8 deleted.

## The template

```yaml
name: <What it does>

# <One paragraph: what this produces and what it deliberately does not do.>
#
# Required repo secrets:
#   <SECRET_NAME>  — <what it is for>
#
# Cadence is per-source data, not per-workflow — see the README next to this file.

on:
  schedule:
    - cron: "0 6 * * 1"          # <-- change: Mondays 06:00 UTC
  workflow_dispatch:              # rule 2 — never omit
    inputs:
      publish:
        description: "Upload the result after building it"
        type: boolean
        default: false

concurrency:                      # rule 4
  group: <job-name>
  cancel-in-progress: false

permissions:
  contents: read
  issues: write                   # rule 3 — needed to open the failure issue

jobs:
  run:
    runs-on: ubuntu-latest
    timeout-minutes: 45           # rule 5 — always set one

    steps:
      - uses: actions/checkout@v4

      # ── rule 1: preflight, and name what is missing ──────────────────
      - name: Check required secrets
        env:
          CATALOG_DATABASE_URL: ${{ secrets.CATALOG_DATABASE_URL }}
          TINYFISH_API_KEY: ${{ secrets.TINYFISH_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          missing=""
          for v in CATALOG_DATABASE_URL TINYFISH_API_KEY ANTHROPIC_API_KEY; do
            [ -z "${!v}" ] && missing="$missing $v"
          done
          if [ -n "$missing" ]; then
            {
              echo "## Cannot run — missing repository secrets"
              echo
              for v in $missing; do echo "- \`$v\`"; done
              echo
              echo "Set them at Settings → Secrets and variables → Actions."
            } >> "$GITHUB_STEP_SUMMARY"
            echo "::error::Missing repository secrets:$missing"
            exit 1
          fi

      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: bun install --frozen-lockfile

      # Only if the job renders pages. Skip otherwise.
      - run: bunx puppeteer browsers install chrome

      - name: <Do the work>
        run: bun run <script>
        env:
          CATALOG_DATABASE_URL: ${{ secrets.CATALOG_DATABASE_URL }}
          TINYFISH_API_KEY: ${{ secrets.TINYFISH_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_SHA: ${{ github.sha }}

      # ── rule 7: the summary is what a human reads ────────────────────
      - name: Summarise
        if: always()
        run: bun run <script>:summary >> "$GITHUB_STEP_SUMMARY"

      # ── rule 6: publishing is never automatic ────────────────────────
      - name: Publish
        if: ${{ inputs.publish }}
        run: bun run <script> --publish
        env:
          CATALOG_DATABASE_URL: ${{ secrets.CATALOG_DATABASE_URL }}

      # ── rule 3: a failed cron must be loud ───────────────────────────
      - name: Open an issue on failure
        if: failure() && github.event_name == 'schedule'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          RUN: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: |
          title="cron failed: ${{ github.workflow }}"
          if gh issue list --state open --search "$title in:title" --json number \
             --jq 'length' | grep -qv '^0$'; then
            echo "An open issue already exists — not duplicating."
            exit 0
          fi
          gh issue create --title "$title" \
            --label automated \
            --body "Scheduled run failed on $(date -u +%Y-%m-%d).

          Run: $RUN

          Check the preflight step first — a missing repository secret is the
          most common cause and fails in under 30 seconds."
```

## Before you commit a new cron

- [ ] Every secret it reads is in the preflight list **and** in `.env.example`
- [ ] `workflow_dispatch` present
- [ ] `concurrency` group set, `cancel-in-progress: false`
- [ ] `timeout-minutes` set
- [ ] Failure opens an issue
- [ ] Nothing publishes on the schedule path
- [ ] The script exits non-zero when it produced nothing
- [ ] No topic list, matrix, or environment name hard-coded in the YAML
- [ ] `gh api repos/OWNER/REPO/actions/workflows` shows the workflow's `name:`, not its path — a path means it does not parse
- [ ] Triggered once by hand and the summary read
