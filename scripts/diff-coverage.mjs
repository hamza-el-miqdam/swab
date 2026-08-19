#!/usr/bin/env node
/**
 * diff-coverage — line coverage of the lines a PR actually changed.
 *
 * G2 sets a floor of 80% line coverage on changed *packages*, enforced per
 * package by vitest. That floor is necessary but not sufficient: a package
 * sitting at 85% can absorb an entirely untested new function and stay green,
 * because the denominator is the whole package. This measures the other axis —
 * of the executable lines this branch added or modified, how many does the
 * suite actually execute?
 *
 * Non-executable changed lines (comments, blank lines, type-only declarations)
 * carry no DA record in lcov and are excluded from the denominator: counting
 * them would let a well-commented patch score badly and a dense one score well,
 * which measures formatting rather than testing.
 *
 * Usage:
 *   node scripts/diff-coverage.mjs                       # vs origin/main, default lcov paths
 *   node scripts/diff-coverage.mjs --base <ref>          # compare against another ref
 *   node scripts/diff-coverage.mjs --lcov <path> ...     # explicit lcov file(s)
 *   node scripts/diff-coverage.mjs --threshold 70        # failure floor (default 70)
 *
 * Coverage must already exist — run the suites first (e.g.
 * `pnpm --filter @repo/api test`), which writes `coverage/lcov.info`.
 *
 * Exit codes: 0 = at or above threshold (or nothing eligible), 1 = below.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, relative, isAbsolute, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Packages that emit lcov today. Add a package here when it gains a coverage
// config — the script scores whatever it finds and reports what it did not.
export const DEFAULT_LCOV_PATHS = ["apps/api/coverage/lcov.info"];

export const DEFAULT_THRESHOLD = 70;

/**
 * Pure: the directory an lcov file's relative SF paths are anchored to —
 * the package root, i.e. the file's directory minus a trailing `coverage/`.
 */
export function packageRootForLcov(lcovPath) {
  const dir = dirname(lcovPath);
  return basename(dir) === "coverage" ? dirname(dir) : dir;
}

/**
 * Pure: parse lcov text into `Map<repoRelativePath, Map<line, hits>>`.
 *
 * SF paths come in two flavours and both must land on repo-relative keys, or
 * they never join against `git diff`'s paths and every changed line silently
 * reads as non-executable: absolute paths are relativized against `rootDir`,
 * while relative ones (vitest/v8 writes `src/app.ts`) resolve against
 * `baseDir` — the owning package root.
 *
 * Repeated records for one file are merged by taking the highest hit count.
 */
export function parseLcov(text, rootDir, baseDir = rootDir) {
  const files = new Map();
  let current = null;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("SF:")) {
      const sf = line.slice(3);
      const abs = isAbsolute(sf) ? sf : resolve(baseDir, sf);
      const key = relative(rootDir, abs).split("\\").join("/");
      if (!files.has(key)) files.set(key, new Map());
      current = files.get(key);
    } else if (line.startsWith("DA:") && current) {
      const [lineNo, hits] = line.slice(3).split(",");
      const n = Number(lineNo);
      const h = Number(hits);
      if (!Number.isFinite(n) || !Number.isFinite(h)) continue;
      current.set(n, Math.max(current.get(n) ?? 0, h));
    } else if (line === "end_of_record") {
      current = null;
    }
  }
  return files;
}

/**
 * Pure: parse `git diff` output into `Map<repoRelativePath, Set<newSideLine>>`,
 * holding only lines added or modified on the new side. Deleted files are
 * skipped (nothing to cover). Works with any -U value, including -U0.
 */
