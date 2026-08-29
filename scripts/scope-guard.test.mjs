// Table-driven unit tests for scripts/scope-guard.mjs's pure path-matching
// function. Run with: node --test scripts/scope-guard.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeViolations, describeResult, getChangedFiles, AREA_PREFIXES } from "./scope-guard.mjs";

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
    name: "any area may close out its own suggestion by moving it to suggestions/done/ and updating the README counts",
    labels: ["area:db"],
    changedFiles: [
      "packages/db/prisma/schema.prisma",
      "packages/db/CHANGELOG.md",
      "suggestions/db/SUG-DB-003-match-reversed-pair-race.md",
      "suggestions/done/db/SUG-DB-003-match-reversed-pair-race.md",
      "suggestions/README.md",
    ],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "the suggestions/ allowance is shared, not area:db-specific",
    labels: ["area:backend"],
    changedFiles: [
      "apps/api/src/routes/auth.ts",
      "suggestions/done/backend/SUG-API-004-concurrent-signup-race.md",
    ],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    // Issues #115/#116/#147: area:specs-labeled PRs #145/#146 legitimately
    // touch these two cross-cutting governance paths (process docs, ADR
    // corrections) even though neither lives under docs/specs/.
    name: "area:specs PR touching docs/agent-playbook.md + docs/decisions/ stays in scope",
    labels: ["area:specs"],
    changedFiles: [
      "docs/agent-playbook.md",
      "docs/decisions/ADR-001-server-side-classification-data.md",
      "CHANGELOG.md",
    ],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "area:specs touching an unrelated docs/ path (not agent-playbook.md or docs/decisions/) still escapes scope",
    labels: ["area:specs"],
    changedFiles: ["docs/design/foo.md"],
    expect: { escaping: ["docs/design/foo.md"], schemaViolation: false, unlabeled: false },
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
    // Adding a devDependency to packages/db (e.g. a test runner) rewrites the
    // workspace lockfile. Before this was shared, G4's "no new dependencies
    // without justification" was unsatisfiable: the justification was allowed,
    // the diff it produces was not.
    name: "pnpm-lock.yaml is allowed from any area — a dependency change always rewrites it",
    labels: ["area:db"],
    changedFiles: ["packages/db/package.json", "packages/db/prisma/schema.prisma", "pnpm-lock.yaml"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "sharing the lockfile does not share the root package.json — that stays area:sre",
    labels: ["area:ios"],
    changedFiles: ["apps/ios/Sources/SwabCore/App.swift", "package.json", "pnpm-lock.yaml"],
    expect: { escaping: ["package.json"], schemaViolation: false, unlabeled: false },
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
  {
    // Issue #141 gap 1: a backend-owned change legitimately touches
    // docker-compose.yml (e.g. wiring a new env var into the api service)
    // even though the file itself lives under area:sre's prefixes.
    name: "docker-compose.yml is shared — an area:backend PR may touch it without also carrying area:sre",
    labels: ["area:backend"],
    changedFiles: ["apps/api/src/routes/auth.ts", "docker-compose.yml"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "the docker-compose.yml allowance is shared, not area:sre/area:devops-specific",
    labels: ["area:web"],
    changedFiles: ["apps/web/next.config.js", "docker-compose.yml"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    // Issue #147: a scope-guard mapping fix routinely needs a matching edit
    // to the Scope section of whichever specialist file it's about (here,
    // agents/spec-specialist.md) — the other named gap from the header
    // comment ("agents/*.md itself"), hit directly while fixing the first.
    name: "area:sre PR editing another area's agents/*.md Scope section (a mapping-sync commit) stays in scope",
    labels: ["area:sre"],
    changedFiles: ["scripts/scope-guard.mjs", "agents/spec-specialist.md", "CHANGELOG.md"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "area:devops PR editing agents/*.md stays in scope (alias of area:sre)",
    labels: ["area:devops"],
    changedFiles: ["agents/_global-directives.md"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "agents/*.md is not silently granted to unrelated areas (area:ios)",
    labels: ["area:ios"],
    changedFiles: ["apps/ios/Sources/SwabCore/App.swift", "agents/ios-specialist.md"],
    expect: { escaping: ["agents/ios-specialist.md"], schemaViolation: false, unlabeled: false },
  },
  {
    // PR #161 review: CLAUDE.md/README.md/docs/ROADMAP.md must be scoped
    // into area:specs/area:devops only, NOT SHARED_ALLOWED_PREFIXES — an
    // unrelated area must not be able to silently edit repo-root
    // governance docs (e.g. weaken CLAUDE.md's own Hard Boundaries) just
    // by carrying its own label.
    name: "CLAUDE.md/README.md/docs/ROADMAP.md are not silently granted to unrelated areas (area:db)",
    labels: ["area:db"],
    changedFiles: ["packages/db/prisma/schema.prisma", "CLAUDE.md", "README.md", "docs/ROADMAP.md"],
    expect: {
      escaping: ["CLAUDE.md", "README.md", "docs/ROADMAP.md"],
      schemaViolation: false,
      unlabeled: false,
    },
  },
  {
    name: "area:specs PR touching CLAUDE.md/README.md/docs/ROADMAP.md stays in scope",
    labels: ["area:specs"],
    changedFiles: ["docs/specs/FS-05-envie-match.md", "CLAUDE.md", "README.md", "docs/ROADMAP.md"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "area:devops PR touching CLAUDE.md/README.md/docs/ROADMAP.md stays in scope (alias of area:sre)",
    labels: ["area:devops"],
    changedFiles: ["CLAUDE.md", "README.md", "docs/ROADMAP.md"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    // PR #162 review: docs/product-overview.md/docs/README.md/docs/archive/
    // must be scoped into area:specs/area:devops only, NOT
    // SHARED_ALLOWED_PREFIXES — same authority-boundary reasoning as the
    // CLAUDE.md/README.md/docs/ROADMAP.md case above.
    name: "docs/product-overview.md/docs/README.md/docs/archive/ are not silently granted to unrelated areas (area:db)",
    labels: ["area:db"],
    changedFiles: [
      "packages/db/prisma/schema.prisma",
      "docs/product-overview.md",
      "docs/README.md",
      "docs/archive/CHANGELOG-2026-08-17.md",
    ],
    expect: {
      escaping: ["docs/product-overview.md", "docs/README.md", "docs/archive/CHANGELOG-2026-08-17.md"],
      schemaViolation: false,
      unlabeled: false,
    },
  },
  {
    name: "area:specs PR touching docs/product-overview.md/docs/README.md/docs/archive/ stays in scope",
    labels: ["area:specs"],
    changedFiles: [
      "docs/specs/FS-05-envie-match.md",
      "docs/product-overview.md",
      "docs/README.md",
      "docs/archive/CHANGELOG-2026-08-17.md",
    ],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
  },
  {
    name: "area:devops PR touching docs/product-overview.md/docs/README.md/docs/archive/ stays in scope (alias of area:specs)",
    labels: ["area:devops"],
    changedFiles: ["docs/product-overview.md", "docs/README.md", "docs/archive/CHANGELOG-2026-08-17.md"],
    expect: { escaping: [], schemaViolation: false, unlabeled: false },
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

// describeResult() is the pure decision layer main() delegates to (side
// effects — console + process.exitCode — live only in main()). Covers
// issue #141 gap 2: an unlabeled PR must now fail closed, not warn-and-pass.
test("describeResult: unlabeled PR fails closed (issue #141 gap 2 — grace period is over)", () => {
  const result = describeResult([], ["apps/ios/Sources/SwabCore/App.swift", "apps/api/src/routes/auth.ts"]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.level, "error");
  // Message must name the valid area:* labels so an agent can self-correct.
  for (const label of Object.keys(AREA_PREFIXES)) {
    assert.ok(result.message.includes(label), `expected message to name ${label}`);
  }
  // The old warn-and-pass / bake-in-week language must be gone.
  assert.ok(!/warn-and-pass/i.test(result.message));
  assert.ok(!/bake-in/i.test(result.message));
});

test("describeResult: unlabeled PR with zero changed files still fails closed", () => {
  const result = describeResult([], []);
  assert.equal(result.exitCode, 1);
  assert.equal(result.level, "error");
});

test("describeResult: schema violation still takes priority and fails", () => {
  const result = describeResult(["area:backend"], ["packages/db/prisma/schema.prisma"]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.level, "error");
  assert.match(result.message, /schema/i);
});

test("describeResult: escaping paths fail with a labeled PR", () => {
  const result = describeResult(["area:ios"], ["apps/api/src/routes/auth.ts"]);
  assert.equal(result.exitCode, 1);
  assert.equal(result.level, "error");
  assert.match(result.message, /apps\/api\/src\/routes\/auth\.ts/);
});

test("describeResult: a properly labeled, in-scope PR passes with exit code 0", () => {
  const result = describeResult(["area:ios"], ["apps/ios/Sources/SwabCore/App.swift"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.level, "log");
  assert.match(result.message, /PASS/);
});

// --- issue #65: getChangedFiles was untested, which is exactly where the
// "base branch advanced after the PR opened" bug lived. These build a real
// temp git repo to exercise the actual `git diff` call rather than a
// hand-supplied file list, so they can reproduce the bug and lock in the fix.
//
// Scenario: base.sha is the commit main was at when the PR opened. The PR
// branch adds pr-file.txt. Main then advances with an unrelated commit
// (main-only.txt) — simulating another PR merging while this one stays open.

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function makeStaleBaseRepo() {
  const dir = mkdtempSync(join(tmpdir(), "scope-guard-test-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "Test");

  writeFileSync(join(dir, "base.txt"), "base\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  const baseSha = git(dir, "rev-parse", "HEAD");

  git(dir, "checkout", "-q", "-b", "pr-branch");
  writeFileSync(join(dir, "pr-file.txt"), "pr change\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "pr change");
  const prHeadSha = git(dir, "rev-parse", "HEAD");

  // Main advances after the PR branched — e.g. an unrelated PR merges.
  git(dir, "checkout", "-q", "main");
  writeFileSync(join(dir, "main-only.txt"), "merged to main after the PR opened\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "unrelated commit merged to main after the PR opened");

  return { dir, baseSha, prHeadSha };
}

test("getChangedFiles: merge-ref-style HEAD (PR head merged with current main tip) wrongly includes files merged to main after the PR opened — reproduces issue #65", () => {
  const { dir, baseSha, prHeadSha } = makeStaleBaseRepo();
  try {
    // Simulates what actions/checkout does by default for a pull_request
    // event: it checks out refs/pull/N/merge, i.e. the PR head merged with
    // whatever the base branch's CURRENT tip is — not what it was when the
    // PR opened (which base.sha is pinned to).
    git(dir, "checkout", "-q", prHeadSha);
    git(dir, "merge", "-q", "--no-edit", "main");

    const changed = getChangedFiles(baseSha, { cwd: dir });

    assert.ok(
      changed.includes("main-only.txt"),
      "expected the merge-ref-style HEAD to leak main-only.txt into the diff (that's the bug)",
    );
    assert.ok(changed.includes("pr-file.txt"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("getChangedFiles: checking out the PR head SHA directly excludes commits merged to main after the PR opened — fix for issue #65", () => {
  const { dir, baseSha, prHeadSha } = makeStaleBaseRepo();
  try {
    // The fix: check out the PR's own head commit, not a merge ref. Now
    // base.sha...HEAD means what the script has always assumed it means.
    git(dir, "checkout", "-q", prHeadSha);

    const changed = getChangedFiles(baseSha, { cwd: dir });

    assert.deepEqual(changed, ["pr-file.txt"]);
    assert.ok(!changed.includes("main-only.txt"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
