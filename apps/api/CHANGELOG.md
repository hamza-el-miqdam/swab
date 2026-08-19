# Changelog — apps/api (area:backend)

> Newest first. One entry per merged change.
> Format: `## YYYY-MM-DD — [REQ-IDs] title` then bullets: what changed, why, anything a future dev must know.
> Agents: updating this file is part of your Definition of Done (G5). Keep entries ≤ ~15 lines.

> Entries before 2026-08-15 are archived in [../../docs/archive/api-CHANGELOG-pre-2026-08-15.md](../../docs/archive/api-CHANGELOG-pre-2026-08-15.md) — moved, not deleted.

## 2026-08-19 — [SUG-DB-013, IDT-01] Test fixture now respects the 50-char displayName contract

- `packages/db` narrowed `users.display_name` to `varchar(50)` (SUG-DB-013), mirroring the cap `routes/auth.ts` has always enforced (`z.string().trim().min(1).max(50)`).
- `tests/prisma-repo.test.ts`'s `syntheticIdentity()` built a ~63-char displayName. It never went through the route, so nothing rejected it while the column was unbounded `text` — the fixture was silently out of contract and the narrowing surfaced it. Shortened to `tpr-<label>-<uuid>` capped at 50.
- **Gotcha:** these integration tests bypass the route and write via `prismaRepository` directly, so they do **not** inherit Zod validation. A fixture that violates the API contract will now fail at the DB instead of passing quietly — which is the point, but it means fixtures must be contract-shaped by hand.

## 2026-08-17 — [IDT-03] SUG-API-008 `OtpStore` sweeps expired codes/throttle windows and caps tracked hashes

