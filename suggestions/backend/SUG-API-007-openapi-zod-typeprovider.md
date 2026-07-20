# SUG-API-007 — OpenAPI pipeline is a stub: no Zod type provider, no response schemas, no generated spec, no api-client

- **Area:** backend
- **Topic:** architecture
- **Impact:** medium
- **Effort:** L
- **Implementing agent:** backend-specialist (.claude/agents/backend-specialist.md)
- **Related requirement IDs:** IDT-01, VLT-02 (contract endpoints); prerequisite for the FS-05 API seam

## Problem / Opportunity

Backend rule 1 says "Swagger is always current — mechanically, not by discipline": OpenAPI 3.1 generated from Zod route schemas, served at `/docs` in non-prod, emitted to `apps/api/openapi.json`, with a CI diff gate and a regenerated `packages/api-client`. Reality:

- `apps/api/package.json:12-13` — `openapi:emit` / `openapi:check` are `echo 'TODO...' && exit 0` stubs.
- Routes hand-roll validation with `safeParse` inside handlers (`apps/api/src/routes/auth.ts:38,62`, `apps/api/src/routes/vault.ts:51`) instead of declaring Fastify `schema` — so there is nothing to generate a spec from.
- **No response schemas anywhere**: responses are ad-hoc `reply.send(...)` objects (`auth.ts:54-58,86-91`, `vault.ts:40-44,69`). Without a response serializer schema, any future field added to a repo record or handler object ships to clients silently — the exact failure mode the privacy invariant cannot afford (e.g. `UserRecord.phoneHash` is in scope at `auth.ts:85-91` today; one careless spread would leak it). Response schemas are an allowlist that makes that class of leak structurally impossible.
- `packages/api-client` does not exist (`docs/STATUS.md` infra table confirms), and FS-05 declares "OpenAPI is normative once generated" for the mobile↔backend seam — the seam has no source of truth yet.

## Implementation plan

1. Add deps to `/Users/mikedown/Workspace/Swab/apps/api/package.json` (justify in PR per G4): `fastify-type-provider-zod`, `@fastify/swagger`; `@fastify/swagger-ui` optional for `/docs`.
2. In `/Users/mikedown/Workspace/Swab/apps/api/src/app.ts`, wire the provider before route registration:
   ```ts
   import { serializerCompiler, validatorCompiler, jsonSchemaTransform } from "fastify-type-provider-zod";
   app.setValidatorCompiler(validatorCompiler);
   app.setSerializerCompiler(serializerCompiler);
   await app.register(swagger, { openapi: { openapi: "3.1.0", info: { title: "Swab API", version: "0.1.0" } }, transform: jsonSchemaTransform });
   if (deps.env.NODE_ENV !== "production") await app.register(swaggerUi, { routePrefix: "/docs" });
   ```
3. Convert routes to declared schemas, moving the existing Zod objects (`phoneHashSchema`, `otpRequestSchema`, `otpVerifySchema` in `auth.ts:14-26`; `vaultWriteSchema` in `vault.ts:17-20`) into `schema: { body, response: { 200: ..., ... } }` on each route. Define explicit response schemas: OTP request (`sent`, `expiresInSeconds`, optional `devCode`), verify (`userId`, `isNewUser`, `accessToken`, `refreshToken`), vault GET (`blob`, `version`, `updatedAt`), vault POST (`version`), plus a shared `problemSchema` for error codes.
4. Preserve the RFC 7807 contract: schema-validation failures now throw instead of hitting the in-handler `sendProblem` — extend `app.setErrorHandler` (`app.ts:59-68`) with `hasZodFastifySchemaValidationErrors(err)` → 400 problem whose detail is built from the issues (reuse the path+message format of `zodDetail`, `apps/api/src/lib/problem.ts:30-34`; never echo input values). Keep semantic checks (413 quota `vault.ts:57-59`, 422 displayName `auth.ts:75-78`, 409 stale version) in handlers.
5. Implement the scripts: `openapi:emit` = small `scripts/emit-openapi.ts` (tsx) that builds the app with a fake repo/env, awaits `app.ready()`, writes `JSON.stringify(app.swagger(), null, 2)` to `apps/api/openapi.json`; `openapi:check` = emit to a temp file and `diff` against the committed one (exit 1 on drift). Flag to devops (`area:sre` issue) to add `openapi:check` to CI — workflows are outside backend scope.
6. Scaffold `packages/api-client` generated from `openapi.json` (backend scope per agent file) — can be a follow-up PR to respect the 400-line limit; if so, say so in the PR and file the issue.
7. Changelog entry; update `docs/STATUS.md` CI row note only if the diff gate lands (that row already lists "OpenAPI diff gate" as missing).

## Tests & acceptance criteria

- All existing route tests must stay green unchanged (`pnpm --filter @repo/api test`) — same status codes, same problem shapes: this is the primary regression bar.
- New `apps/api/tests/openapi.test.ts`:
  - `"backend-rule-1: generated spec contains all routes"` — build app, `app.swagger()`, assert paths `/auth/otp/request`, `/auth/otp/verify`, `/vault` (get+post), `/health`, `/ready` exist.
  - `"G1: response serialization is an allowlist — extra fields are stripped"` — register a probe route in-test with the verify response schema, return an object with an extra `phoneHash` field, assert it is absent from the payload.
- `pnpm --filter @repo/api openapi:emit` produces a stable `openapi.json`; running `openapi:check` right after passes; editing a schema then `openapi:check` fails.

## Risks & gotchas

- Split into ≥2 PRs (G4 ≤400 lines): (1) type provider + route conversion, (2) emit/check + spec commit, (3) api-client.
- `fastify-type-provider-zod` version must match Zod major (`zod ^3.25`, `package.json:20`) — pin accordingly.
- Serializer strictness: `z.object` strips unknown keys by default under the serializer compiler — that's the desired allowlist; do NOT use `.passthrough()` anywhere.
- The vault `blob` response is base64 text up to ~1.4 MB — make sure the serializer handles it without pathological cost (it's a plain string field; fine).
- Keep `bodyLimit` and rate-limit config untouched; `/docs` must not be exposed in production (gate on `NODE_ENV`, step 2).
