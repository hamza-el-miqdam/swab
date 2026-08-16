# SUG-OPS-018 — `prisma validate` exists as a script but no CI gate runs it (and the OpenAPI gate is an echo stub)

- **Area:** devops
- **Topic:** ci
- **Impact:** low
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a (devops project rule 4: quality gates as required checks)

## Problem / Opportunity

Devops project rule 4 (`agents/devops-infrastructure-specialist.md`) lists the quality gates to wire as required checks, including "`prisma validate` + clean migration apply" and "`openapi:check`". Current state:

1. `packages/db/package.json` defines `"db:validate": "prisma validate"` — but `turbo.json:4-14` has no `db:validate` task and `.github/workflows/ci.yml:28` runs only `lint typecheck test build`. A syntactically-invalid or referentially-broken `schema.prisma` is caught in CI only *indirectly* (via `db:generate` failing as a dependency of typecheck/test, `turbo.json:12-13`) — which works, but produces a confusing downstream failure instead of a named, first-class gate, and won't cover validation rules `generate` doesn't enforce.
2. `apps/api/package.json:12-13`: `openapi:emit` and `openapi:check` are `echo 'TODO…' && exit 0` stubs — running `openapi:check` in CI today would be a gate that always passes. The stub's owner is backend (backend rule 1), not devops; the devops-side risk is wiring a placebo check.

## Implementation plan

1. Add a `db:validate` task to `turbo.json` tasks block:
   ```json
   "db:validate": { "cache": false }
   ```
   (`prisma validate` is fast; cache-false keeps it honest, mirroring `db:generate` at `turbo.json:5`.)
2. Add to `.github/workflows/ci.yml` after `pnpm install --frozen-lockfile` (`ci.yml:27`):
   ```yaml
   - name: Prisma schema valid
     run: pnpm --filter @repo/db db:validate
   ```
   (Direct filter call is fine too; the turbo task matters only if other pipelines will compose it.)
3. Do **not** add `openapi:check` to CI yet. Instead: file/refresh the `area:api` issue asking backend to implement `openapi:emit`/`openapi:check` for real (their package.json stub already names the plan: generate OpenAPI 3.1 from Zod route schemas via `@fastify/swagger`, diff against committed `apps/api/openapi.json`), and note in that issue that CI wiring is a one-line follow-up here once the stub is real. Wiring an always-green check would create false confidence.
4. "Clean migration apply on a fresh branch" (rest of rule 4) is blocked on migrations existing at all — none do yet (`docker-compose.yml:43-45`: "no migration files exist yet"). Note as deferred in the PR description, not implemented.
5. Root `CHANGELOG.md` entry.

## Tests & acceptance criteria

- CI green on untouched branch; the new step visibly runs `prisma validate`.
- Negative test: introduce a bogus field type in a *scratch-branch copy* of `schema.prisma` (note: schema edits are data-steward-only per G4 — for a throwaway CI-verification branch that is never merged, coordinate with the owner or have the data-steward run the negative test) → step fails with Prisma's named error, not a downstream typecheck cascade.
- `actionlint` clean.

## Risks & gotchas

- `prisma validate` needs `DATABASE_URL` present in env for some datasource configs — `packages/db/.env.example:2` shows the expected var; if validate complains in CI, pass a dummy `DATABASE_URL: postgresql://user:pass@localhost:5432/db` env on the step (validate does not connect).
- Keep the openapi stub OUT of CI until real — an `exit 0` gate is worse than no gate.
