# SUG-DB-011 — @repo/db exports no typed error helpers; apps/api conflates ANY create-error with "vault exists"

- **Area:** db
- **Topic:** dx
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** data-steward (.claude/agents/data-steward.md)
- **Related requirement IDs:** VLT-02

## Problem / Opportunity

`apps/api/src/prisma-repo.ts:36–51` implements the VLT-02 first-write path as:

```ts
try {
  const created = await prisma.vault.create({ ... });
  ...
} catch {
  // Unique violation: a vault already exists — report its version (VLT-02).
  const current = await prisma.vault.findUnique({ ... });
  return { ok: false, currentVersion: current?.version ?? 0 };
}
```

The bare `catch` treats **every** failure — connection refused, timeout, FK violation on a deleted user — as "a vault already exists", then the follow-up `findUnique` likely fails too or returns null, producing `{ ok: false, currentVersion: 0 }`. The route (`apps/api/src/routes/vault.ts:62–66`) turns that into **409 "Stale vault version" with `currentVersion: 0`**, instructing the client to "re-pull, merge locally, retry" — a client-visible lie for what is actually a 5xx. Worse: `currentVersion: 0` invites the client to retry with `version: 0`, which would loop.

The root cause is a packaging gap in `packages/db`: `src/index.ts:30` re-exports `@prisma/client` wholesale but offers no blessed way to discriminate errors, so the consumer (who is told to "never import @prisma/client directly", `packages/db/src/index.ts:29`) wrote the lazy catch. Fixing the helper is data-steward scope (`packages/db/**`, "generated-client packaging" per `agents/data-specialist.md:11`); adopting it in apps/api is a small backend follow-up.

## Implementation plan

1. In `packages/db/src/index.ts`, add and export narrow helpers:
   ```ts
   import { Prisma } from "@prisma/client";

   /** True iff err is a unique-constraint violation (Postgres 23505 / Prisma P2002). */
   export function isUniqueViolation(err: unknown): boolean {
     return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
   }
   /** True iff err is a foreign-key violation (P2003). */
   export function isForeignKeyViolation(err: unknown): boolean {
     return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003";
   }
   ```
2. Unit-test them in `packages/db/tests/` (SUG-DB-004 harness or pure unit with constructed `PrismaClientKnownRequestError`).
3. Changelog entry (packaging change, no schema/migration).
4. Open an `area:api` follow-up (issue or PR note) for backend-specialist: in `prisma-repo.ts:44`, change `catch {` to `catch (err) { if (!isUniqueViolation(err)) throw err; ...}` so non-unique failures propagate to Fastify's error handler as 500, keeping 409 exclusively for the true VLT-02 conflict. (That one-line consumer change is outside data-steward scope — do not edit apps/api in the db PR.)

## Tests & acceptance criteria

- `isUniqueViolation` returns true for a real P2002 raised by inserting a duplicate `Vault.userId` against Testcontainers Postgres; false for a connection error and for plain `Error`.
- After the api-side follow-up: an integration test where `prisma.vault.create` fails with a non-P2002 error yields HTTP 500, not 409 (`test_VLT02_conflict_only_on_unique_violation`).
- Turbo gate green.

## Risks & gotchas

- `Prisma.PrismaClientKnownRequestError` is exported from the generated client — the helper must live in `@repo/db` (which owns generation) so consumers never need the `Prisma` namespace import that the packaging comment forbids.
- Keep helpers total (accept `unknown`) — they're used in `catch` blocks.
- Don't be tempted to swap the create/catch pattern for `upsert`: VLT-02 semantics need create-only-if-absent at `baseVersion === 0`; upsert would overwrite an existing vault and violate optimistic concurrency.