- `entries`/`requestLog` were cleaned up only lazily (on `check()`/`consume()`, or on the same key's next `request()`), so a code that is requested but never verified — the common attacker pattern, and a frequent real-user one — stayed in memory forever. Attacker-chosen 32–128 char hash keys made this a practical slow-burn memory-exhaustion vector against the single-process POC.
- Added `OtpStore.sweep()`: O(n) pass dropping expired codes and stale (empty) throttle windows. `apps/api/src/app.ts` schedules it every 60s (`unref()`'d, cleared via `onClose`, so it never keeps the process or a test's event loop alive).
- Added a hard cap (`maxTrackedHashes`, default 100k, constructor-injectable for tests): `request()` sweeps once at the cap and, if still full, denies the new hash (`retryAfterMs: 60_000`) rather than evicting a live code — fail-closed, legitimate users retry. The cap applies **only to hashes not already tracked**: an existing one overwrites its own row and cannot grow the map, so it stays servable — otherwise a user mid-sign-in who lost their SMS could never get a second code while an attacker holds the cap.
- Tests: `apps/api/tests/otp-store.test.ts` — sweep drops expired/empty state, sweep keeps live codes, and cap behavior (new hash denied, existing codes still verify) via an injected small cap.
- Never logs phoneHash keys (G3) — sweep and the cap path touch no logger.
- **CI note:** `tests/prisma-repo.test.ts` fails locally (no Postgres in this dev environment) — pre-existing, unrelated to this change, green in CI's `postgres:17` service. All other tests (incl. 3 new ones) pass; lint/typecheck/build all green.

## 2026-08-17 — [IDT-01] SUG-API-004 concurrent first sign-ins no longer 500 on the duplicate-user race

- `prisma-repo.ts`'s `createUser` was a bare `prisma.user.create`; two near-simultaneous `POST /auth/otp/verify` calls for the same phoneHash (double-tap, client retry, two devices — the OTP `check()` doesn't consume, so both legitimately hold a valid code) both pass `findUserByPhoneHash → null`, then the loser's `create` threw a `P2002` unique-violation that the global error handler turned into a 500. Now mirrors `upsertVault`'s pattern (SUG-API-003): catch `P2002`, re-read by `phoneHash`, return the existing user — the race loser signs in as the winner.
- `repo.ts`'s `Repository.createUser` doc comment now states the race-safe contract. `tests/fake-repo.ts`'s double previously overwrote silently on a duplicate key (diverging from real Prisma semantics); it now returns the existing entry too.
- Tests: stubbed-client unit tests for the P2002/rethrow/row-vanished branches in `tests/prisma-repo-error-mapping.test.ts` (mirrors the existing `upsertVault` error-mapping tests); a deterministic repo-level race test in `tests/auth.test.ts` against the fake double.
- **Gotcha:** a true concurrent HTTP race can't be reproduced through `fastify.inject()` — it serializes a request's full completion (including OTP consumption) ahead of the next one starting, so a route-level `Promise.all` test always sees the second call as an already-consumed 401, not a real race. The repo-level test above exercises the same code path deterministically instead.
- **Skipped:** a real-Postgres integration test (mirroring `upsertVault`'s "two concurrent baseVersion 0 upserts" test) is left for a future change — `tests/prisma-repo.test.ts` already fails in this environment with no local Postgres (pre-existing gap predating this change, confirmed via `git stash`; green in CI's `postgres:17` service, per SUG-API-011's precedent).

## 2026-08-17 — [IDT-03] SUG-API-005 `trustProxy` + a stricter per-IP tier on the OTP routes

- The Fastify factory never set `trustProxy`, so behind any reverse proxy `req.ip` (the rate-limit key) was the proxy's address — every user shared one 100/min bucket. Added `TRUST_PROXY_HOPS` (fail-closed default `0`, i.e. `X-Forwarded-For` ignored) — an operator sets it to the real hop count, spoof-resistant unlike `trustProxy: true`.
- `/auth/otp/request` and `/auth/otp/verify` now carry a route-level 10/min-per-IP limit — one IP spraying requests across many phoneHashes previously stayed under the per-hash throttle (`OtpStore`) but was otherwise unbounded. Gotcha: a route-level `config.rateLimit` **replaces** the global 100/min bucket for that route (`@fastify/rate-limit` gives it a private child store and skips the global hook), it does not stack on top of it — and the two routes count separately from each other.
- New `apps/api/.env.example` entry: `TRUST_PROXY_HOPS=0`.
- **Bug found and fixed en route:** the global rate-limiter's `errorResponseBuilder` returned a plain object, but `@fastify/rate-limit` `throw`s whatever the builder returns — a non-`Error` value isn't recognized by the generic `setErrorHandler` (`instanceof Error` check), so every 429 was silently mislabeled as a 500. Never caught before because the 100/min global limit had no test driving 101 requests. Fixed with a small `RateLimitProblem extends Error` class the handler now special-cases into a proper RFC 7807 429.
- Gotcha: `tests/prisma-repo.test.ts` fails locally (no Postgres in this environment) — pre-existing, unrelated to this change, green in CI's `postgres:17` service; all 45 other tests pass.

## 2026-08-16 — [IDT-01, VLT-02] `dev:local` — run the API with no database

- `pnpm --filter @repo/api dev:local` boots the API against the in-memory `fakeRepository()` with a stub `dbHealth`, so the mobile E2E gates (`scripts/e2e-{ios,android}.sh`) run on a machine without Docker or Postgres. Added because the Android gate was believed unrunnable locally for months — it wasn't; `buildApp()` already takes persistence as an injected seam, and `DATABASE_URL` is only ever read by Prisma, so a placeholder satisfies the env schema.
- Lives in `tests/dev-local-server.ts` on purpose: excluded from the production build (`tsconfig.build.json` includes only `src/**`), not matched by vitest (`tests/**/*.test.ts`), and outside the coverage scope (`src/**`). It must never be imported by `src/`.
- **Gotcha:** state is per-process and vanishes on exit — no migrations, no constraints, no real concurrency. Use `docker compose up --build` when the test needs Postgres semantics; `tests/prisma-repo.test.ts` always does.
- The committed `JWT_SECRET` in that file is local-only and public by construction. Never reuse it (G1).

## 2026-08-16 — [IDT-03] SUG-API-011 unit tests for OtpStore's TTL/attempt-cap/throttle guarantees

- New `tests/otp-store.test.ts` exercises `OtpStore` directly via its injectable clock — previously only the route-level `auth.test.ts` touched it, asserting the *claimed* `expiresInSeconds: 300` but never advancing time to prove TTL expiry, the 5-attempt verify cap, or throttle-window recovery.
- Six table-driven tests: TTL survives just under 5 minutes, expires just after (with a working fresh code issued afterward), the 6th verify attempt destroys the code even when correct, `check()` doesn't consume but `consume()` does, the 4th request in a throttle window returns a decreasing `retryAfterMs` and recovers past the window, and codes are `\d{6}`.
- Pure test addition, no production code changed. `otp-store.ts` now at 100% line coverage (verified in isolation — the full-suite coverage table doesn't print when an unrelated suite fails first, see gotcha below).
- Gotcha: this environment has no local Postgres/Docker, so `tests/prisma-repo.test.ts` fails locally regardless of this change (known pre-existing gap, green in CI's `postgres:17` service). Confirmed the new suite and all 31 previously-passing tests are unaffected.

## 2026-08-16 — [VLT-02] SUG-API-003 upsertVault no longer masks real DB failures as a 409 conflict

- First-write branch of `upsertVault` (`prisma-repo.ts`) had a bare `catch`: a dropped connection or pool timeout was indistinguishable from a unique-violation, so it was reported as `{ ok: false }` → the route always answered 409 "Stale vault version" — an infinite retry loop on a transient infra error, with the real cause never logged. Now only `Prisma.PrismaClientKnownRequestError` with `code === "P2002"` maps to a conflict; everything else rethrows, hits the global error handler, and returns a logged 500.
- Also rethrows if the row that caused the P2002 has vanished by the follow-up `findUnique` (self-contradictory state) instead of silently reporting `currentVersion: 0`. The `baseVersion > 0` CAS branch's `?? 0` fallback is unchanged — there, "no row" legitimately means "retry with version 0".
- `prismaRepository()` now takes an optional `client: PrismaClient = prisma` param so the error-mapping branches can be unit-tested with a stub (`tests/prisma-repo-error-mapping.test.ts`) without touching real Postgres or `tests/prisma-repo.test.ts`'s integration suite (backend rule 7: no Prisma mocking in integration tests — this is a separate unit-test file).

## 2026-08-16 — SUG-API-016 global error handler no longer echoes internal messages as titles

- `setErrorHandler` (`app.ts`) passed any thrown 4xx error's raw `.message` through verbatim as the RFC 7807 `title` — an allowlist-free passthrough, and the handler's contract per the file's own G1/G3 comments should be an allowlist, not "whatever message the throwing layer produced".
- Added `KNOWN_4XX_TITLES`, mapping Fastify's content-type-parser codes (`FST_ERR_CTP_EMPTY_JSON_BODY`, `FST_ERR_CTP_INVALID_MEDIA_TYPE`, `FST_ERR_CTP_BODY_TOO_LARGE`) to fixed titles; any other thrown 4xx defaults to the generic `"Request Error"`. Route-level `sendProblem` calls (400/401/409/413/422 in `routes/*.ts`) are unaffected — they bypass this handler and keep their own precise titles.
- 4xx errors reaching this handler are now logged at `debug` (code + status only, matching the `error` level already used for 5xx) — previously invisible, even for a malformed-request storm.
- Gotcha: Fastify 5.11's `FST_ERR_CTP_INVALID_MEDIA_TYPE` message no longer embeds the client's `Content-Type` header value (fixed upstream since the suggestion was written) — the reflection test now guards the invariant rather than reproducing the original leak.
- When SUG-API-007 (OpenAPI/Zod type-provider) lands, its validation-error branch must run before this generic mapping so field-path detail survives.

## 2026-08-15 — [VLT-02] SUG-API-013 bound vault `version` to the Postgres int4 range

- `POST /vault`'s `version` field had no upper bound, but the column is `Int` (int4, max 2,147,483,647). An out-of-range value passed Zod, reached `upsertVault`, and a driver/Prisma range error surfaced as a generic 500 instead of a clean 4xx (G1: validate at the boundary, to the real storage contract).
- Added `.max(2_147_483_646)` — one below the int4 cap so a successful write's `baseVersion + 1` also fits.
- No compatibility risk: real clients increment by 1 per sync and are nowhere near the bound; this is hostile-input hardening only.

## 2026-08-15 — SUG-API-012 validate client-supplied x-request-id

- `genReqId` now only honors `x-request-id` when it matches `/^[A-Za-z0-9._-]{1,64}$/`; anything else (over-long, malformed) falls back to `randomUUID()` as before. Headers are input too (G1) — an unbounded client-supplied value was stamped on every log line and echoed in every problem body.
- **Client-supplied ids are namespaced (`client-` prefix), never taken verbatim.** Shape validation alone was not enough: `randomUUID()` output itself satisfies the regex, so a caller could supply a *server-shaped* id — replaying one harvested from a response to interleave its log lines under another request's trace, or pinning one constant across all traffic to collapse `reqId` as a forensic key. The prefix keeps correlation working while making client-chosen ids self-evident in logs.
- Added an `onSend` hook that echoes `x-request-id` on ALL responses, not just RFC 7807 problem bodies, so clients can always correlate a success response with server logs (G3). Note this also makes ids trivially harvestable, which is why the namespacing above is required rather than optional.
- No client (iOS/Android/scripts) sends this header today, so both the regex and the prefix are free hardening — nothing to migrate.

