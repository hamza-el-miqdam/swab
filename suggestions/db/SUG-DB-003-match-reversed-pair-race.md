# SUG-DB-003 — `@@unique([envieAId, envieBId])` does not arbitrate the reversed pair (B,A)

- **Area:** db
- **Topic:** integrity
- **Impact:** high
- **Effort:** M
- **Implementing agent:** data-steward (.claude/agents/data-steward.md)
- **Related requirement IDs:** ENV-09

## Problem / Opportunity

ENV-09 (`docs/specs/FS-05-envie-match.md:32`) demands "exactly one match per envie pair, ever", arbitrated by the unique constraint. The schema comment claims this ("Reciprocity-race arbiter … guarantees a single match row", `packages/db/prisma/schema.prisma:118–120`), but the constraint is directional:

- `packages/db/prisma/schema.prisma:120` — `@@unique([envieAId, envieBId])`.

If user A's envie-creation transaction detects the reciprocal pair and inserts `(envieAId=E1, envieBId=E2)` while user B's concurrent transaction inserts `(envieAId=E2, envieBId=E1)`, **both inserts satisfy the unique constraint** and two match rows exist for one pair — double notifications, duplicate match surfaces, and a broken product invariant. The matching engine is not yet implemented in `apps/api` (only auth/vault/health routes exist under `apps/api/src/routes/`), so the constraint is currently untested by any consumer — the cheapest moment to fix it is now, before backend codes against it (data-specialist.md rule 5 calls this constraint "the contract Backend codes against").

## Implementation plan

1. Adopt a canonical-ordering invariant: **`envieAId < envieBId` (lexicographic)**, with `userAId`/`userBId` correspondingly the authors of `envieA`/`envieB`. Document it in the schema comment above the constraint (schema.prisma:118–120) — Backend must sort the pair before insert.
2. Enforce it at the database so the invariant cannot rot: Prisma cannot express CHECK constraints in the schema, so create a customized migration:
   - `pnpm --filter @repo/db exec prisma migrate dev --create-only --name match_pair_canonical_order`
   - Append to the generated `migration.sql`:
     ```sql
     ALTER TABLE "matches"
       ADD CONSTRAINT "matches_pair_canonical_order" CHECK ("envie_a_id" < "envie_b_id");
     ```
   - Apply with `prisma migrate dev`.
3. Add a `/// INVARIANT:` doc comment on the `Match` model explaining the ordering and that the CHECK lives in migration `match_pair_canonical_order` (Prisma schema won't show it).
4. Update `packages/db/prisma/seed.ts:126–137`: the seeded match uses `envieA` (created first) and `envieB` — verify the two cuids are actually ordered and instead assign `envieAId = min(idA,idB)`, `envieBId = max(...)`, swapping `userAId/userBId` to stay consistent. (cuid creation order does not guarantee lexicographic order.)
5. Open an `area:api` note (in the PR description) telling Backend: match insertion must canonicalize `[envieId1, envieId2].sort()` and map users accordingly; a reversed insert now fails loudly instead of silently duplicating.
6. Changelog entry in `packages/db/CHANGELOG.md` citing ENV-09.

## Tests & acceptance criteria

- Constraint test (Testcontainers Postgres, see SUG-DB-004): inserting a match with `envieAId > envieBId` raises a CHECK violation; inserting the same ordered pair twice raises a unique violation.
- Concurrency hammer test (data-specialist.md rule 5): two parallel transactions each try to insert the pair in opposite orders after canonicalization — exactly one row exists afterward, the loser gets P2002. Name the test with ENV-09 (e.g. `test_ENV09_reciprocal_race_single_match`).
- `prisma validate` green; seed runs green.

## Risks & gotchas

- CHECK constraints are invisible to the Prisma schema; `prisma migrate diff --from-migrations --to-schema-datamodel` may report them as drift depending on version — verify the drift-check command used in CI (SUG-DB-002 step 2) still exits 0, and if not, exclude the check or document the expected diff in the changelog.
- If any real match rows exist when this lands, pre-normalize them in the same migration (swap columns where `envie_a_id > envie_b_id`, deduplicate on conflict) — on current empty/seed-only databases this is a no-op.
- Do NOT solve this with a second unique index on `(envieBId, envieAId)` — it doubles index cost and still allows both orderings to coexist… it prevents nothing. Canonical order + CHECK is the correct arbiter.