export function parseDiffLines(diffText) {
  const files = new Map();
  let file = null;
  let newLine = 0;
  for (const line of diffText.split("\n")) {
    if (line.startsWith("+++ ")) {
      const path = line.slice(4).trim();
      file = path === "/dev/null" ? null : path.replace(/^b\//, "");
      continue;
    }
    if (line.startsWith("@@")) {
      // @@ -old,count +new,count @@  — the count is optional and defaults to 1.
      const m = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (m) newLine = Number(m[1]);
      continue;
    }
    if (!file) continue;
    if (line.startsWith("+")) {
      if (!files.has(file)) files.set(file, new Set());
      files.get(file).add(newLine);
      newLine++;
    } else if (line.startsWith("-")) {
      // consumes no new-side line
    } else if (line.startsWith(" ")) {
      newLine++;
    }
  }
  return files;
}

/**
 * Pure: intersect changed lines with instrumented lines and score them.
 * Files with no coverage data are reported separately rather than scored as
 * zero — they are usually docs, config, or code outside a coverage `include`.
 */
export function computeDiffCoverage(changedByFile, coverageByFile) {
  let eligible = 0;
  let covered = 0;
  const uncovered = [];
  const skippedFiles = [];

  for (const [file, lines] of [...changedByFile].sort(([a], [b]) => a.localeCompare(b))) {
    const fileCoverage = coverageByFile.get(file);
    if (!fileCoverage) {
      skippedFiles.push(file);
      continue;
    }
    for (const line of [...lines].sort((a, b) => a - b)) {
      if (!fileCoverage.has(line)) continue; // not executable — not our business
      eligible++;
      if (fileCoverage.get(line) > 0) covered++;
      else uncovered.push({ file, line });
    }
  }

  const pct = eligible === 0 ? null : Math.round((covered / eligible) * 10000) / 100;
  return { eligible, covered, pct, uncovered, skippedFiles };
}

function main() {
  const argv = process.argv.slice(2);
  const readOpt = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return i === -1 ? fallback : argv[i + 1];
  };
  const base = readOpt("--base", "origin/main");
  const threshold = Number(readOpt("--threshold", String(DEFAULT_THRESHOLD)));
  const lcovPaths = argv.reduce(
    (acc, arg, i) => (arg === "--lcov" ? [...acc, argv[i + 1]] : acc),
    []
  );
  const paths = (lcovPaths.length ? lcovPaths : DEFAULT_LCOV_PATHS).filter((p) =>
    existsSync(join(root, p))
  );

  if (paths.length === 0) {
    console.error(
      "diff-coverage: no lcov file found. Run the suites first (e.g. `pnpm --filter @repo/api test`),\n" +
        `or pass --lcov <path>. Looked for: ${DEFAULT_LCOV_PATHS.join(", ")}`
    );
    process.exitCode = 1;
    return;
  }

  const coverage = new Map();
  for (const p of paths) {
    const baseDir = join(root, packageRootForLcov(p));
    for (const [file, lines] of parseLcov(readFileSync(join(root, p), "utf8"), root, baseDir)) {
      const merged = coverage.get(file) ?? new Map();
      for (const [line, hits] of lines) merged.set(line, Math.max(merged.get(line) ?? 0, hits));
      coverage.set(file, merged);
    }
  }

  const diff = execFileSync("git", ["diff", "--unified=0", `${base}...HEAD`], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const result = computeDiffCoverage(parseDiffLines(diff), coverage);

  if (result.eligible === 0) {
    console.log(
      `diff-coverage: no executable changed lines under coverage (vs ${base}) — nothing to score.`
    );
    return;
  }

  console.log(
    `diff-coverage: ${result.pct}% of changed executable lines covered ` +
      `(${result.covered}/${result.eligible}, vs ${base}, threshold ${threshold}%).`
  );

  if (result.uncovered.length > 0) {
    console.log("\nUncovered changed lines:");
    for (const { file, line } of result.uncovered.slice(0, 50)) console.log(`  ${file}:${line}`);
    if (result.uncovered.length > 50) {
      console.log(`  … and ${result.uncovered.length - 50} more`);
    }
  }

  if (result.pct < threshold) {
    console.error(
      `\ndiff-coverage: FAIL — ${result.pct}% is below the ${threshold}% floor for changed lines (G2).`
    );
    process.exitCode = 1;
  }
}

// Only run when executed directly (not when imported by the test file).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
