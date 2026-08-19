// Table-driven unit tests for scripts/diff-coverage.mjs's pure functions.
// Run with: node --test scripts/diff-coverage.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseLcov,
  parseDiffLines,
  computeDiffCoverage,
  packageRootForLcov,
} from "./diff-coverage.mjs";

// ---------------------------------------------------------------- parseLcov

test("parseLcov reads DA records into file → line → hits", () => {
  const lcov = [
    "TN:",
    "SF:/repo/apps/api/src/a.ts",
    "DA:1,5",
    "DA:2,0",
    "end_of_record",
    "SF:/repo/apps/api/src/b.ts",
    "DA:7,1",
    "end_of_record",
    "",
  ].join("\n");
  const got = parseLcov(lcov, "/repo");
  assert.deepEqual([...got.keys()].sort(), ["apps/api/src/a.ts", "apps/api/src/b.ts"]);
  assert.equal(got.get("apps/api/src/a.ts").get(1), 5);
  assert.equal(got.get("apps/api/src/a.ts").get(2), 0);
  assert.equal(got.get("apps/api/src/b.ts").get(7), 1);
});

test("parseLcov accepts paths already relative to the repo root", () => {
  const got = parseLcov("SF:apps/api/src/a.ts\nDA:3,2\nend_of_record\n", "/repo");
  assert.equal(got.get("apps/api/src/a.ts").get(3), 2);
});

test("parseLcov sums hits when a line appears in several records", () => {
  const lcov =
    "SF:/repo/x.ts\nDA:1,0\nend_of_record\nSF:/repo/x.ts\nDA:1,4\nend_of_record\n";
  assert.equal(parseLcov(lcov, "/repo").get("x.ts").get(1), 4);
});

test("parseLcov resolves package-relative SF paths against the package root", () => {
  // vitest/v8 writes SF paths relative to the package (its vitest root), e.g.
  // "src/app.ts" inside apps/api/coverage/lcov.info — while git diff speaks in
  // repo-relative paths. Without this the two never join and every changed line
  // looks non-executable.
  const got = parseLcov("SF:src/app.ts\nDA:4,1\nend_of_record\n", "/repo", "/repo/apps/api");
  assert.deepEqual([...got.keys()], ["apps/api/src/app.ts"]);
  assert.equal(got.get("apps/api/src/app.ts").get(4), 1);
});

test("packageRootForLcov strips a trailing coverage/ directory", () => {
  assert.equal(packageRootForLcov("apps/api/coverage/lcov.info"), "apps/api");
  assert.equal(packageRootForLcov("packages/db/coverage/lcov.info"), "packages/db");
});

test("packageRootForLcov falls back to the file's own directory", () => {
  assert.equal(packageRootForLcov("apps/api/lcov.info"), "apps/api");
});

// ----------------------------------------------------------- parseDiffLines

test("parseDiffLines returns only added lines on the new side", () => {
  const diff = [
    "diff --git a/apps/api/src/a.ts b/apps/api/src/a.ts",
    "--- a/apps/api/src/a.ts",
    "+++ b/apps/api/src/a.ts",
    "@@ -10,0 +11,2 @@",
    "+const x = 1;",
    "+const y = 2;",
    "",
  ].join("\n");
  const got = parseDiffLines(diff);
  assert.deepEqual([...got.get("apps/api/src/a.ts")], [11, 12]);
});

test("parseDiffLines advances past context lines and ignores removals", () => {
  const diff = [
    "diff --git a/x.ts b/x.ts",
    "+++ b/x.ts",
    "@@ -5,3 +5,3 @@",
    " context",
    "-gone",
    "+added",
    "",
  ].join("\n");
  // context occupies new-side line 5; the removal consumes no new-side line;
  // so the added line is 6.
  assert.deepEqual([...parseDiffLines(diff).get("x.ts")], [6]);
});

test("parseDiffLines handles several hunks in one file", () => {
  const diff = [
    "diff --git a/x.ts b/x.ts",
    "+++ b/x.ts",
    "@@ -1,0 +1,1 @@",
    "+a",
    "@@ -20,0 +30,2 @@",
    "+b",
    "+c",
    "",
  ].join("\n");
  assert.deepEqual([...parseDiffLines(diff).get("x.ts")], [1, 30, 31]);
});

test("parseDiffLines skips deleted files (+++ /dev/null)", () => {
  const diff = [
    "diff --git a/gone.ts b/gone.ts",
    "--- a/gone.ts",
    "+++ /dev/null",
    "@@ -1,2 +0,0 @@",
    "-a",
    "-b",
    "",
  ].join("\n");
  assert.equal(parseDiffLines(diff).size, 0);
});

test("parseDiffLines treats a hunk header without a count as one line", () => {
  const diff = ["diff --git a/x.ts b/x.ts", "+++ b/x.ts", "@@ -3 +3 @@", "+only", ""].join("\n");
  assert.deepEqual([...parseDiffLines(diff).get("x.ts")], [3]);
});

// ------------------------------------------------------- computeDiffCoverage

test("computeDiffCoverage counts only changed lines that are executable", () => {
  // Lines 1 and 2 changed; only line 1 is instrumented (line 2 is a comment,
  // so it has no DA record and must not land in the denominator).
  const changed = new Map([["x.ts", new Set([1, 2])]]);
  const coverage = new Map([["x.ts", new Map([[1, 3]])]]);
  const got = computeDiffCoverage(changed, coverage);
  assert.equal(got.eligible, 1);
  assert.equal(got.covered, 1);
  assert.equal(got.pct, 100);
  assert.deepEqual(got.uncovered, []);
});

test("computeDiffCoverage reports uncovered changed lines with their file", () => {
  const changed = new Map([["x.ts", new Set([1, 2, 3])]]);
  const coverage = new Map([["x.ts", new Map([[1, 1], [2, 0], [3, 0]])]]);
  const got = computeDiffCoverage(changed, coverage);
  assert.equal(got.eligible, 3);
  assert.equal(got.covered, 1);
  assert.equal(got.pct, 33.33);
  assert.deepEqual(got.uncovered, [
    { file: "x.ts", line: 2 },
    { file: "x.ts", line: 3 },
  ]);
});

test("computeDiffCoverage ignores files with no coverage data at all", () => {
  // A changed file outside any coverage `include` (e.g. a .md or a config)
  // must not be scored — it would otherwise read as 0%.
  const changed = new Map([["README.md", new Set([1, 2])]]);
  const got = computeDiffCoverage(changed, new Map());
  assert.equal(got.eligible, 0);
  assert.equal(got.pct, null);
  assert.deepEqual(got.skippedFiles, ["README.md"]);
});

test("computeDiffCoverage yields pct null when nothing is eligible", () => {
  const got = computeDiffCoverage(new Map(), new Map());
  assert.equal(got.eligible, 0);
  assert.equal(got.covered, 0);
  assert.equal(got.pct, null);
});

test("computeDiffCoverage aggregates across several files", () => {
  const changed = new Map([
    ["a.ts", new Set([1, 2])],
    ["b.ts", new Set([5])],
  ]);
  const coverage = new Map([
    ["a.ts", new Map([[1, 1], [2, 0]])],
    ["b.ts", new Map([[5, 9]])],
  ]);
  const got = computeDiffCoverage(changed, coverage);
  assert.equal(got.eligible, 3);
  assert.equal(got.covered, 2);
  assert.equal(got.pct, 66.67);
});
