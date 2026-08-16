# SUG-OPS-008 — Dockerfile ignores the committed lockfile (stale comment) and base image is unpinned

- **Area:** devops
- **Topic:** docker
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a (G1; devops best practice "pnpm install --frozen-lockfile always")

## Problem / Opportunity

Two reproducibility holes in `apps/api/Dockerfile`:

1. **Lockfile not used.** `Dockerfile:25-27`:
   ```
   # No --frozen-lockfile: the repo may not have a committed lockfile yet.
   # Once pnpm-lock.yaml is committed, add it to the COPY above and freeze.
   RUN pnpm install --filter @repo/db --filter @repo/api
   ```
   That comment is stale — `pnpm-lock.yaml` IS committed at repo root (present in the root listing; CI already relies on it via `pnpm install --frozen-lockfile`, `.github/workflows/ci.yml:27`). Every `docker compose up --build` therefore re-resolves semver ranges (`fastify: ^5.4.0`, `zod: ^3.25.0`, `@prisma/client: ^6.10.0` in `apps/api/package.json` / `packages/db/package.json`) and can produce a container running different dependency versions than CI tested — the exact drift `--frozen-lockfile always` (devops Domain Best Practices) exists to prevent.

2. **Base image unpinned.** `Dockerfile:8` `FROM node:22-slim` floats: every Node 22.x patch and every Debian rebuild silently changes the image. Devops hard constraint 2 requires "pinned digest".

## Implementation plan

1. Edit `apps/api/Dockerfile:21` COPY line to include the lockfile:
   ```dockerfile
   COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
   ```
2. Replace lines 25-27 with:
   ```dockerfile
   RUN pnpm install --frozen-lockfile --filter @repo/db --filter @repo/api
   ```
   (Delete the two stale comment lines.)
3. Pin the base image: `docker pull node:22-slim && docker inspect node:22-slim --format '{{index .RepoDigests 0}}'`, then:
   ```dockerfile
   FROM node:22-slim@sha256:<digest-resolved-at-implementation-time>
   ```
   Keep the tag in the reference (`node:22-slim@sha256:...`) so humans and Dependabot's docker ecosystem (SUG-OPS-004) can read and bump it.
4. Also copy the root `pnpm.overrides` implications: the root `package.json` (already COPYed at line 21) carries `overrides` (`package.json:26-30`), so frozen install resolves consistently — no extra step needed, just verify.
5. Root `CHANGELOG.md` entry.

## Tests & acceptance criteria

- `docker compose build api` succeeds; deliberately corrupt one version in `pnpm-lock.yaml` on a scratch copy → build fails with a frozen-lockfile mismatch (proves the flag bites), revert.
- `docker compose up --build` boots and `curl -f localhost:3001/health` passes.
- `grep -c "sha256" apps/api/Dockerfile` ≥ 1.

## Risks & gotchas

- `--frozen-lockfile` with `--filter` requires the lockfile to match the *whole* workspace manifest set; the Dockerfile only COPYs `packages/db` and `apps/api` manifests (`Dockerfile:22-23`). pnpm v10 validates lockfile projects against present manifests — if it errors about missing workspace packages (e.g. `packages/ui`), COPY the remaining `package.json` manifests too (cheap, layer-cached). Test this first; it is the most likely snag.
- Digest pin means Debian security fixes stop arriving implicitly — SUG-OPS-004's docker ecosystem PRs are the counterpart; land both.
- If SUG-OPS-007 (multi-stage) lands first, apply these fixes to its `base`/`build` stages instead of the flat file.
