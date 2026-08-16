# SUG-API-013 — Vault `version` accepts any JS integer but the column is Postgres int4: out-of-range values become 500s

- **Area:** backend
- **Topic:** correctness
- **Impact:** low
- **Effort:** S
- **Implementing agent:** backend-specialist (.claude/agents/backend-specialist.md)
- **Related requirement IDs:** VLT-02

## Problem / Opportunity

`apps/api/src/routes/vault.ts:17-20`:

```ts
const vaultWriteSchema = z.object({
  blob: z.string().min(1).regex(BASE64_RE, "must be valid base64"),
  version: z.number().int().min(0), // no upper bound
});
```

`version` has no maximum, but the Prisma model maps it to `Int` (`packages/db/prisma/schema.prisma:38`), i.e. Postgres `int4` with max 2,147,483,647. A client sending `version: 3000000000` (malicious or a corrupted client state) passes Zod, reaches `repo.upsertVault`, and the Prisma `updateMany` at `apps/api/src/prisma-repo.ts:54-57` fails with a driver/Prisma range error → unhandled → generic 500 from the app error handler (`apps/api/src/app.ts:63-67`) instead of a clean 4xx. G1 says validate to the actual storage contract at the boundary. (The in-memory fake used by tests never hits this because JS numbers don't overflow at int4 — another fake-vs-Prisma semantic gap.)

Same class of nit, worth fixing in the same pass: `version: baseVersion + 1` (`prisma-repo.ts:57`) could itself overflow at the theoretical cap — bounding the input to `2_147_483_646` covers the +1.

## Implementation plan

1. In `/Users/mikedown/Workspace/Swab/apps/api/src/routes/vault.ts`, bound the field:
   ```ts
   const MAX_PG_INT = 2_147_483_647;
   ...
   version: z.number().int().min(0).max(MAX_PG_INT - 1), // int4 column; +1 on success must also fit
   ```
   The existing 400 path (`vault.ts:51-54`) then handles it with the standard problem body — no other code changes.
2. Changelog entry (G5).

## Tests & acceptance criteria

In `apps/api/tests/vault.test.ts` add:
- `"VLT-02/G1: a version beyond the int4 range is rejected 400, not 500"` — signup, POST `/vault` with `{ blob: <valid base64>, version: 2_147_483_647 }` and with `version: 2 ** 40`; assert 400 + `application/problem+json`; also assert `version: 2_147_483_646` still passes schema (may then 409 against the fake repo — assert it is NOT 400/500).

Run: `pnpm --filter @repo/api test`.

## Risks & gotchas

- Real clients are nowhere near the bound (versions increment by 1 per sync) — this is purely a hostile-input hardening; no compatibility risk.
- If the Data Steward ever widens the column to `BigInt`, this constant must follow — the comment ties it to the schema line so the coupling is discoverable.
- Do not "fix" this by catching the Prisma error instead — rejecting at the boundary is the G1-correct layer.
