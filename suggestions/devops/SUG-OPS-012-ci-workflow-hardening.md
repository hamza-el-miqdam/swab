# SUG-OPS-012 — ci.yml hardening: no timeout, cancels in-progress main builds, no workflow_dispatch, no actionlint, no job summary

- **Area:** devops
- **Topic:** ci
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a (devops rules: concurrency groups, actionlint in DoD, job-summary rule 5)

## Problem / Opportunity

Five small gaps in `.github/workflows/ci.yml`, each independently cheap:

1. **No `timeout-minutes`** on the job (`ci.yml:16-17`) — a hung `pnpm install` or vitest watcher burns the default 360-minute cap of free-tier minutes.
2. **Concurrency cancels main builds**: `ci.yml:11-13` sets `cancel-in-progress: true` for group `ci-${{ github.ref }}`, which includes `refs/heads/main`. Two quick merges in a row cancel the first main run, leaving a merge commit with **no completed CI** — bad for bisecting and for any future required-check/deploy trigger keyed on main being green.
3. **No `workflow_dispatch` trigger** (`ci.yml:3-6`) — the devops DoD requires "Workflow changes tested on a branch (`workflow_dispatch` dry-run)" (`agents/devops-infrastructure-specialist.md`, Definition of Done), which is impossible without the trigger.
4. **No actionlint** — same DoD requires "`actionlint` clean", but nothing runs it; workflow YAML errors are found only at run time.
5. **No job summary** — devops project rule 5: "every workflow ends with a job-summary step (`$GITHUB_STEP_SUMMARY`) reporting durations, cache hit rate…". None exists.

## Implementation plan

1. Edit `.github/workflows/ci.yml`:
   ```yaml
   on:
     push:
       branches: [main]
     pull_request:
     workflow_dispatch:

   concurrency:
     group: ci-${{ github.ref }}
     cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
   ```
2. Add `timeout-minutes: 20` under `jobs.ci` (`ci.yml:16-17`); current runs are far under this — tune upward only with evidence.
3. Add an actionlint step early in the job (pre-install slot next to `ci.yml:26`):
   ```yaml
   - name: actionlint
     uses: raven-actions/actionlint@v2   # pin to SHA per SUG-OPS-005
   ```
   (Alternative with zero third-party action: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest -color` — pick one, note the choice.)
4. Add a summary step at the end:
   ```yaml
   - name: Job summary
     if: always()
     run: |
       {
         echo "## CI summary"
         echo "- ref: ${GITHUB_REF}"
         echo "- turbo: see task log above (cache stats added by SUG-OPS-009)"
       } >> "$GITHUB_STEP_SUMMARY"
   ```
   Keep it minimal now; SUG-OPS-009 step 3 enriches it with cache hit rate.
5. Root `CHANGELOG.md` entry.

## Tests & acceptance criteria

- Push branch → run completes; "Summary" tab shows the job summary block.
- Trigger manually via Actions → CI → "Run workflow" (proves `workflow_dispatch`).
- Two rapid pushes to a PR branch: first run cancelled (expression false path); simulate on main is hard — verify by inspection that `github.ref != 'refs/heads/main'` renders `false` in the run's concurrency annotation.
- Introduce a YAML typo (`runs-on: ubuntu-ltest`) on a scratch branch → actionlint step fails before anything else runs; revert.

## Risks & gotchas

- `cancel-in-progress` as an expression is valid GitHub syntax (boolean expression) — actionlint itself will confirm.
- Queued (not cancelled) main runs can back up if many merges land at once; with one job at ~2-4 min this is a non-issue at current scale.
- If SUG-OPS-001 adds more jobs to this file, `timeout-minutes` must be set per job (it is job-level, not workflow-level).
