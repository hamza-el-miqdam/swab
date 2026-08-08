# ── Swab API — LOCAL DEVELOPMENT image ─────────────────────────────────────
# Purpose: `docker compose up` gives you Postgres + the API with zero local
# Node setup. Build context is the MONOREPO ROOT (see docker-compose.yml).
#
# NOTE (DevOps agent hard constraint 2): this is the dev image. The hardened
# production image (multi-stage `pnpm deploy`, pinned digest, Trivy zero
# HIGH/CRITICAL gate) ships with the CI pipeline issue [area:sre].
FROM node:22-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436

# pnpm via corepack — version pinned by "packageManager" in package.json
RUN corepack enable

# OpenSSL is required by Prisma's query engine on slim images
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

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
