# SUG-API-003 — upsertVault's bare `catch` masks every DB failure as a 409 version conflict

- **Area:** backend
- **Topic:** correctness
- **Impact:** high
- **Effort:** S
- **Implementing agent:** backend-specialist (.claude/agents/backend-specialist.md)
- **Related requirement IDs:** VLT-02

## Problem / Opportunity

`apps/api/src/prisma-repo.ts:36-51` — the first-write path (`baseVersion === 0`) does:

```ts
try {
  const created = await prisma.vault.create({ ... });
  return { ok: true, version: created.version };
} catch {
  // Unique violation: a vault already exists — report its version (VLT-02).
  const current = await prisma.vault.findUnique({ ... });
  return { ok: false, currentVersion: current?.version ?? 0 };
}
```

The `catch` is unqualified: a dropped connection, pool timeout, or any other Prisma error is swallowed and reported to the client as `{ ok: false }` → the route returns **409 "Stale vault version" with `currentVersion: 0`** (`apps/api/src/routes/vault.ts:62-66`, since the follow-up `findUnique` likely also fails or finds nothing). Per the VLT-02 protocol the client then re-pulls, merges, and retries with base version 0 — an **infinite 409 loop on a transient infrastructure error**, with the real cause never logged (no `req.log.error`, no 500). This directly undermines the FS-07 acceptance criterion "no 409 loop occurs."

Secondary issue, same file: `current?.version ?? 0` (lines 50, 63) reports `currentVersion: 0` when the vault row is missing, which tells the client "your base 0 write conflicted with version 0" — self-contradictory.

## Implementation plan

1. In `/Users/mikedown/Workspace/Swab/apps/api/src/prisma-repo.ts`, import the Prisma error class: `import { Prisma, prisma } from "@repo/db";` (the `Prisma` namespace is re-exported by `packages/db/src/index.ts:30` via `export * from "@prisma/client"`).
2. Narrow the catch to the unique-violation code and rethrow everything else:
   ```ts
   } catch (err) {
     if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
       throw err; // real failure → 500 via the app error handler, which logs it (app.ts:64-66)
     }
     const current = await prisma.vault.findUnique({ where: { userId }, select: { version: true } });
     if (current === null) throw err; // row vanished between violation and read — surface it
     return { ok: false, currentVersion: current.version };
   }
   ```
3. Apply the same `current === null → throw` treatment to the CAS branch's fallback at `prisma-repo.ts:59-63`: `updateMany` matched 0 rows AND `findUnique` returns null means the vault does not exist while the client claims `baseVersion > 0` — that is a client protocol error, better surfaced as `{ ok: false, currentVersion: 0 }` **only if intentional**; keep it but add a comment, or (preferred) return a distinct result so the route can send 404/409 with an honest detail. Minimal change: keep `currentVersion: 0` there (it is semantically "you have no vault; write with version 0"), and document it in the route comment at `vault.ts:62-64`.
4. Rethrown errors flow through `app.ts:59-68`, which already logs `err.message`/`code` at error level and returns a generic 500 problem — no log/privacy change needed (blob contents never appear in Prisma unique-violation messages for this query shape; the error fields logged are `message` and `code` only, `app.ts:65`).
5. Changelog entry (G5).

## Tests & acceptance criteria

Because `prisma-repo.ts` is currently excluded from coverage and untested (`apps/api/vitest.config.ts:13`), add a unit test that doesn't need Postgres by injecting a failing client — simplest: refactor `prismaRepository()` to accept the client as a parameter defaulting to the singleton (`export function prismaRepository(client: PrismaClient = prisma)`), then in new `apps/api/tests/prisma-repo.test.ts`:
- `"VLT-02: upsertVault rethrows non-unique-violation errors instead of reporting a 409 conflict"` — stub `client.vault.create` to reject with `new Error("connection refused")`, assert the promise rejects (not `{ ok: false }`).
- `"VLT-02: upsertVault maps P2002 on first write to a version conflict"` — stub `create` to reject with a constructed `Prisma.PrismaClientKnownRequestError` (`code: "P2002"`) and `findUnique` to resolve `{ version: 3 }`; assert `{ ok: false, currentVersion: 3 }`.

These stubs are unit tests of error-mapping logic, not the forbidden "Prisma mocks in integration tests" (backend rule 7) — the real-Postgres CAS behavior is covered by SUG-API-006. Run: `pnpm --filter @repo/api test`.

## Risks & gotchas

- Constructing `PrismaClientKnownRequestError` in tests requires its constructor signature `(message, { code, clientVersion })` — check the installed Prisma version's signature.
- Keep `vitest.config.ts` exclusion for `prisma-repo.ts` OR remove it once the new unit test covers it — removing it is better (raises honest coverage).
- Preserve the CAS semantics exactly: `updateMany` + count check (`prisma-repo.ts:54-58`) is the race arbiter — don't "simplify" it into read-then-write.
