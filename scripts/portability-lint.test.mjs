// Table-driven unit tests for scripts/portability-lint.mjs's pure matcher
// function. Run with: node --test scripts/portability-lint.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { findViolations, shouldScan, FORBIDDEN_PATTERNS } from "./portability-lint.mjs";

const cases = [
  {
    name: "clean file has no violations",
    filePath: "apps/api/src/env.ts",
    content: "export const env = { DATABASE_URL: process.env.DATABASE_URL };\n",
    expectPatterns: [],
  },
  {
    name: "@vercel/kv import is caught",
    filePath: "apps/api/src/cache.ts",
    content: "import { kv } from '@vercel/kv';\n",
    expectPatterns: ["@vercel/kv"],
  },
  {
    name: "@vercel/blob import is caught",
    filePath: "apps/web/src/upload.ts",
    content: "import { put } from '@vercel/blob';\n",
    expectPatterns: ["@vercel/blob"],
  },
  {
    name: "@vercel/edge-config import is caught",
    filePath: "apps/api/src/flags.ts",
    content: "import { get } from '@vercel/edge-config';\n",
    expectPatterns: ["@vercel/edge-config"],
  },
  {
    name: "@vercel/kv in package.json dependency line is caught",
    filePath: "apps/api/package.json",
    content: '{\n  "dependencies": {\n    "@vercel/kv": "^1.0.0"\n  }\n}\n',
    expectPatterns: ["@vercel/kv"],
  },
  {
    name: "Vercel KV REST hostname is caught",
    filePath: "apps/api/src/cache.ts",
    content: "const url = 'https://my-store.kv.vercel-storage.com';\n",
    expectPatterns: ["Vercel KV REST endpoint"],
  },
  {
    name: "neon.tech hostname is caught",
    filePath: "packages/db/src/client.ts",
    content: "const url = 'postgres://user:pass@ep-cool-thing.neon.tech/db';\n",
    expectPatterns: ["neon.tech hostname"],
  },
  {
    name: "@neondatabase/serverless import is caught",
    filePath: "packages/db/src/client.ts",
    content: "import { Pool } from '@neondatabase/serverless';\n",
    expectPatterns: ["@neondatabase/serverless"],
  },
  {
    name: "pg_embedding extension reference is caught",
    filePath: "packages/db/prisma/migrations/0001_init/migration.sql",
    content: "CREATE EXTENSION IF NOT EXISTS pg_embedding;\n",
    expectPatterns: ["pg_embedding (Neon-specific extension)"],
  },
  {
    name: "multiple violations on different lines are all reported",
    filePath: "apps/api/src/cache.ts",
    content: "import { kv } from '@vercel/kv';\nimport { put } from '@vercel/blob';\n",
    expectPatterns: ["@vercel/kv", "@vercel/blob"],
  },
  {
    name: "a real Postgres connection string (non-Neon) is not flagged",
    filePath: "packages/db/src/client.ts",
    content: "const url = 'postgres://swab:swab@localhost:5432/swab';\n",
    expectPatterns: [],
  },
];

for (const { name, filePath, content, expectPatterns } of cases) {
  test(name, () => {
    const violations = findViolations(filePath, content);
    assert.deepEqual(
      violations.map((v) => v.pattern),
      expectPatterns,
    );
  });
}

test("FORBIDDEN_PATTERNS is non-empty and every entry has a name + regex", () => {
  assert.ok(FORBIDDEN_PATTERNS.length > 0);
  for (const p of FORBIDDEN_PATTERNS) {
    assert.equal(typeof p.name, "string");
    assert.ok(p.regex instanceof RegExp);
  }
});

test("shouldScan: app/package/tool source files are scanned", () => {
  assert.equal(shouldScan("apps/api/src/env.ts"), true);
  assert.equal(shouldScan("packages/db/src/client.ts"), true);
  assert.equal(shouldScan("tools/orchestrator/src/index.ts"), true);
});

test("shouldScan: docs, agents, and markdown are excluded (they legitimately name these prohibitions)", () => {
  assert.equal(shouldScan("docs/specs/FS-05-envie-match.md"), false);
  assert.equal(shouldScan("agents/devops-infrastructure-specialist.md"), false);
  assert.equal(shouldScan("apps/api/README.md"), false);
  assert.equal(shouldScan(".github/instructions/devops.instructions.md"), false);
});

test("shouldScan: root-level files outside the scan prefixes are excluded", () => {
  assert.equal(shouldScan("package.json"), false);
  assert.equal(shouldScan("turbo.json"), false);
});
