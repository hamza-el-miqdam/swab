# SUG-API-001 — OTP devCode is fail-open: a misconfigured NODE_ENV leaks login codes to any caller

- **Area:** backend
- **Topic:** security
- **Impact:** high
- **Effort:** S
- **Implementing agent:** backend-specialist (.claude/agents/backend-specialist.md)
- **Related requirement IDs:** IDT-01, IDT-03, OQ-IDT-1

## Problem / Opportunity

`POST /auth/otp/request` returns the OTP code in the response body whenever `NODE_ENV !== "production"`:

- `apps/api/src/routes/auth.ts:54-58` — `...(env.NODE_ENV !== "production" ? { devCode: result.code } : {})`
- `apps/api/src/env.ts:7` — `NODE_ENV: z.enum(["development", "test", "production"]).default("development")`

Because `NODE_ENV` **defaults to `development`**, any deployment that forgets to set `NODE_ENV=production` (new hosting env, staging exposed to the internet, a container missing one env var) serves every user's OTP code to **anyone who knows (or guesses) a phoneHash** — full account takeover with a single unauthenticated request, plus read access to their vault blob. This is a fail-open design for the single most sensitive dev shortcut in the codebase. G1 says "never trust the client — including our own apps"; the same zero-trust posture should apply to our own deployment configuration.

There is also no test asserting that `devCode` is absent in production mode.

## Implementation plan

1. In `/Users/mikedown/Workspace/Swab/apps/api/src/env.ts`, add an explicit opt-in flag and a boot-time guard to the schema:
   ```ts
   const envSchema = z
     .object({
       DATABASE_URL: z.string().min(1),
       JWT_SECRET: z.string().min(32),
       PORT: z.coerce.number().int().positive().default(3001),
       NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
       // POC (OQ-IDT-1): echo the OTP code in the response. Fail-closed: off unless explicitly enabled.
       OTP_DEV_CODE: z.enum(["enabled", "disabled"]).default("disabled"),
     })
     .refine((e) => !(e.NODE_ENV === "production" && e.OTP_DEV_CODE === "enabled"), {
       path: ["OTP_DEV_CODE"],
       message: "must not be enabled in production",
     });
   ```
   Note: `loadEnv`'s offender-name reporting (env.ts:19) already handles `refine` issues via `issue.path`.
2. In `/Users/mikedown/Workspace/Swab/apps/api/src/routes/auth.ts:57`, replace the `NODE_ENV` check:
   ```ts
   ...(env.OTP_DEV_CODE === "enabled" ? { devCode: result.code } : {}),
   ```
3. In `/Users/mikedown/Workspace/Swab/apps/api/tests/helpers.ts:6-11`, add `OTP_DEV_CODE: "enabled"` to `testEnv` so existing tests (which read `devCode`) keep working.
4. Update `/Users/mikedown/Workspace/Swab/apps/api/.env.example` with `OTP_DEV_CODE=enabled` and a comment that it must never be enabled in production (boot refuses it).
5. Update `docker-compose.yml` (repo root) if it relies on the implicit dev behavior — set `OTP_DEV_CODE=enabled` for the local API service.
6. Append an `apps/api/CHANGELOG.md` entry (G5) noting the new env var — this is a behavioral contract change for local tooling (E2E scripts that read `devCode` must set the flag).

## Tests & acceptance criteria

In `apps/api/tests/auth.test.ts` add:
- `"IDT-03/G1: devCode is absent unless OTP_DEV_CODE is explicitly enabled"` — build the app with `makeApp({ env: { ...testEnv, OTP_DEV_CODE: "disabled" } })`, POST `/auth/otp/request`, assert 200 and `body.devCode === undefined`.

In `apps/api/tests/env.test.ts` add:
- `"G1: OTP_DEV_CODE=enabled in production fails boot"` — `loadEnv({ DATABASE_URL: ..., JWT_SECRET: "a".repeat(32), NODE_ENV: "production", OTP_DEV_CODE: "enabled" })` throws matching `/OTP_DEV_CODE/`.
- `"G1: OTP_DEV_CODE defaults to disabled"` — default parse yields `"disabled"`.

Run: `pnpm --filter @repo/api test`. Acceptance: all existing tests still green; a deployment with no `OTP_DEV_CODE` set never emits `devCode` regardless of `NODE_ENV`.

## Risks & gotchas

- `scripts/e2e-ios.sh` / `scripts/e2e-android.sh` and the mobile E2E suites drive signup via `devCode` against the live local API — they need `OTP_DEV_CODE=enabled` in the API's environment or they will break. Grep those scripts and docker-compose before merging.
- Keep the response shape otherwise identical (`sent`, `expiresInSeconds`) so clients don't drift.
- Do not log the code anywhere while making this change (G3; `auth.ts:44-50` currently logs events only — preserve that).
