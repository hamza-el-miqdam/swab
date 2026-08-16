/**
 * Local dev API with NO database — for running the mobile E2E gates
 * (`scripts/e2e-{ios,android}.sh`) on a machine without Docker/Postgres.
 *
 *   pnpm --filter @repo/api dev:local
 *
 * Why this works: `buildApp()` takes its persistence as an injected
 * [Repository] seam (src/repo.ts), so the in-memory double already written
 * for route tests (tests/fake-repo.ts) serves the app just as well as
 * Prisma does. `DATABASE_URL` is only ever read by Prisma, so the env
 * schema is satisfied with a placeholder and no database is contacted.
 *
 * Deliberately lives in tests/ — it is excluded from the production build
 * (tsconfig.build.json includes only src/**), is not picked up by vitest
 * (which matches tests/**\/*.test.ts), and does not count toward coverage
 * (which scopes to src/**). It must never be imported by src/.
 *
 * NOT a substitute for the real stack. State is per-process and vanishes on
 * exit; there is no migration, constraint, or concurrency behaviour here.
 * Use `docker compose up --build` when you need to exercise Postgres itself
 * (and `tests/prisma-repo.test.ts` always does).
 */
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/env.js";
import { fakeRepository } from "./fake-repo.js";

const env = loadEnv({
  // Placeholder: satisfies the env schema (G1 fail-fast) but is never dialled,
  // because fakeRepository() replaces Prisma entirely.
  DATABASE_URL: "postgresql://unused:unused@localhost:5432/unused",
  // Local-only, non-secret by construction. Never reuse this value anywhere
  // real — it is committed, so treat it as public (G1).
  JWT_SECRET: "local-dev-only-not-a-secret-0123456789abcdef",
  PORT: process.env.PORT ?? "3001",
  NODE_ENV: "development",
  // The mobile E2E flows read the OTP straight off the screen, so the dev
  // code must be echoed. The env schema already refuses this in production.
  OTP_DEV_CODE: "enabled",
});

const app = await buildApp({
  env,
  repo: fakeRepository(),
  // No database to check — report ready so `/ready` preflights succeed.
  dbHealth: async () => ({ ok: true, latencyMs: 0 }),
});

await app.listen({ port: env.PORT, host: "0.0.0.0" });
app.log.warn(
  "dev:local — in-memory repository, NO database. State is lost on exit. " +
    "Do not use for anything that needs real persistence.",
);
