#!/usr/bin/env node
/**
 * docs-hygiene-lint — enforces G5 (agents/_global-directives.md): "Changelog
 * entries are summaries, not session logs. Target ≤ 15 lines per entry" and
 * "docs/STATUS.md … Keep notes to 1–2 lines; history belongs in changelogs."
 * Those two rules had no mechanical check (unlike render-agents --check,
 * generate.mjs --check, portability-lint, scope-guard) and drifted quietly —
 * one docs/STATUS.md row reached 4,387 chars before this guard existed.
 *
 * Changelogs are append-only history, so this guard never flags entries that
 * predate its own introduction (GRANDFATHER_DATE) — it checks new entries
 * going forward, not old ones. The heading format `## YYYY-MM-DD — title`
 * already carries the date, so this is self-maintaining with no allowlist.
 *
 * Usage: node scripts/docs-hygiene-lint.mjs
 * Exit codes: 0 = clean, 1 = a checked entry/line exceeds its budget.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";

// One place for each threshold — see the module comment for the G5 rule each
// one enforces. Derived from the tree at introduction time (see root
// CHANGELOG.md "[docs-hygiene]" entries), not picked arbitrarily.
export const GRANDFATHER_DATE = "2026-08-15"; // entries before this predate the guard
export const MAX_ENTRY_LINES = 15; // G5: "keep entries ≤ ~15 lines"
export const MAX_STATUS_LINE_CHARS = 450; // G5: "keep notes to 1-2 lines"

/**
 * Pure function: given a changelog's full markdown text, return the entries
 * (heading dated >= grandfatherDate, or unparseable dates skipped as "not
 * this guard's problem") whose body exceeds maxLines.
 *
 * An entry's line count is every line strictly between its `## ` heading and
 * the next `## ` heading (or end of file for the last entry) — i.e. the
 * blank line + bullets a human would read as "the entry".
 */
export function findOversizedEntries(markdown, options = {}) {
  const { grandfatherDate = GRANDFATHER_DATE, maxLines = MAX_ENTRY_LINES } = options;
  const lines = markdown.split("\n");
  const headings = [];
  lines.forEach((line, index) => {
    if (line.startsWith("## ")) headings.push({ index, text: line });
  });

  const oversized = [];
  headings.forEach(({ index, text }, i) => {
    const dateMatch = text.match(/^## (\d{4}-\d{2}-\d{2})\b/);
    if (!dateMatch) return; // malformed/undated heading — not this guard's problem
    if (dateMatch[1] < grandfatherDate) return; // predates the guard, ISO dates sort as strings

    const nextIndex = i + 1 < headings.length ? headings[i + 1].index : lines.length;
    const entryLines = nextIndex - index - 1;
    if (entryLines > maxLines) {
      oversized.push({ heading: text, lines: entryLines });
    }
  });

  return oversized;
}

/**
 * Pure function: given a file's full text, return every line exceeding
 * maxChars ({ line: 1-indexed line number, chars: its length }).
 */
export function findOversizedLines(text, options = {}) {
  const { maxChars = MAX_STATUS_LINE_CHARS } = options;
  const oversized = [];
  text.split("\n").forEach((line, index) => {
    if (line.length > maxChars) {
      oversized.push({ line: index + 1, chars: line.length });
    }
  });
  return oversized;
}

// Root CHANGELOG.md + packages/db/CHANGELOG.md (fixed) + apps/*/CHANGELOG.md
// (globbed, so apps/web/CHANGELOG.md is picked up automatically once it
// exists — no code change needed when a new app lands, per G5).
function listChangelogPaths() {
  const paths = ["CHANGELOG.md"];
  if (existsSync("packages/db/CHANGELOG.md")) paths.push("packages/db/CHANGELOG.md");
  if (existsSync("apps")) {
    for (const dirent of readdirSync("apps", { withFileTypes: true })) {
      if (!dirent.isDirectory()) continue;
      const candidate = `apps/${dirent.name}/CHANGELOG.md`;
      if (existsSync(candidate)) paths.push(candidate);
    }
  }
  return paths;
}

function main() {
  let hasViolations = false;

  for (const path of listChangelogPaths()) {
    const content = readFileSync(path, "utf8");
    for (const { heading, lines } of findOversizedEntries(content)) {
      console.error(`${path}: entry exceeds ${MAX_ENTRY_LINES} lines (${lines}) — ${heading}`);
      hasViolations = true;
    }
  }

  const statusPath = "docs/STATUS.md";
  if (existsSync(statusPath)) {
    const content = readFileSync(statusPath, "utf8");
    for (const { line, chars } of findOversizedLines(content)) {
      console.error(`${statusPath}:${line}: line exceeds ${MAX_STATUS_LINE_CHARS} chars (${chars})`);
      hasViolations = true;
    }
  }

  if (hasViolations) {
    console.error(
      "\ndocs-hygiene-lint: FAIL — G5 (agents/_global-directives.md): changelog entries ≤ 15 " +
        "lines, docs/STATUS.md notes 1-2 lines. Split the PR or trim the entry/row; move detail " +
        "into the PR description or docs/ instead.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("docs-hygiene-lint: PASS.");
}

// Only run when executed directly (not when imported by the test file).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
