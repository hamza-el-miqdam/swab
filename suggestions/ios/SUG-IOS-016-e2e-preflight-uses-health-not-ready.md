# SUG-IOS-016 — E2E preflight checks `/health` (liveness only): a live API with a dead DB passes preflight and fails mid-suite confusingly

- **Area:** ios
- **Topic:** testing
- **Impact:** low
- **Effort:** S
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** ONB-02, IDT-01

## Problem / Opportunity

Both E2E preflights probe liveness only:

- `scripts/e2e-ios.sh:10` — `curl -sf http://localhost:3001/health`
- `SwabAppUITests/Support/SwabUITestCase.swift:17-25` via `DevBackend.waitForHealth` (`SwabAppUITests/Support/DevBackend.swift:28-46`), which polls `baseURL.appendingPathComponent("health")`.

Per G3, `/health` is liveness with no dependencies while `/ready` checks DB connectivity — and the API implements `/ready` (`apps/api/src/routes/health.ts:10`). If Postgres is down or unmigrated while the Fastify process is up (a real docker-compose partial-start state), preflight passes and the suite then dies ~30s later inside `OnboardingFlow` with the generic "OTP screen not reached (is the API up?)" (`SwabAppUITests/Support/OnboardingFlow.swift:70`) — exactly the "every UI step timing out mysteriously" failure mode the preflight comment says it exists to prevent (`SwabUITestCase.swift:1-7`).

## Implementation plan

1. `scripts/e2e-ios.sh:10`: change the probe to `/ready` and update the error message:
   ```bash
   curl -sf http://localhost:3001/ready >/dev/null || {
     echo "ERROR: API not ready at http://localhost:3001/ready (DB reachable?) — run: docker compose up --build -d" >&2; exit 1; }
   ```
2. `DevBackend.waitForHealth` (`DevBackend.swift:28-46`): probe `"ready"` instead of `"health"`; rename to `waitForReady` and update the one call site (`SwabUITestCase.swift:19`) plus the failure message (`:21`).
3. Mirror check: `scripts/e2e-android.sh` likely has the same pattern — do not edit it from an `area:ios` PR; note it for the android-specialist in the PR description.
4. Keep the timeout/poll cadence unchanged (15s, 300ms) — `/ready` includes a DB round-trip; the existing 3s per-request timeout (`DevBackend.swift:34`) is ample locally.

## Tests & acceptance criteria

- No unit tests (shell + test-support change). Acceptance:
  - `docker compose up --build -d` fully up → `scripts/e2e-ios.sh` runs and the 13-test suite passes as before.
  - Negative check (manual, note in PR): stop only Postgres (`docker compose stop db`), run the script → it exits at preflight with the new DB-pointing message instead of failing inside XCUITest.
- The generated `test-results/e2e/e2e-report.md` must remain PASS with zero drift-guard failures.

## Risks & gotchas

- `/ready` semantics belong to the backend; if it ever adds dependencies beyond the DB, preflight strictness rises with it — that is the desired direction, but if it becomes flaky, fall back to probing both and printing which failed.
- Don't switch the app's own runtime code to `/ready` — only test preflight; the app has no health-probe logic and should not gain one here.
