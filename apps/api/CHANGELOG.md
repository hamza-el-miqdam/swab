# Changelog — apps/api (area:backend)

> Newest first. One entry per merged change.
> Format: `## YYYY-MM-DD — [REQ-IDs] title` then bullets: what changed, why, anything a future dev must know.
> Agents: updating this file is part of your Definition of Done (G5). Keep entries ≤ ~15 lines.

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
