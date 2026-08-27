#!/usr/bin/env node
/**
 * scope-guard — enforces G4: "A PR touching paths outside scope will be
 * auto-rejected by the scope guard." (agents/_global-directives.md)
 *
 * Path-prefix mapping is derived from each agents/*-specialist.md "Scope"
 * section — keep AREA_PREFIXES in sync when a Scope section changes; this
 * script does not read the agent files at runtime (deliberately: no drift
 * between "what the agent may edit" and "what this checks" is silently
 * introduced by a slow markdown parse, but the two CAN drift by omission —
 * that's on the human/agent editing this file).
 *
 * Some areas don't map to a single agents/*-specialist.md Scope section
 * (they're cross-cutting: repo-root governance docs, agents/*.md itself).
 * Issue #147 closed two concrete gaps this used to name here (docs/
 * agent-playbook.md + docs/decisions/ under area:specs; agents/ itself
 * under area:sre/area:devops); PR #161 closed the remaining three
 * (CLAUDE.md, README.md, docs/ROADMAP.md, added to area:specs/area:devops
 * — see those entries below for the rationale). If a new repo-root
 * governance doc shows up unmapped, follow that pattern: scope it into
 * the specific area(s) that legitimately author it, in AREA_PREFIXES —
 * NOT into SHARED_ALLOWED_PREFIXES, which grants every area at once and
 * is reserved for files that are structurally owned by none (a lockfile,
 * a status board) rather than governance text that defines authority
 * itself (PR #161 review: widening the shared bucket let an unrelated
 * area silently edit CLAUDE.md's own Hard Boundaries).
 *
 * Usage (as invoked by .github/workflows/scope-guard.yml):
 *   LABELS="area:ios" BASE=<sha> node scripts/scope-guard.mjs
 *
 * Exit codes: 0 = pass, 1 = fail — including an unlabeled PR (fail-closed
 * since issue #141; the prior warn-and-pass grace period from SUG-OPS-002
 * step 3 ended after its one-week bake-in and has been removed).
 */
import { execFileSync } from "node:child_process";

// Backend's own agent file (agents/backend-systems-specialist.md) labels
// issues `area:api`; CLAUDE.md, agents/_global-directives.md (G5), and
// several suggestions/*.md files instead say `area:backend` for the same
// area. The repo is inconsistent about which spelling is canonical — accept
// both rather than guessing one is wrong.
// Same story for devops: the agent's own header says `area:sre`, but G5 and
// CLAUDE.md also say `area:devops` for the same scope.
export const AREA_PREFIXES = {
  "area:ios": ["apps/ios/"],
  "area:android": ["apps/android/"],
  "area:api": ["apps/api/", "packages/api-client/"],
  "area:backend": ["apps/api/", "packages/api-client/"],
  "area:db": ["packages/db/"],
  "area:web": ["apps/web/", "packages/ui/", "packages/api-client/"],
  "area:design": [
    "blueprints/",
    "docs/design/",
    "docs/design-system.md",
    "packages/ui/tokens/",
    "packages/ui/scripts/generate.mjs",
    // Exception carved out explicitly in agents/design-specialist.md: design
    // may run the token generator and commit its output into these two
    // specific generated app files (never hand-edit them, never touch other
    // app code) — so they're allowed here as exact-file exceptions.
    "apps/ios/Sources/SwabCore/Generated/DesignTokens.swift",
    "apps/android/app/src/main/kotlin/com/swab/android/ui/theme/DesignTokens.kt",
  ],
  "area:specs": [
    "docs/specs/",
    "specs/",
    ".specify/memory/constitution.md",
    // Issues #115/#116/#147: both were filed and labeled area:specs by the
    // founder, and PRs #145/#146 closing them legitimately touch these two
    // paths — process docs (the privacy-audit steps in the playbook) and
    // ADR corrections (kept append-only per agents/review-specialist.md's
    // founder-attention flag on ADR-001, never a silent rewrite). This is
    // cross-cutting repo-root governance debt the header comment above
    // already called out as unmapped; agents/spec-specialist.md's Scope
    // section documents the same two paths.
    "docs/agent-playbook.md",
    "docs/decisions/",
    // PR #161 review: a binding-directives amendment (SUG-SPEC-014)
    // legitimately rewrites CLAUDE.md's project description and
    // README.md's law text and docs/ROADMAP.md's own sequencing notes in
    // the same PR that amends agents/_global-directives.md. Scoped to
    // area:specs/area:devops ONLY (not SHARED_ALLOWED_PREFIXES) — an
    // unrelated area (e.g. area:db) must not be able to silently edit
    // CLAUDE.md's Hard Boundaries just by carrying its own label.
    "CLAUDE.md",
    "README.md",
    "docs/ROADMAP.md",
  ],
  "area:notion-liaison": ["docs/specs/"],
  "area:sre": [
    ".github/",
    "turbo.json",
    ".npmrc",
    "pnpm-workspace.yaml",
    "apps/api/Dockerfile",
    "docker-compose.yml",
    "tools/orchestrator/",
    "scripts/",
    // Root workspace manifest + its lockfile: the agent file's scope says "root
    // configs" and already lists .npmrc / pnpm-workspace.yaml — these two are the
    // same class (workspace-level tooling: devDependencies, pnpm.overrides,
    // packageManager) and were simply missing. Per-package manifests are NOT
    // covered here; they live under their own area's prefix (e.g. apps/api/).
    "package.json",
    "pnpm-lock.yaml",
    // Issue #147: found while fixing area:specs' own gap above — this is the
    // header comment's OTHER named example of unmapped cross-cutting debt
    // ("agents/*.md itself"), not a new one. sre/devops is the agent that
    // maintains scope-guard.mjs's AREA_PREFIXES <-> agents/*-specialist.md
    // Scope-section mapping and runs scripts/render-agents.mjs — a mapping
    // fix routinely needs a matching edit to the Scope section of whichever
    // specialist file the mapping is about (here, agents/spec-specialist.md
    // for area:specs). This does not make persona/behavior content itself
    // sre-owned — that stays each area's own call — it only lets sre/devops
    // land the structural sync commit an issue like this one directs.
    "agents/",
  ],
  "area:devops": [
    ".github/",
    "turbo.json",
    ".npmrc",
    "pnpm-workspace.yaml",
    "apps/api/Dockerfile",
    "docker-compose.yml",
    "tools/orchestrator/",
    "scripts/",
    // Root workspace manifest + its lockfile: the agent file's scope says "root
    // configs" and already lists .npmrc / pnpm-workspace.yaml — these two are the
    // same class (workspace-level tooling: devDependencies, pnpm.overrides,
    // packageManager) and were simply missing. Per-package manifests are NOT
    // covered here; they live under their own area's prefix (e.g. apps/api/).
    "package.json",
    "pnpm-lock.yaml",
    // Issue #147 — see the identical entry + rationale under area:sre above
    // (the two arrays are kept as aliases of the same scope).
    "agents/",
    // PR #161 review — see the identical entry + rationale under
    // area:specs above (kept as an alias of the same scope; this PR
    // carries both labels).
    "CLAUDE.md",
    "README.md",
    "docs/ROADMAP.md",
  ],
};

