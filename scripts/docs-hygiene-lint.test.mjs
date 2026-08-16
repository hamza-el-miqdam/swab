// Table-driven unit tests for scripts/docs-hygiene-lint.mjs's pure functions.
// Run with: node --test scripts/docs-hygiene-lint.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { findOversizedEntries, findOversizedLines, GRANDFATHER_DATE, MAX_ENTRY_LINES, MAX_STATUS_LINE_CHARS, findOversizedFile, MAX_CHANGELOG_CHARS } from "./docs-hygiene-lint.mjs";

// Builds a changelog string from [{ date, title, body }], where body is the
// exact array of lines between the heading and the next one (or EOF). This
// makes each entry's expected line count exactly body.length — see the
// findOversizedEntries doc comment for why that's the right definition.
function buildChangelog(entries) {
  const lines = [];
  for (const { date, title, body } of entries) {
    lines.push(`## ${date} — ${title}`);
    lines.push(...body);
  }
  return lines.join("\n");
}

function bullets(n) {
  return Array.from({ length: n }, (_, i) => `- bullet ${i + 1}`);
}

test("an entry within the line budget passes", () => {
  const markdown = buildChangelog([
    { date: GRANDFATHER_DATE, title: "ok entry", body: ["", ...bullets(12)] }, // 13 lines
  ]);
  assert.deepEqual(findOversizedEntries(markdown), []);
});

test("an entry exactly at the budget passes (not strictly greater)", () => {
  const markdown = buildChangelog([
    { date: GRANDFATHER_DATE, title: "exactly at limit", body: ["", ...bullets(MAX_ENTRY_LINES - 1)] },
  ]);
  assert.deepEqual(findOversizedEntries(markdown), []);
});

test("an entry over the budget fails", () => {
  const markdown = buildChangelog([
    { date: GRANDFATHER_DATE, title: "too long", body: ["", ...bullets(16), ""] }, // 18 lines
  ]);
  const oversized = findOversizedEntries(markdown);
  assert.equal(oversized.length, 1);
  assert.equal(oversized[0].lines, 18);
  assert.match(oversized[0].heading, /too long/);
});

test("an oversized entry dated before the grandfather date passes (history is not rewritten)", () => {
  const markdown = buildChangelog([
    { date: "2026-08-14", title: "old and long", body: ["", ...bullets(20), ""] },
  ]);
  assert.deepEqual(findOversizedEntries(markdown), []);
});

test("an oversized entry dated exactly on the grandfather date fails (boundary)", () => {
  const markdown = buildChangelog([
    { date: GRANDFATHER_DATE, title: "new and long", body: ["", ...bullets(20), ""] },
  ]);
  const oversized = findOversizedEntries(markdown);
  assert.equal(oversized.length, 1);
  assert.match(oversized[0].heading, /new and long/);
});

test("a heading with no parseable date is skipped, not crashed on", () => {
  const markdown = buildChangelog([{ date: "Unreleased", title: "no date yet", body: ["", ...bullets(30), ""] }]);
  assert.doesNotThrow(() => findOversizedEntries(markdown));
  assert.deepEqual(findOversizedEntries(markdown), []);
});

test("multiple entries: only the oversized, non-grandfathered ones are reported", () => {
  const markdown = buildChangelog([
    { date: "2026-08-01", title: "old + long, skipped", body: ["", ...bullets(20)] },
    { date: GRANDFATHER_DATE, title: "new + short, passes", body: ["", ...bullets(5)] },
    { date: "2026-08-20", title: "new + long, fails", body: ["", ...bullets(18)] },
  ]);
  const oversized = findOversizedEntries(markdown);
  assert.equal(oversized.length, 1);
  assert.match(oversized[0].heading, /new \+ long, fails/);
});

test("findOversizedLines flags a line over the char budget", () => {
  const line = "x".repeat(MAX_STATUS_LINE_CHARS + 1);
  const oversized = findOversizedLines(`short line\n${line}\n`);
  assert.equal(oversized.length, 1);
  assert.equal(oversized[0].line, 2);
  assert.equal(oversized[0].chars, MAX_STATUS_LINE_CHARS + 1);
});

test("findOversizedLines passes a line exactly at the char budget (boundary)", () => {
  const line = "x".repeat(MAX_STATUS_LINE_CHARS);
  const oversized = findOversizedLines(`short line\n${line}\n`);
  assert.deepEqual(oversized, []);
});

test("thresholds are exported and sane", () => {
  assert.equal(typeof GRANDFATHER_DATE, "string");
  assert.match(GRANDFATHER_DATE, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(MAX_ENTRY_LINES > 0);
  assert.ok(MAX_STATUS_LINE_CHARS > 0);
});

test("whole-file cap: a changelog within budget passes", () => {
  assert.equal(findOversizedFile("## 2026-08-16 — small\n\n- fine\n"), null);
});

test("whole-file cap: an oversized changelog is reported with its size", () => {
  const huge = "x".repeat(MAX_CHANGELOG_CHARS + 1);
  const result = findOversizedFile(huge);
  assert.ok(result, "expected a violation");
  assert.equal(result.max, MAX_CHANGELOG_CHARS);
  assert.equal(result.chars, MAX_CHANGELOG_CHARS + 1);
});

test("whole-file cap: exactly at the budget is allowed (boundary)", () => {
  assert.equal(findOversizedFile("x".repeat(MAX_CHANGELOG_CHARS)), null);
});

test("whole-file cap: the threshold is overridable for testing", () => {
  assert.ok(findOversizedFile("xxxxx", { maxChars: 4 }));
  assert.equal(findOversizedFile("xxxxx", { maxChars: 5 }), null);
});

test("whole-file cap is independent of per-entry compliance", () => {
  // The real failure mode: every entry compliant, file still enormous.
  const entry = "## 2026-08-16 — ok\n\n- one line\n\n";
  const many = entry.repeat(Math.ceil((MAX_CHANGELOG_CHARS + 1) / entry.length));
  assert.equal(findOversizedEntries(many).length, 0, "no entry should be oversized");
  assert.ok(findOversizedFile(many), "but the file should be");
});
