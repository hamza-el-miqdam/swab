# SUG-API-004 — Concurrent first sign-in races find-then-create: duplicate-user unique violation surfaces as a 500

- **Area:** backend
- **Topic:** correctness
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** backend-specialist (.claude/agents/backend-specialist.md)
- **Related requirement IDs:** IDT-01

## Problem / Opportunity

`POST /auth/otp/verify` does a non-atomic find-then-create (`apps/api/src/routes/auth.ts:72-80`):

```ts
let user = await repo.findUserByPhoneHash(phoneHash);
...
if (user === null) {
  ...
  user = await repo.createUser(phoneHash, displayName);
```

`prisma-repo.ts:18-23` `createUser` is a bare `prisma.user.create` with no unique-violation handling, while the schema has `phoneHash String @unique` (`packages/db/prisma/schema.prisma:16`). Two near-simultaneous verify requests for the same phoneHash — a double-tap, a client retry after a timeout, or two devices — both pass `findUserByPhoneHash → null`, then the second `create` throws P2002, which the app error handler turns into a **500 Internal Server Error** (`apps/api/src/app.ts:63-67`) for a scenario that is a perfectly normal "user already exists". Note the OTP `check()` does not consume the code (`apps/api/src/otp-store.ts:61-66`), so both requests legitimately hold a valid code at the same time.

Also, `tests/fake-repo.ts:30-35` silently overwrites on duplicate `createUser`, so the double cannot even express this race — its semantics diverge from `prisma-repo.ts` despite the "mirror exactly" claim at `fake-repo.ts:5-6`.

## Implementation plan

1. In `/Users/mikedown/Workspace/Swab/apps/api/src/prisma-repo.ts`, make `createUser` race-safe by catching P2002 and re-reading (mirrors the pattern from SUG-API-003; do that import once):
   ```ts
   async createUser(phoneHash, displayName) {
     try {
       return await prisma.user.create({
         data: { phoneHash, displayName },
         select: { id: true, phoneHash: true, displayName: true },
       });
     } catch (err) {
       if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") throw err;
       const existing = await prisma.user.findUnique({
         where: { phoneHash },
         select: { id: true, phoneHash: true, displayName: true },
       });
       if (existing === null) throw err;
       return existing; // loser of the race signs in as the existing user
     }
   }
   ```
2. Update the `Repository` doc comment in `apps/api/src/repo.ts:29-30` to state the contract: "createUser is race-safe: on concurrent creation of the same phoneHash it returns the existing user."
3. Mirror in `apps/api/tests/fake-repo.ts` `createUser`: `const existing = users.get(phoneHash); if (existing) return existing;` before inserting — keeps the double honest.
4. Minor: the route reports `isNewUser: true` for the race loser (`auth.ts:73-81`) even though the winner created the account milliseconds earlier — acceptable (both requests belong to the same person), note it in a comment.
5. Changelog entry (G5).

## Tests & acceptance criteria

- In `apps/api/tests/auth.test.ts` add `"IDT-01: two concurrent first sign-ins with the same phoneHash both succeed with one user"` — request one OTP, then `await Promise.all([inject(verify with displayName), inject(verify with displayName)])`; assert both are 200 (or one 200 + one 200), `repo.users.size === 1`, and both responses carry the same `userId`. (With the fake-repo fix from step 3 this exercises the return-existing path.)
- In the new `apps/api/tests/prisma-repo.test.ts` (created by SUG-API-003) add `"IDT-01: createUser returns the existing user on P2002"` with a stubbed client.
- Run: `pnpm --filter @repo/api test`. Acceptance: no path turns a duplicate-phoneHash creation into a 500.

## Risks & gotchas

- Do NOT switch to `prisma.user.upsert` blindly — Prisma upsert is only atomic when it can use native `INSERT ... ON CONFLICT` (depends on criteria/version); the try/catch pattern is unambiguous.
- Keep the `select` clauses so no extra columns (e.g. future ones) leak into the `UserRecord`.
- The race loser's `displayName` argument is discarded in favor of the winner's — fine (same human), but never log either (G3: log `userId` only, as `auth.ts:85` already does).
