# Changelog — apps/api (area:backend)

> Newest first. One entry per merged change.
> Format: `## YYYY-MM-DD — [REQ-IDs] title` then bullets: what changed, why, anything a future dev must know.
> Agents: updating this file is part of your Definition of Done (G5). Keep entries ≤ ~15 lines.

## 2026-08-15 — [VLT-02] SUG-API-013 bound vault `version` to the Postgres int4 range

- `POST /vault`'s `version` field had no upper bound, but the column is `Int` (int4, max 2,147,483,647). An out-of-range value passed Zod, reached `upsertVault`, and a driver/Prisma range error surfaced as a generic 500 instead of a clean 4xx (G1: validate at the boundary, to the real storage contract).
- Added `.max(2_147_483_646)` — one below the int4 cap so a successful write's `baseVersion + 1` also fits.
- No compatibility risk: real clients increment by 1 per sync and are nowhere near the bound; this is hostile-input hardening only.

## 2026-08-15 — SUG-API-012 validate client-supplied x-request-id

- `genReqId` now only honors `x-request-id` when it matches `/^[A-Za-z0-9._-]{1,64}$/`; anything else (over-long, malformed) falls back to `randomUUID()` as before. Headers are input too (G1) — an unbounded client-supplied value was stamped on every log line and echoed in every problem body.
- **Client-supplied ids are namespaced (`client-` prefix), never taken verbatim.** Shape validation alone was not enough: `randomUUID()` output itself satisfies the regex, so a caller could supply a *server-shaped* id — replaying one harvested from a response to interleave its log lines under another request's trace, or pinning one constant across all traffic to collapse `reqId` as a forensic key. The prefix keeps correlation working while making client-chosen ids self-evident in logs.
- Added an `onSend` hook that echoes `x-request-id` on ALL responses, not just RFC 7807 problem bodies, so clients can always correlate a success response with server logs (G3). Note this also makes ids trivially harvestable, which is why the namespacing above is required rather than optional.
- No client (iOS/Android/scripts) sends this header today, so both the regex and the prefix are free hardening — nothing to migrate.

## 2026-08-08 — [IDT-01, VLT-02] Real-Postgres integration tests for prisma-repo.ts (closes #22)

- New `tests/prisma-repo.test.ts` exercises `findUserByPhoneHash`, `createUser`, `getVault`, `upsertVault` against a REAL Postgres — no Prisma mocking (G2). Covers the optimistic-concurrency conflict path and both the sequential and truly-concurrent `baseVersion === 0` race-to-create paths.
- `vitest.config.ts`: dropped `src/prisma-repo.ts` from the coverage exclusion (now 100% lines) — `src/server.ts` and `src/repo.ts` stay excluded, out of scope here.
- **Decision (product owner, issue #22): no Testcontainers** — reuses the real-Postgres pattern already wired: CI's `postgres:17` `services:` container, local dev's `docker-compose.yml` `db` service. `agents/backend-systems-specialist.md` rule 7 updated to match; re-rendered `.github/instructions/backend.instructions.md`.
- `DATABASE_URL` resolution: the test file defaults it to the docker-compose value (`apps/api/.env.example`) via dynamic `import()` *before* `@repo/db` is loaded (its `PrismaClient` reads the env var at construction — static imports would hoist too early for a plain top-level assignment to win). CI's step-level `DATABASE_URL` is left untouched (`??=`). Unreachable Postgres fails once, up front, with one actionable message (redacted credentials) instead of a wall of per-test timeouts.
- Test hygiene: every row uses a `test-prisma-repo-`-prefixed, `crypto.randomUUID()`-suffixed phoneHash/displayName; `afterEach` deletes only the User ids the file itself created (Vault cascades via schema `onDelete: Cascade`) — safe to rerun against a dev's live local DB.
- Gotcha: requires `docker compose up -d db` + `pnpm --filter @repo/db db:deploy` once locally before `pnpm --filter @repo/api test` will pass — documented in the test file's header comment.

## 2026-08-08 — Removed exit-0 `openapi:emit`/`openapi:check` stubs (closes #23)

- Both scripts were `echo 'TODO...' && exit 0` placeholders — never generated a real spec, never actually gated anything. Decided not to build OpenAPI generation for now, so removed rather than leaving dead stubs in `apps/api/package.json`.
- No other code depended on these scripts; CI never called them (devops deliberately kept them out per SUG-OPS-018).
- Gotcha: `agents/backend-systems-specialist.md` rule 1 and `agents/devops-infrastructure-specialist.md` rule 4 still describe OpenAPI generation + `openapi:check` as a required gate — those references are now stale and should be revisited (out of scope for this change; not touched here) if/when OpenAPI work is picked back up.

## 2026-08-08 — [IDT-01, IDT-03, OQ-IDT-1] OTP devCode gate is now fail-closed (SUG-API-001)

- `/auth/otp/request`'s `devCode` echo was gated on `NODE_ENV !== "production"` — since `NODE_ENV` defaults to `"development"`, any deployment that forgot to set it served every OTP code to an unauthenticated caller with just a phoneHash (account takeover + vault read).
- New explicit opt-in `OTP_DEV_CODE` env var (`"enabled" | "disabled"`, default `"disabled"`) gates the echo instead; `env.ts` boot now refuses to start if `OTP_DEV_CODE=enabled` while `NODE_ENV=production` (fail-closed, G1).
- Local dev unaffected: `.env.example` and `docker-compose.yml`'s `api` service both set `OTP_DEV_CODE=enabled`; `scripts/e2e-{ios,android}.sh` drive against docker-compose so they keep getting `devCode` with no script changes needed.
- New tests: `env.test.ts` (boot fails with `OTP_DEV_CODE=enabled` + `NODE_ENV=production`; defaults to `disabled`), `auth.test.ts` (`devCode` absent when `OTP_DEV_CODE=disabled`).
- Gotcha: any other environment (staging, CI, future previews) must now explicitly set `OTP_DEV_CODE` if it wants the dev echo — no more implicit default via `NODE_ENV`.

## 2026-07-06 — [G3] Error handler hardened for fastify 5.9 `unknown` errors

- fastify 5.9 types `setErrorHandler`'s error as `unknown`; `src/app.ts` now narrows via `instanceof Error` before reading `statusCode`/`message`/`code` (non-Error throws → generic 500, nothing echoed). This was silently failing `tsc --noEmit` — surfaced by the new repo-wide lint.
- `/health` handler is plain sync (was `async` with no await).
- Added `lint: eslint .` (rules live in the root `eslint.config.mjs` — see root changelog).

## 2026-07-05 — [IDT-*, VLT-*] FS-07 core: auth, vault, health (commit e2914a0 + docker)

- Fastify service: `POST /auth/otp` request/verify (phone-OTP; in non-production the code is returned in the response — no SMS provider yet), JWT sessions (`src/lib/jwt.ts`).
- Versioned opaque vault storage (`src/routes/vault.ts`): server stores `{blob, version}` and never parses the contents — the privacy invariant lives here.
- `GET /health` (liveness, no deps) and `GET /ready` (DB connectivity), RFC 7807 problem responses, typed `env.ts` (fail-fast Zod validation).
- Repository seam (`repo.ts` / `prisma-repo.ts`) keeps Prisma behind an interface; `otp-store.ts` in-memory for dev.
- `Dockerfile` + compose service: pushes the Prisma schema on boot (`prisma db push` — dev-loop until real migrations land) and runs in watch mode on :3001.
- **Missing for FS-07 completion:** contact discovery endpoint (client-side-hashed numbers).
