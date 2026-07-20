# SUG-API-008 — OtpStore Maps grow without bound: unswept entries + requestLog keys are a slow-burn memory DoS

- **Area:** backend
- **Topic:** performance
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** backend-specialist (.claude/agents/backend-specialist.md)
- **Related requirement IDs:** IDT-03

## Problem / Opportunity

`apps/api/src/otp-store.ts` cleans up only lazily:

- `entries` (line 35): an OTP entry is deleted only when `check()` is called after expiry (lines 70-73), after too many attempts (75-78), or on `consume()` (84-86). A code that is **requested but never verified** — the common case for an attacker, and a frequent case for real users — stays in the Map forever.
- `requestLog` (line 36): per-phoneHash timestamp arrays are filtered per-key on the next `request()` for that same key (lines 42-44), but a key that never requests again is **never removed**, and even active keys keep their array entry indefinitely.

Keys are attacker-chosen strings of 32–128 chars (`apps/api/src/routes/auth.ts:14-18` accepts any base64url-shaped string — no server-side check that a hash corresponds to anything). At the global limit of 100 req/min/IP (`apps/api/src/app.ts:45`) a single IP can insert ~144k unique entries/day (~each entry: key string + 32-byte hash + numbers), and a small botnet makes this a practical memory exhaustion vector against the single-process POC. The header comment (lines 1-10) honestly scopes the store as POC, but the unbounded growth is fixable now in ~20 lines without waiting for the Redis/Postgres store.

## Implementation plan

1. In `/Users/mikedown/Workspace/Swab/apps/api/src/otp-store.ts`, add a sweep method:
   ```ts
   /** Drops expired codes and stale throttle windows. O(n) — call periodically. */
   sweep(): void {
     const t = this.now();
     for (const [key, entry] of this.entries) {
       if (t > entry.expiresAt) this.entries.delete(key);
     }
     for (const [key, times] of this.requestLog) {
       const recent = times.filter((ts) => t - ts < THROTTLE_WINDOW_MS);
       if (recent.length === 0) this.requestLog.delete(key);
       else this.requestLog.set(key, recent);
     }
   }
   ```
2. Add a hard cap as defense-in-depth: `const MAX_TRACKED_HASHES = 100_000;` — in `request()` (after the throttle check at line 45), if `this.entries.size >= MAX_TRACKED_HASHES`, run `sweep()` once; if still at cap, return `{ ok: false, retryAfterMs: 60_000 }` (deny new hashes rather than evicting live codes — fail-closed, and legitimate users retry).
3. Schedule the sweep in `/Users/mikedown/Workspace/Swab/apps/api/src/app.ts` where the store is owned (line 70): 
   ```ts
   const sweepTimer = setInterval(() => otpStore.sweep(), 60_000);
   sweepTimer.unref();
   app.addHook("onClose", () => clearInterval(sweepTimer));
   ```
   (`unref()` so tests and shutdown don't hang; `onClose` for cleanliness.)
4. Update the header comment (lines 1-10) to describe the sweep and cap. Changelog entry (G5).

## Tests & acceptance criteria

New `apps/api/tests/otp-store.test.ts` (unit, injectable clock — constructor already takes `now`, line 38; run: `pnpm --filter @repo/api test`):
- `"IDT-03: sweep drops expired codes and empty throttle windows"` — fake clock; request codes for hashes A and B; advance past `OTP_TTL_MS` and `THROTTLE_WINDOW_MS`; `sweep()`; assert internal maps are empty (expose sizes via a test-only getter, e.g. `get trackedCount(): { codes: number; throttles: number }` — a read-only accessor, acceptable).
- `"IDT-03: sweep keeps live codes"` — advance only 1 min; sweep; the code still verifies via `check()`.
- `"IDT-03: at the tracked-hash cap, new hashes are throttled, existing codes still verify"` — construct with a small cap (make `MAX_TRACKED_HASHES` a constructor option defaulting to 100_000 so the test doesn't create 100k entries); fill to cap, assert next `request()` for a NEW hash returns `ok: false`, while `check()` on an existing hash still works.

## Risks & gotchas

- `setInterval` in `buildApp` runs in tests too — `unref()` + `onClose` clearing are mandatory or vitest will hang/leak.
- Never log the phoneHash keys during sweeping (G3) — log counts only if you add a debug line (`app.log.debug({ swept: n })`).
- Don't evict unexpired codes at the cap — that would let an attacker flush a victim's valid code (auth bypass of the single-use guarantee is not at stake, but usability is).
- This does not replace the production shared store (Postgres/Redis) promised at lines 8-9 — keep that note in the header.
