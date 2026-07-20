# SUG-API-005 — Per-IP rate limiting breaks behind any proxy: `trustProxy` unset, and OTP routes lack a stricter per-IP tier

- **Area:** backend
- **Topic:** security
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** backend-specialist (.claude/agents/backend-specialist.md)
- **Related requirement IDs:** IDT-03

## Problem / Opportunity

IDT-03 requires OTP endpoints "throttled per phoneHash **and per IP**". The per-IP half is provided by `@fastify/rate-limit` keyed on `req.ip` (`apps/api/src/app.ts:44-53`), but the Fastify factory (`app.ts:23-40`) never sets `trustProxy`. Consequences the moment this runs behind any reverse proxy (compose is fine today, but the stated target is an ALB/AWS deployment):

- `req.ip` is the proxy's IP → **all users share one rate-limit bucket** (100/min, `app.ts:45`): one abusive client locks every user out of the whole API (self-inflicted DoS), and per-IP OTP throttling is meaningless.
- The naive fix (`trustProxy: true` unconditionally) is worse when the app is directly exposed: any client can spoof `X-Forwarded-For` and get a fresh bucket per request, fully bypassing the per-IP limit.

Additionally, the OTP endpoints only get the generous global 100/min-per-IP tier — the "strict per-phone-hash throttles" exist in `OtpStore` (`apps/api/src/otp-store.ts:14-15`), but a single IP can still spray OTP requests across 100 different phoneHashes per minute, growing server state (see SUG-API-008) and, once SMS delivery exists (OQ-IDT-1), burning real SMS spend ("SMS pumping" fraud).

## Implementation plan

1. In `/Users/mikedown/Workspace/Swab/apps/api/src/env.ts`, add a validated, fail-closed setting (string enum — do NOT use `z.coerce.boolean()`, which coerces `"false"` to `true`):
   ```ts
   // Number of trusted reverse-proxy hops in front of the API (0 = directly exposed).
   TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
   ```
2. In `/Users/mikedown/Workspace/Swab/apps/api/src/app.ts`, pass it to Fastify:
   ```ts
   const app = Fastify({
     trustProxy: deps.env.TRUST_PROXY_HOPS > 0 ? deps.env.TRUST_PROXY_HOPS : false,
     ...
   ```
   (A hop count only trusts that many `X-Forwarded-For` entries — spoof-resistant, unlike `true`.)
3. Add a stricter route-level per-IP tier on the two OTP routes in `/Users/mikedown/Workspace/Swab/apps/api/src/routes/auth.ts` (the global plugin at `app.ts:44` enables per-route config):
   ```ts
   const otpRateLimit = { rateLimit: { max: 10, timeWindow: "1 minute" } };
   app.post("/auth/otp/request", { config: otpRateLimit }, async (req, reply) => { ... });
   app.post("/auth/otp/verify",  { config: otpRateLimit }, async (req, reply) => { ... });
   ```
   Keep the RFC 7807 shape by reusing the same `errorResponseBuilder` (it is global plugin config, `app.ts:47-52`, and applies to route overrides).
4. Update `apps/api/.env.example` with `TRUST_PROXY_HOPS=0` and a comment ("set to 1 behind a single load balancer").
5. Changelog entry (G5) — call out the ops-facing knob explicitly.

## Tests & acceptance criteria

In `apps/api/tests/auth.test.ts` (run: `pnpm --filter @repo/api test`):
- `"IDT-03: OTP endpoints have a stricter per-IP limit — 11th request in a minute → 429 problem"` — build app, loop 10 injects to `/auth/otp/request` with DIFFERENT phoneHashes (stay under the per-hash throttle), assert the 11th is 429 with `content-type` `application/problem+json`.
- `"IDT-03: X-Forwarded-For is ignored when TRUST_PROXY_HOPS=0"` — with default env, inject requests carrying rotating `x-forwarded-for` headers; assert they still share one bucket (11th → 429).
- `"IDT-03: X-Forwarded-For is honored with TRUST_PROXY_HOPS=1"` — `makeApp({ env: { ...testEnv, TRUST_PROXY_HOPS: 1 } })`; two different `x-forwarded-for` values get independent buckets (10 + 10 requests, all 200).
- Existing `env.test.ts` gains a default-value assertion (`TRUST_PROXY_HOPS === 0`).

## Risks & gotchas

- `app.inject()` sets `remoteAddress` to `127.0.0.1` — all injected requests share an IP by default, which is exactly what the first two tests rely on; for the third, `trustProxy` makes Fastify derive `req.ip` from the header.
- The health endpoints share the global 100/min bucket per IP — with a hop count set, LB health checks come from distinct LB-node IPs and won't starve users; verify your probe frequency stays under the limit or exempt `/health` via route config `{ rateLimit: false }`.
- Don't lower the per-hash `OtpStore` throttle (3 per 5 min, `otp-store.ts:15`) — this suggestion adds a tier, it doesn't replace that one.
