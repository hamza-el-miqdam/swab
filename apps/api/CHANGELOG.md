# Changelog — apps/api (area:backend)

> Newest first. One entry per merged change.
> Format: `## YYYY-MM-DD — [REQ-IDs] title` then bullets: what changed, why, anything a future dev must know.
> Agents: updating this file is part of your Definition of Done (G5). Keep entries ≤ ~15 lines.

> Entries before 2026-08-15 are archived in [../../docs/archive/api-CHANGELOG-pre-2026-08-15.md](../../docs/archive/api-CHANGELOG-pre-2026-08-15.md) — moved, not deleted.

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

