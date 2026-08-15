// Table-driven unit tests for scripts/scope-guard.mjs's pure path-matching
// function. Run with: node --test scripts/scope-guard.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeViolations } from "./scope-guard.mjs";

const cases = [
  {
    name: "area:ios PR touching only apps/ios + its changelog passes",
    labels: ["area:ios"],
    changedFiles: ["apps/ios/Sources/SwabCore/App.swift", "apps/ios/CHANGELOG.md"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "area:ios PR touching apps/api escapes scope",
    labels: ["area:ios"],
    changedFiles: ["apps/ios/Sources/SwabCore/App.swift", "apps/api/src/routes/auth.ts"],
    expect: { escaping: ["apps/api/src/routes/auth.ts"], schemaViolation: false, unlabeled: false },
  },
  {
    name: "area:android PR touching apps/ios escapes scope",
    labels: ["area:android"],
    changedFiles: ["apps/android/app/src/main/kotlin/Foo.kt", "apps/ios/Package.swift"],
    expect: { escaping: ["apps/ios/Package.swift"], schemaViolation: false, unlabeled: false },
  },
  {
    name: "area:api and area:backend are aliases for the same scope",
    labels: ["area:backend"],
    changedFiles: ["apps/api/src/routes/auth.ts", "packages/api-client/src/index.ts"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "area:db PR stays within packages/db",
    labels: ["area:db"],
    changedFiles: ["packages/db/prisma/schema.prisma", "packages/db/CHANGELOG.md"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "schema.prisma touched without area:db label is a hard-gate violation (also reported as escaping, since it's genuinely outside area:backend's scope)",
    labels: ["area:backend"],
    changedFiles: ["packages/db/prisma/schema.prisma"],
    expect: { escaping: ["packages/db/prisma/schema.prisma"], schemaViolation: true, unlabeled: false },
  },
  {
    name: "schema hard gate fires even when other files are in-scope",
    labels: ["area:api"],
    changedFiles: ["apps/api/src/routes/auth.ts", "packages/db/prisma/schema.prisma"],
    expect: { escaping: ["packages/db/prisma/schema.prisma"], schemaViolation: true, unlabeled: false },
  },
  {
    name: "shared paths (docs/STATUS.md, docs/qa/**) always allowed",
    labels: ["area:ios"],
    changedFiles: ["apps/ios/Sources/SwabCore/App.swift", "docs/STATUS.md", "docs/qa/e2e-scenarios.md"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "cross-cutting PR unions prefixes across multiple area labels",
    labels: ["area:ios", "area:specs"],
    changedFiles: ["apps/ios/Sources/SwabCore/App.swift", "docs/specs/FS-01-onboarding.md"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "PR with no recognized area:* label warns and passes (no violations reported)",
    labels: [],
    changedFiles: ["apps/ios/Sources/SwabCore/App.swift", "apps/api/src/routes/auth.ts"],
    expect: { escaping: [], schemaViolation: false, unlabeled: true },
  },
  {
    name: "area:design allowed into its two generated-file exceptions in apps/ios and apps/android",
    labels: ["area:design"],
    changedFiles: [
      "packages/ui/tokens/tokens.json",
      "apps/ios/Sources/SwabCore/Generated/DesignTokens.swift",
      "apps/android/app/src/main/kotlin/com/swab/android/ui/theme/DesignTokens.kt",
    ],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "area:design touching an app screen (not the generated exception file) escapes scope",
    labels: ["area:design"],
    changedFiles: ["apps/ios/Sources/SwabCore/Views/MapView.swift"],
    expect: { escaping: ["apps/ios/Sources/SwabCore/Views/MapView.swift"], schemaViolation: false, unlabeled: false },
  },
  {
    name: "area:sre and area:devops are aliases for the same scope",
    labels: ["area:devops"],
    changedFiles: [".github/workflows/ci.yml", "docker-compose.yml", "turbo.json"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "root CHANGELOG.md allowed for package-less areas (area:sre)",
    labels: ["area:sre"],
    changedFiles: [".github/workflows/ci.yml", "CHANGELOG.md"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "root CHANGELOG.md NOT in an area with its own package (area:ios) unless also shared/matched",
    labels: ["area:ios"],
    changedFiles: ["apps/ios/Sources/SwabCore/App.swift", "CHANGELOG.md"],
    expect: { escaping: ["CHANGELOG.md"], schemaViolation: false, unlabeled: false },
  },
  {
    name: "area:devops owns the root workspace manifest + lockfile (pnpm.overrides, devDependencies)",
    labels: ["area:devops"],
    changedFiles: ["package.json", "pnpm-lock.yaml", "apps/api/Dockerfile"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "root package.json is an EXACT match — it must not cover a package's own manifest",
    labels: ["area:devops"],
    changedFiles: ["apps/api/package.json"],
    expect: { escaping: ["apps/api/package.json"], schemaViolation: false, unlabeled: false },
  },
  {
    name: "root manifest is not silently granted to unrelated areas (area:ios)",
    labels: ["area:ios"],
    changedFiles: ["apps/ios/Sources/SwabCore/App.swift", "package.json"],
    expect: { escaping: ["package.json"], schemaViolation: false, unlabeled: false },
  },
];

for (const { name, labels, changedFiles, expect } of cases) {
  test(name, () => {
    const result = computeViolations(labels, changedFiles);
    assert.deepEqual(result.escaping, expect.escaping);
    assert.equal(result.schemaViolation, expect.schemaViolation);
    assert.equal(result.unlabeled, expect.unlabeled);
  });
}
