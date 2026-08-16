# SUG-OPS-007 — No production API image: only the dev Dockerfile exists

- **Area:** devops
- **Topic:** docker
- **Impact:** medium
- **Effort:** M
- **Implementing agent:** devops-specialist (.claude/agents/devops-specialist.md)
- **Related requirement IDs:** n/a (devops hard constraint 2)

## Problem / Opportunity

`apps/api/Dockerfile:1-7` states it is the **local development** image and defers the hardened production image: "the hardened production image (multi-stage `pnpm deploy`, pinned digest, Trivy zero HIGH/CRITICAL gate) ships with the CI pipeline issue [area:sre]" (`Dockerfile:5-7`). That issue has not shipped. The dev image installs devDependencies, runs `tsx watch` via `pnpm --filter @repo/api dev` (`Dockerfile:42`), and carries the whole workspace source — none of which belongs in a deployable artifact. The API is described repo-wide as "standalone Node service, container-ready" (`agents/_global-directives.md`, Project section); container-ready currently means dev-only.

## Implementation plan

1. Add a production stage to `apps/api/Dockerfile` (keep the dev image working — compose references this file at `docker-compose.yml:30-32`; use multi-stage with named targets so compose can pin `target: dev`):
   - Restructure into stages: `FROM node:22-slim AS base` (corepack + openssl, current lines 8-16), `FROM base AS dev` (current behavior, lines 18-42), then:

   ```dockerfile
   FROM base AS build
   WORKDIR /app
   COPY pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.base.json ./
   COPY packages/db/package.json packages/db/
   COPY apps/api/package.json apps/api/
   RUN pnpm install --frozen-lockfile --filter @repo/db --filter @repo/api
   COPY packages/db packages/db
   COPY apps/api apps/api
   RUN pnpm --filter @repo/db db:generate \
    && pnpm --filter @repo/api build \
    && pnpm --filter @repo/api deploy --prod /out

   FROM node:22-slim AS prod
   RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
   ENV NODE_ENV=production
   WORKDIR /app
   COPY --from=build /out .
   USER node
   EXPOSE 3001
   HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
     CMD ["node", "-e", "fetch('http://127.0.0.1:3001/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
   CMD ["node", "apps/api/dist/server.js"]
   ```
   Adjust the `CMD` path and the `pnpm deploy` handling of the generated Prisma client to reality at implementation time (`pnpm deploy` + generated `@prisma/client` needs the client output included — verify `dist/` layout from `apps/api/tsconfig.build.json` and where `prisma generate` emits, and copy explicitly if `deploy` drops it).
2. Add `target: dev` under `build:` in `docker-compose.yml` (this is the one existing-file edit, done by the implementing agent, not this audit) so `docker compose up --build` behavior is unchanged.
3. Wire the CI build+Trivy job (SUG-OPS-003) to build `--target prod` — that is the image the constraint's "zero HIGH/CRITICAL" applies to.
4. Pin both `FROM node:22-slim` lines by digest (see SUG-OPS-008) — hard constraint 2 requires "pinned digest".
5. Root `CHANGELOG.md` entry + `docs/STATUS.md` infra table update.

## Tests & acceptance criteria

- `docker build --target prod -f apps/api/Dockerfile -t swab-api:prod .` succeeds from repo root.
- `docker run --rm -e DATABASE_URL=... -e JWT_SECRET=$(openssl rand -hex 32) -p 3001:3001 swab-api:prod` boots; `curl -f localhost:3001/health` returns 200; `docker inspect` shows healthy after the start period.
- `docker compose up --build` still works identically (dev target).
- Image size sanity: prod image should be dramatically smaller than dev (no devDeps, no tsx/vitest).
- Trivy scan of the prod target: zero HIGH/CRITICAL (with `ignore-unfixed`).

## Risks & gotchas

- `pnpm deploy` in workspaces with `"main": "./src/index.ts"` TS-source packages (`packages/db/package.json`) is the tricky part: `@repo/db` ships TS sources, so the API's `tsc` build must compile them in (check `tsconfig.build.json` references) or `dist` must be self-contained. Budget time to verify the runtime entry actually resolves `@repo/db`.
- Compose without `target:` builds the last stage — merging the multi-stage file **before** adding `target: dev` to compose breaks the local dev loop. Do both in the same PR.
- Keep dev-stage behavior byte-identical; ios/android agents depend on `docker compose up --build` for the E2E gate preflight (`scripts/e2e-ios.sh:10-11`).
