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
 * Those paths are intentionally NOT covered here yet — see the note above
 * SHARED_ALLOWED_PREFIXES.
 *
 * Usage (as invoked by .github/workflows/scope-guard.yml):
 *   LABELS="area:ios" BASE=<sha> node scripts/scope-guard.mjs
 *
 * Exit codes: 0 = pass (including warn-and-pass for unlabeled PRs), 1 = fail.
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
  "area:specs": ["docs/specs/", "specs/", ".specify/memory/constitution.md"],
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
export const SHARED_ALLOWED_PREFIXES = ["docs/STATUS.md", "docs/qa/", "pnpm-lock.yaml"];

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

function getChangedFiles(base) {
  const range = base ? `${base}...HEAD` : "HEAD~1...HEAD";
  const out = execFileSync("git", ["diff", "--name-only", range], { encoding: "utf8" });
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}

function main() {
  const labels = parseLabels(process.env.LABELS);
  const changedFiles = getChangedFiles(process.env.BASE);
  const { escaping, schemaViolation, unlabeled } = computeViolations(labels, changedFiles);

  if (schemaViolation) {
    console.error(
      `scope-guard: FAIL — this PR touches ${SCHEMA_PATH} but is not labeled area:db.\n` +
        `Schema has exactly one writer (G4/data-specialist.md). File an area:db issue with a proposed diff instead.`,
    );
    process.exitCode = 1;
    return;
  }

  if (unlabeled) {
    console.warn(
      "scope-guard: WARN — no recognized area:* label on this PR; skipping scope check " +
        "(warn-and-pass mode, see SUG-OPS-002 step 3 — will flip to fail after a bake-in week).",
    );
    return;
  }

  if (escaping.length > 0) {
    console.error(
      `scope-guard: FAIL — diff touches paths outside the declared area(s) (${labels.join(", ")}):\n` +
        escaping.map((path) => `  - ${path}`).join("\n") +
        `\n\nEither narrow the PR to its declared scope, or add the area:* label(s) that cover these paths.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`scope-guard: PASS — all ${changedFiles.length} changed file(s) within declared area(s) (${labels.join(", ")}).`);
}

// Only run when executed directly (not when imported by the test file).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
