import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // server.ts (boot wiring) and prisma-repo.ts (needs Postgres) are covered
      // by the upcoming Testcontainers integration suite — documented gap,
      // backend rule 7. repo.ts is types-only.
      exclude: ["src/server.ts", "src/prisma-repo.ts", "src/repo.ts"],
      thresholds: { lines: 80 },
    },
  },
});
