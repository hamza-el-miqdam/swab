# SUG-API-011 — OtpStore's IDT-03 guarantees (5-min TTL, 5-attempt cap, window math) have no unit tests

- **Area:** backend
- **Topic:** testing
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** backend-specialist (.claude/agents/backend-specialist.md)
- **Related requirement IDs:** IDT-03

## Problem / Opportunity

`apps/api/src/otp-store.ts` implements three IDT-03 security properties that the route-level tests never exercise:

- **TTL expiry** (lines 69-73): a code older than 5 minutes is rejected and deleted. No test advances the clock — `tests/auth.test.ts` only asserts the `expiresInSeconds: 300` response field (`auth.test.ts:16`), i.e. the *claim*, not the behavior.
- **Attempt cap** (lines 74-78): the 6th `check()` kills the code even if correct. Untested — `auth.test.ts:55-85` tries one wrong code, not six.
- **Throttle-window recovery** (lines 41-48): after the 5-min window passes, requests are allowed again, and `retryAfterMs` counts down from the oldest timestamp. The 429 path is tested (`auth.test.ts:87-116`) but never the recovery or the `retryAfterMs` arithmetic.

The class was built for this — the constructor takes an injectable clock (`otp-store.ts:38`, `private readonly now: () => number = Date.now`) — but no test uses it. These are exactly the "table-driven tests for pure logic" G2 calls for, and a regression in any of them (e.g. an off-by-one flipping `>` to `>=`) would silently weaken auth.

## Implementation plan

1. New file `/Users/mikedown/Workspace/Swab/apps/api/tests/otp-store.test.ts`. Clock helper:
   ```ts
   function makeStore(startMs = 0) {
     let t = startMs;
     const store = new OtpStore(() => t);
     return { store, advance: (ms: number) => { t += ms; } };
   }
   ```
2. Tests (names below). Use a fixed `HASH = "c".repeat(64)` and the code returned by `store.request(HASH)` (typed `{ ok: true; code }` after asserting `result.ok`).
3. No production code changes required — pure test addition. If asserting internal map state is needed for the sweep suggestion (SUG-API-008), coordinate so the two PRs don't collide on this file.
4. Changelog entry (G5).

## Tests & acceptance criteria

In `apps/api/tests/otp-store.test.ts` (run: `pnpm --filter @repo/api test`):
- `"IDT-03: a correct code within TTL verifies"` — request, advance 4 min 59 s, `check` → true.
- `"IDT-03: a code expires after 5 minutes"` — request, advance `5 * 60_000 + 1`, `check` with the CORRECT code → false; a fresh `request` afterwards issues a new working code.
- `"IDT-03: the 6th verify attempt destroys the code even when correct"` — request; call `check` with a wrong code 5 times (all false); 6th `check` with the CORRECT code → false (attempts cap, line 75).
- `"IDT-03: check does not consume — consume does"` — request; `check` correct → true; `check` correct again → true (not consumed); `consume`; `check` → false.
- `"IDT-03: 4th request in the window is throttled with a decreasing retryAfterMs"` — 3 requests at t=0, 60_000, 120_000; 4th at 150_000 → `ok: false` with `retryAfterMs === 150_000` (oldest 0 + 300_000 − 150_000); advance past the window and assert a request succeeds again.
- `"IDT-03: codes are 6 digits and differ per request"` — request twice (different hashes to dodge the throttle), assert `/^\d{6}$/` and (weakly) inequality is not required — just format.
- Coverage: `otp-store.ts` reaches 100% lines (it is included in `src/**` coverage, `vitest.config.ts:9-14`).

## Risks & gotchas

- `timingSafeEqual` (line 80) throws on length mismatch — both buffers are sha256 digests here so lengths always match; don't "test" mismatched lengths against the private helper.
- The throttle table test encodes current constants (3 per 5 min, `otp-store.ts:14-16`); import the exported `OTP_TTL_SECONDS` where possible and define the others as literals with a comment pointing at the source lines, so a deliberate policy change updates the tests consciously.
- Keep the fake clock strictly monotonic — the pruning filter at line 42-44 assumes forward time.
