import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // lcov feeds scripts/diff-coverage.mjs (coverage of the lines a PR
      // changed, not just the package-wide floor below). text keeps the
      // terminal summary developers already rely on.
      reporter: ["text", "lcov"],
      include: ["src/**"],
      // server.ts (boot wiring) is still uncovered — separate follow-up.
      // prisma-repo.ts is now covered by tests/prisma-repo.test.ts (real
      // Postgres, issue #22). repo.ts is types-only.
      exclude: ["src/server.ts", "src/repo.ts"],
      thresholds: { lines: 80 },
    },
  },
});
