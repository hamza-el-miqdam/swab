#!/usr/bin/env node
/**
 * portability-lint — enforces G4: "No Vercel-proprietary APIs … no
 * Neon-specific SQL anywhere in app code — AWS portability is a hard
 * requirement" (agents/_global-directives.md), and the devops project rule
 * that commits to enforcing it: "portability lint greps diffs for
 * @vercel/kv, @vercel/blob, @vercel/edge-config, and Neon-specific SQL and
 * fails the check-run" (agents/devops-infrastructure-specialist.md).
 *
 * Scans the full tracked tree (not just the diff) under apps/, packages/,
 * tools/ — stricter and simpler than diff-grepping, and starts green today.
 * Docs/agents/.github are excluded on purpose: they legitimately name these
 * patterns as *prohibitions*, which would otherwise self-trigger.
 *
 * Usage: node scripts/portability-lint.mjs
 * Exit codes: 0 = clean, 1 = forbidden pattern found (prints file:line).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Keep this list surgical (one const, one place) — add a pattern here when a
// new Vercel-proprietary API or Neon-specific construct needs blocking.
export const FORBIDDEN_PATTERNS = [
  { name: "@vercel/kv", regex: /@vercel\/kv/ },
  { name: "@vercel/blob", regex: /@vercel\/blob/ },
  { name: "@vercel/edge-config", regex: /@vercel\/edge-config/ },
  { name: "Vercel KV REST endpoint", regex: /kv\.vercel-storage\.com/ },
  { name: "neon.tech hostname", regex: /neon\.tech/ },
  { name: "@neondatabase/serverless", regex: /@neondatabase\/serverless/ },
  { name: "pg_embedding (Neon-specific extension)", regex: /pg_embedding/ },
];

// Only scan these top-level app/runtime directories — never docs/, agents/,
// .github/ (which legitimately document/prohibit these strings by name).
const SCAN_PREFIXES = ["apps/", "packages/", "tools/"];

/**
 * Pure function: given a relative file path and its text content, return
 * the list of violations found ({ pattern, line, text }). No I/O.
 */
export function findViolations(filePath, content) {
  const violations = [];
  const lines = content.split("\n");
  for (const { name, regex } of FORBIDDEN_PATTERNS) {
    lines.forEach((lineText, index) => {
      if (regex.test(lineText)) {
        violations.push({ pattern: name, line: index + 1, text: lineText.trim() });
      }
    });
  }
  return violations;
}

/**
 * Pure function: should this tracked repo-relative path be scanned at all?
 * Excludes markdown and anything outside the runtime code prefixes.
 */
export function shouldScan(filePath) {
  if (filePath.endsWith(".md")) return false;
  return SCAN_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

function listTrackedFiles() {
  const out = execFileSync("git", ["ls-files"], { encoding: "utf8" });
  return out.split("\n").map((line) => line.trim()).filter(Boolean);
}

function main() {
  const files = listTrackedFiles().filter(shouldScan);
  const violationsByFile = [];

  for (const filePath of files) {
    let content;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      continue; // binary or unreadable (e.g. deleted-but-staged edge case) — skip
    }
    const violations = findViolations(filePath, content);
    if (violations.length > 0) {
      violationsByFile.push({ filePath, violations });
    }
  }

  if (violationsByFile.length > 0) {
    console.error("portability-lint: FAIL — forbidden Vercel/Neon-proprietary pattern(s) found (G4):\n");
    for (const { filePath, violations } of violationsByFile) {
      for (const v of violations) {
        console.error(`  ${filePath}:${v.line}: ${v.pattern} — ${v.text}`);
      }
    }
    console.error(
      "\nNo Vercel-proprietary APIs, no Neon-specific SQL/hostnames — AWS portability is a hard " +
        "requirement (agents/_global-directives.md, G4).",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`portability-lint: PASS — ${files.length} file(s) scanned, no forbidden patterns.`);
}

// Only run when executed directly (not when imported by the test file).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
