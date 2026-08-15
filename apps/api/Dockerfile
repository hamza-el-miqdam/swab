# ── Swab API — dev + production images ─────────────────────────────────────
# Build context is the MONOREPO ROOT (see docker-compose.yml). Two selectable
# targets:
#   dev  — `docker compose up` local loop: devDependencies, tsx watch, source
#          bind-mounted for live reload (compose pins `target: dev`).
#   prod — hardened deployable image: compiled JS, devDependencies stripped,
#          pinned base digest, non-root user, HEALTHCHECK. Built + scanned
#          with Trivy in CI (.github/workflows/security.yml, `--target prod`)
#          for the "zero HIGH/CRITICAL" gate (devops hard constraint 2) — the
#          dev image is never the scan target.
#
# NOTE on `pnpm deploy` / `pnpm prune --prod`: NEITHER is used here, on
# purpose, both verified broken for this workspace shape before landing on
# the approach below:
#   - `pnpm deploy` (with or without --legacy / inject-workspace-packages)
#     copies @repo/db's raw TypeScript source into node_modules/.pnpm/.../
#     node_modules/@repo/db. `@repo/db`'s package.json points "main" at
#     ./src/index.ts (data-steward owned, not this file's concern to
#     change) — Node 22 strips TS types natively for files OUTSIDE
#     node_modules, but deliberately REFUSES to for anything resolved
#     FROM INSIDE node_modules (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING).
#     Confirmed this crashes the container at boot.
#   - `pnpm prune --prod` (pnpm 10.12.1) triggered an unexplained "reinstall
#     from scratch" that left runtime dependencies (fastify, @prisma/client)
#     missing while root-only devDependencies (eslint, turbo) survived —
#     reproducible, not a one-off. A second `pnpm install --frozen-lockfile
#     --prod` on top of an already-full install is also a no-op (doesn't
#     retroactively remove devDependencies).
# Instead: install once with workspace symlinks kept (@repo/db resolves to
# /app/packages/db/src/index.ts — outside node_modules, type-stripping
# allowed), generate + build, then explicitly remove the known
# devDependency-only packages (both the per-package top-level symlinks and
# their backing .pnpm store entries) by name. Verified end-to-end against
# local Postgres: /health, /ready (DB round-trip), and an actual
# Prisma-backed route (/auth/otp/request) all pass after cleanup.
FROM node:22-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS base

# pnpm via corepack — version pinned by "packageManager" in package.json
RUN corepack enable

# OpenSSL is required by Prisma's query engine on slim images
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── dev ──────────────────────────────────────────────────────────────────
FROM base AS dev

# Layer-cache dependency resolution: manifests first, sources after
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile --filter @repo/db --filter @repo/api

COPY packages/db packages/db
COPY apps/api apps/api

# Generate the Prisma client (needs the schema only, not a live database)
RUN pnpm --filter @repo/db db:generate

# Least privilege (G1): run as the unprivileged user provided by the image
USER node

EXPOSE 3001

# Schema is pushed by the compose entrypoint (needs the DB up), then the API
# starts in watch mode — source is bind-mounted for live reload.
CMD ["pnpm", "--filter", "@repo/api", "dev"]

# ── build (prod's builder stage — not shipped) ──────────────────────────
FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/

# Full install (devDependencies included — needed for tsc/prisma generate
# below); workspace deps stay symlinked (see NOTE above on why not `deploy`).
RUN pnpm install --frozen-lockfile --filter @repo/db --filter @repo/api

COPY packages/db packages/db
COPY apps/api apps/api

RUN pnpm --filter @repo/db db:generate && pnpm --filter @repo/api build

# Explicit devDependency removal (see NOTE above on why not `pnpm prune`).
# Keep this list in sync with apps/api/package.json + packages/db/package.json
# devDependencies if either changes; a stale entry here just means less size
# reduction, never a broken build (nothing here is a runtime dependency).
RUN rm -rf apps/api/node_modules/@types apps/api/node_modules/@vitest \
           apps/api/node_modules/tsx apps/api/node_modules/typescript \
           apps/api/node_modules/vitest \
           packages/db/node_modules/@types packages/db/node_modules/prisma \
           packages/db/node_modules/tsx packages/db/node_modules/typescript \
           node_modules/@eslint node_modules/eslint \
           node_modules/eslint-config-prettier node_modules/prettier \
           node_modules/turbo node_modules/typescript node_modules/typescript-eslint
RUN cd node_modules/.pnpm && rm -rf \
      typescript@* 'prisma@6.19.3_magicast*' tsx@* vitest@* '@vitest+coverage-v8@*' \
      effect@* jsdom@* fast-check@* '@esbuild+*' 'lightningcss-*' rollup@* vite@* \
      '@babel+*' turbo@* '@turbo+*' eslint@* '@eslint+*' 'eslint-config-prettier@*' \
      'typescript-eslint@*' '@typescript-eslint+*' prettier@* '@types+node@*' magicast@*

# ── prod ─────────────────────────────────────────────────────────────────
FROM node:22-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS prod

# OpenSSL is required by Prisma's query engine on slim images
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# Least privilege (G1) + Trivy gate: this stage's entrypoint is `node
# dist/server.js` and its HEALTHCHECK is `node -e` — neither shells out to npm,
# npx or corepack/pnpm, so none of them belong in a deployable image. They are
# also the ONLY source of the tar (CRITICAL), sigstore and ip-address findings
# in the security.yml scan: all three come bundled inside the base image's npm
# and have ZERO entries in pnpm-lock.yaml, so no pnpm override can reach them.
# Deleting the bundle fixes the finding at its root instead of suppressing it.
# Keep this OUT of the `dev` and `build` stages — both need pnpm to install.
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/packages/db packages/db
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
# pnpm's per-package node_modules (apps/api/node_modules, packages/db/node_modules)
# hold the actual @repo/db, fastify, pino, zod, @prisma/client symlinks — the
# root node_modules copied above only holds the workspace ROOT's own deps.
COPY --from=build /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/packages/db/node_modules packages/db/node_modules

WORKDIR /app/apps/api

# Least privilege (G1): run as the unprivileged user provided by the image
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --retries=3 --start-period=10s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3001/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "dist/server.js"]
