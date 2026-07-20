# SUG-OPS-011 — AWS-portability lint (Vercel APIs / Neon SQL) is a stated hard requirement but has no CI check

- **Area:** devops
- **Topic:** portability
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a (G4: "No Vercel-proprietary APIs … no Neon-specific SQL — AWS portability is a hard requirement"; devops project rule 3)

## Problem / Opportunity

G4 (`agents/_global-directives.md`) makes AWS portability a *hard* requirement: no `@vercel/kv` / `@vercel/blob` / `@vercel/edge-config`, no Neon-specific SQL. The devops rules commit to enforcement: "portability lint greps diffs for `@vercel/kv`, `@vercel/blob`, `@vercel/edge-config`, and Neon-specific SQL and fails the check-run" (`agents/devops-infrastructure-specialist.md`, Project Rules #3). No such check exists — `.github/workflows/` has only `ci.yml`, which runs lint/typecheck/test/build and the render check (`ci.yml:25-28`). `docker-compose.yml:4-5` even documents that vanilla `postgres:17` is the daily portability proof — but nothing stops a dependency or SQL string from sneaking in via PR.

## Implementation plan

1. Create `scripts/portability-lint.mjs` (Node, no deps): scan tracked files (`git ls-files` output, filtered to `apps/`, `packages/`, `tools/`, excluding `*.md` and `docs/`) for forbidden patterns:
   - Package names in any `package.json` deps or import/require in source: `@vercel/kv`, `@vercel/blob`, `@vercel/edge-config`.
   - Neon-specific strings in source/SQL/prisma files: `neon.tech`, `@neondatabase/serverless` (allowed nowhere in app code; if the driver is ever adopted deliberately, add an explicit allowlist entry with justification), `pg_embedding`.
   - Print each violation as `file:line: pattern` and exit 1.
   Scanning the full tree (not just the diff) is simpler and stricter than diff-grepping — nothing can hide from a full scan, and the repo is clean today so it starts green.
2. Add a step to `.github/workflows/ci.yml` next to the other pre-install checks (`ci.yml:25-26`):
   ```yaml
   - name: Portability lint (no Vercel APIs, no Neon-specific code — G4)
     run: node scripts/portability-lint.mjs
   ```
3. Keep the pattern list at the top of the script as a single const with comments, so adding patterns (e.g. Vercel KV REST URLs `kv.vercel-storage.com`) is a one-line diff.
4. Root `CHANGELOG.md` entry announcing the new blocking check.

## Tests & acceptance criteria

- Script exits 0 on the current tree (`node scripts/portability-lint.mjs` locally).
- Negative test: add `"@vercel/kv": "^1.0.0"` to `apps/api/package.json` on a scratch branch → step fails naming the file/line; revert.
- Table-driven unit test for the matcher function (pure string → matches), consistent with G2 style.

## Risks & gotchas

- False positives: agent rule files and docs mention these package names as prohibitions (e.g. `.github/instructions/devops.instructions.md:34`) — hence the exclusion of `*.md`, `docs/`, `agents/`, `.github/` from the scan set; scan only runtime code paths.
- Neon *connection strings* live in env vars, not code — do not try to lint `DATABASE_URL` values; G1 already keeps them out of the repo.
- Keep the script dependency-free so it runs before `pnpm install` (fast fail, same slot as `render-agents.mjs --check` at `ci.yml:26`).
