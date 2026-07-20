# Changelog — apps/api (area:backend)

> Newest first. One entry per merged change.
> Format: `## YYYY-MM-DD — [REQ-IDs] title` then bullets: what changed, why, anything a future dev must know.
> Agents: updating this file is part of your Definition of Done (G5). Keep entries ≤ ~15 lines.

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