// Always allowed regardless of which area label(s) are present, per the
// Definition of Done every agent shares (G5 changelog/status duties):
// - each area's own CHANGELOG.md (already inside that area's prefix for
//   package-owning areas; root CHANGELOG.md for cross-cutting areas below)
// - docs/STATUS.md (G5: "Update it in the same PR whenever a module...")
// - docs/qa/** (G2 E2E manifest, touched by ios/android on user-facing work)
// - pnpm-lock.yaml: adding a dependency to ANY package rewrites the workspace
//   lockfile, and no area owns it. Without this, G4's "no new dependencies
//   without justification in the PR description" is unsatisfiable — the
//   justification is allowed, the resulting diff is not. Same category as
//   CHANGELOG.md below: a file every area must touch, owned by none.
//   Note this permits the file, not its contents; a dependency still has to be
//   argued for in review, which is where that judgment belongs.
// - suggestions/**: the audit backlog. suggestions/README.md states that an
//   implemented suggestion moves to done/<area>/ and the open/done counts
//   update — bookkeeping every area owes on its own PR, on a tree no area
//   owns. Without this the duty was literally unsatisfiable: a PR closing out
//   its own suggestion failed this guard, so the moves silently never happened
//   and the counts drifted. Same category as CHANGELOG.md and pnpm-lock.yaml.
// - docker-compose.yml (issue #141): listed only under area:sre/area:devops
//   above, but a backend-owned change legitimately needs a line in it (e.g.
//   #139 adding OTP_RATE_LIMIT to the api service's env) — same shape as
//   pnpm-lock.yaml: a file more than one area must touch, owned by none in
//   particular. Chose option (a) from #141/#140 (add here) over formalizing
//   a mandatory 2-PR split; this permits the file, not its contents — the
//   change is still argued for in review, same caveat as pnpm-lock.yaml.
export const SHARED_ALLOWED_PREFIXES = [
  "docs/STATUS.md",
  "docs/qa/",
  "pnpm-lock.yaml",
  "suggestions/",
  "docker-compose.yml",
];

// Cross-cutting areas with no dedicated package share the root CHANGELOG.md
// (G5: "root CHANGELOG.md (devops/docs/agents/design/specs/tooling)").
const ROOT_CHANGELOG_AREAS = ["area:sre", "area:devops", "area:design", "area:specs", "area:notion-liaison"];
for (const area of ROOT_CHANGELOG_AREAS) {
  AREA_PREFIXES[area] = [...AREA_PREFIXES[area], "CHANGELOG.md"];
}

