# SUG-DB-005 — `Envie.verb` is NOT NULL, blocking the 30-day retention null-out

- **Area:** db
- **Topic:** privacy
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** data-steward (.claude/agents/data-steward.md)
- **Related requirement IDs:** ENV-07, ENV-12 (Data Steward project rule 3)

## Problem / Opportunity

`agents/data-specialist.md:37` (project rule 3) encodes the retention default: "expired envies are status-flipped (auditable), but their `verb` content is nulled by the retention sweep after 30 days — design columns nullable accordingly."

The schema does not comply:

- `packages/db/prisma/schema.prisma:76` — `verb String` (required). A retention sweep cannot set it to NULL; the only alternatives are overwriting with a sentinel string (dirty, ambiguous with real content) or deleting the row (contradicts the "status-flipped, auditable" design at schema.prisma:146–152 / EnvieStatus).

`verb` is user content ("never logged, never full-text-indexed", schema.prisma:76 comment) — keeping it required means expired desires are stored in plaintext forever, which contradicts the product's privacy posture even though it's not classification data.

## Implementation plan

1. In `packages/db/prisma/schema.prisma:76`, change `verb String` → `verb String?` and extend the comment: `// nulled by the 30-day retention sweep after expiry (data-steward rule 3)`.
2. Migration: `prisma migrate dev --name envie_verb_nullable` (a `DROP NOT NULL` — non-destructive, instant, no table rewrite).
3. Regenerate the client (`pnpm --filter @repo/db db:generate`). Grep consumers for `verb` usage — currently none outside `packages/db/prisma/seed.ts:100,117,153` (apps/api has no envie routes yet), so no type breakage; note in the PR that future Backend code must treat `verb: string | null` and never render null verbs to clients.
4. Optionally (same PR, still schema-only): add a comment on `EnvieStatus` documenting that `EXPIRED + verb IS NULL` is the post-retention terminal state.
5. The sweep itself (daily cron per `swab-domain-spec.md:160` "expiry sweep = daily Actions cron") is `area:sre`/`area:api` work — reference this schema change in an issue so the sweep can be implemented as `UPDATE envies SET verb = NULL WHERE status = 'EXPIRED' AND expires_at < now() - interval '30 days';`.
6. Changelog entry with privacy-audit note.

## Tests & acceptance criteria

- Constraint test (SUG-DB-004 harness): an `Envie` row updates to `verb = NULL` without error while `category`, `status`, timestamps remain intact.
- Type-level: `pnpm turbo run typecheck` green after regeneration (proves no consumer relied on non-null verb).
- Seed still green (seed always provides verbs; no change needed).

## Risks & gotchas

- Do NOT also make `category` nullable — it is the matching key (schema.prisma:77, ENV-08) and is a normalized label, not free content; nulling it would break "existing matches survive" queries (ENV-12) that may join back to envies.
- Widening (required → optional) is expand-phase safe (data-specialist.md:21) — no data migration, no deploy-order hazard.
- Keep the decision recorded: verb nullability is retention design, not an invitation for Backend to accept envies without verbs — API-side Zod must still require a non-empty verb on creation (ENV-01).
