# SUG-API-002 — Refresh tokens are issued but unusable: no /auth/refresh endpoint, no rotation, no reuse detection (IDT-02)

- **Area:** backend
- **Topic:** security
- **Impact:** high
- **Effort:** L
- **Implementing agent:** backend-specialist (.claude/agents/backend-specialist.md) — **plus data-steward**: requires a schema change, so backend opens an `area:db` proposal first
- **Related requirement IDs:** IDT-02, IDT-05

## Problem / Opportunity

FS-07 IDT-02 requires "short-lived JWT access token + rotating refresh token per device. Refresh reuse detection revokes the family." Today:

- `apps/api/src/routes/auth.ts:9-10` — access TTL 15 min, refresh TTL 30 days; both minted at `auth.ts:89-90`.
- No `/auth/refresh` route exists anywhere: `apps/api/src/app.ts:71-73` registers only health, auth (request/verify), and vault routes; `apps/api/src/routes/auth.ts` defines only `/auth/otp/request` and `/auth/otp/verify`.
- `apps/api/src/lib/jwt.ts:3-4` documents this: "refresh rotation/reuse-detection lands with the Device model wiring" — it hasn't.

Consequences: (a) clients hard-fail 15 minutes after sign-in and can only recover by requesting a new SMS OTP (bad UX, real SMS cost once OQ-IDT-1 is resolved); (b) the 30-day refresh token is dead weight that, if stolen, cannot be revoked (stateless HS256, no server-side state, no reuse detection) — worst of both worlds.

## Implementation plan

1. **area:db proposal first** (backend opens the issue; data-steward implements): add a `RefreshToken` model to `packages/db/prisma/schema.prisma`, e.g.
   ```prisma
   model RefreshToken {
     id        String    @id @default(cuid())   // jti embedded in the JWT
     userId    String    @map("user_id")
     user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
     familyId  String    @map("family_id")      // one family per sign-in/device
     expiresAt DateTime  @map("expires_at")
     usedAt    DateTime? @map("used_at")        // set on rotation; reuse of a used token ⇒ revoke family
     revokedAt DateTime? @map("revoked_at")
     createdAt DateTime  @default(now()) @map("created_at")
     @@index([familyId])
     @@index([userId])
     @@map("refresh_tokens")
   }
   ```
   Query patterns to cite in the proposal: lookup by `id` (PK) on refresh; `updateMany` by `familyId` on reuse detection; sweep by `expiresAt`.
2. Extend `apps/api/src/lib/jwt.ts`: add optional `jti` and `fam` claims to `JwtPayload` and `signJwt` (keep `sub`/`type`/`iat`/`exp` unchanged so access tokens are unaffected); extend `isJwtPayload` accordingly.
3. Extend the `Repository` interface (`apps/api/src/repo.ts`) with `createRefreshToken`, `rotateRefreshToken` (single `prisma.$transaction`: mark old `usedAt`, insert new row), `revokeFamily`, and mirror them in `apps/api/src/prisma-repo.ts` and `apps/api/tests/fake-repo.ts`.
4. In `/auth/otp/verify` (`auth.ts:86-91`): on success, persist the refresh token row (new `familyId`) and embed `jti`/`fam` in the refresh JWT.
5. Add `POST /auth/refresh` in `registerAuthRoutes`: Zod body `{ refreshToken: z.string().min(20).max(2048) }`; verify signature/exp/type === "refresh"; load row by `jti`.
   - Row missing or `revokedAt` set → 401.
   - `usedAt` already set → **reuse detected**: `revokeFamily(fam)` then 401 (log `{ userId, familyId }` only — never the token, G3).
   - Else rotate in one transaction and return a fresh access + refresh pair (same response shape as verify, minus `isNewUser`).
6. Rate-limit the route with the global limiter (already applies, `app.ts:44`); add route-level `config: { rateLimit: { max: 30, timeWindow: "1 minute" } }`.
7. Changelog entry (contract change: new endpoint) + `docs/STATUS.md` FS-07 note update.

## Tests & acceptance criteria

New `apps/api/tests/refresh.test.ts` (run: `pnpm --filter @repo/api test`):
- `"IDT-02: refresh rotates — old refresh token is single-use, new pair is valid"` — signup, POST `/auth/refresh` with the refresh token → 200 + new pair; new access token opens `GET /vault` (or another authed route); replaying the OLD refresh token → 401.
- `"IDT-02: reuse revokes the family"` — after the replay above, the NEW refresh token is also 401 (family revoked).
- `"IDT-02: access tokens are rejected by /auth/refresh"` → 401.
- `"IDT-02: expired refresh token → 401"` — sign with negative TTL via `signJwt`.
- Existing vault/auth tests stay green (verify response gains no breaking change).

## Risks & gotchas

- **Do not merge the API change before the schema lands** — the `area:db` issue gates this; fake-repo lets route tests run meanwhile.
- Mobile clients currently store the refresh token but never use it — coordinate the client-side refresh loop as a follow-up ios/android issue; the endpoint is backward-compatible.
- Reuse detection must be transactional (`usedAt` check-and-set), otherwise two concurrent refreshes with the same token both succeed — use `updateMany({ where: { id, usedAt: null } })` count as the arbiter, same CAS pattern as `prisma-repo.ts:54-58`.
- Never log token strings or phoneHashes on any path (G3).