// The single hard boundary called out by name in G4: nobody but area:db may
// touch the schema, ever — independent of any other prefix matching.
const SCHEMA_PATH = "packages/db/prisma/schema.prisma";

function isAllowed(path, allowedPrefixes) {
  return allowedPrefixes.some((prefix) => (prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix));
}

/**
 * Pure function: given the PR's area labels and its list of changed files,
 * return { escaping, schemaViolation }.
 * - escaping: files that aren't covered by the union of the labels' allowed
 *   prefixes (plus the always-shared paths). Empty array if the PR carries
 *   no recognized `area:*` label at all (warn-and-pass, not a violation).
 * - schemaViolation: true if schema.prisma changed but no `area:db` label
 *   is present, regardless of any other match.
 */
export function computeViolations(labels, changedFiles) {
  const recognized = labels.filter((label) => Object.hasOwn(AREA_PREFIXES, label));
  const schemaViolation = changedFiles.includes(SCHEMA_PATH) && !labels.includes("area:db");

  if (recognized.length === 0) {
    return { escaping: [], schemaViolation, unlabeled: true };
  }

  const allowed = [...SHARED_ALLOWED_PREFIXES, ...recognized.flatMap((label) => AREA_PREFIXES[label])];
  const escaping = changedFiles.filter((path) => !isAllowed(path, allowed));

  return { escaping, schemaViolation, unlabeled: false };
}

function parseLabels(raw) {
  return (raw ?? "")
    .split(/[\s,]+/)
    .map((label) => label.trim())
    .filter(Boolean);
}

// `cwd` is exposed only so scope-guard.test.mjs can exercise this against a
// throwaway temp repo instead of the real one — main() never passes it.
//
// Correctness of the three-dot range here depends on HEAD being the PR's own
// head commit, NOT a merge of it with the base branch's current tip (see
// issue #65: actions/checkout's default pull_request behavior checks out
// refs/pull/N/merge, which makes HEAD include every commit merged to main
// since the PR opened — base...HEAD then wrongly reports those too). Fixed
// at the workflow level (.github/workflows/scope-guard.yml checks out
// `github.event.pull_request.head.sha` directly) rather than here, so this
// stays a plain three-dot diff.
export function getChangedFiles(base, { cwd } = {}) {
  const range = base ? `${base}...HEAD` : "HEAD~1...HEAD";
  const out = execFileSync("git", ["diff", "--name-only", range], { encoding: "utf8", cwd });
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}

/**
 * Pure decision layer: given the PR's area labels and changed files, decide
 * the outcome and its message. All side effects (console output, process
 * exit code) live only in main() below, which just applies what this
 * returns — keeping the decision testable without shelling out to git.
 */
export function describeResult(labels, changedFiles) {
  const { escaping, schemaViolation, unlabeled } = computeViolations(labels, changedFiles);

  if (schemaViolation) {
    return {
      exitCode: 1,
      level: "error",
      message:
        `scope-guard: FAIL — this PR touches ${SCHEMA_PATH} but is not labeled area:db.\n` +
        `Schema has exactly one writer (G4/data-specialist.md). File an area:db issue with a proposed diff instead.`,
    };
  }

  if (unlabeled) {
    // Fail-closed since issue #141: the SUG-OPS-002 step 3 bake-in week
    // (tuned ~2026-08-17) is long over. An unlabeled PR used to warn and
    // silently skip the scope check entirely (see PR #138) — that gap is
    // closed as of here.
    return {
      exitCode: 1,
      level: "error",
      message:
        "scope-guard: FAIL — no recognized area:* label on this PR; scope cannot be checked.\n" +
        `Add one (or more, for cross-cutting PRs) of: ${Object.keys(AREA_PREFIXES).join(", ")}.`,
    };
  }

  if (escaping.length > 0) {
    return {
      exitCode: 1,
      level: "error",
      message:
        `scope-guard: FAIL — diff touches paths outside the declared area(s) (${labels.join(", ")}):\n` +
        escaping.map((path) => `  - ${path}`).join("\n") +
        `\n\nEither narrow the PR to its declared scope, or add the area:* label(s) that cover these paths.`,
    };
  }

  return {
    exitCode: 0,
    level: "log",
    message: `scope-guard: PASS — all ${changedFiles.length} changed file(s) within declared area(s) (${labels.join(", ")}).`,
  };
}

const CONSOLE_BY_LEVEL = { error: console.error, warn: console.warn, log: console.log };

function main() {
  const labels = parseLabels(process.env.LABELS);
  const changedFiles = getChangedFiles(process.env.BASE);
  const { exitCode, level, message } = describeResult(labels, changedFiles);

  CONSOLE_BY_LEVEL[level](message);
  process.exitCode = exitCode;
}

// Only run when executed directly (not when imported by the test file).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
