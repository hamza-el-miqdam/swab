#!/usr/bin/env node
/**
 * E2E report generator — joins on-device test results with the FS requirement
 * coverage manifest (docs/qa/e2e-coverage.json) and emits Markdown + JSON
 * artifacts under test-results/e2e/.
 *
 * Usage:
 *   node scripts/e2e-report.mjs --android <junit-xml-dir>
 *   node scripts/e2e-report.mjs --ios <path/to/bundle.xcresult>
 *   node scripts/e2e-report.mjs --android <dir> --ios <bundle> [--manifest <json>] [--out <dir>]
 *
 * Exit code is non-zero when any executed test failed OR any requirement the
 * manifest marks `automated` (for a platform included in this run) had no
 * matching executed test — the drift guard that keeps suites and manifest honest.
 *
 * Zero dependencies: JUnit XML is parsed with regexes (the subset Gradle
 * emits), xcresult via `xcrun xcresulttool` JSON output.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------- CLI args
const args = process.argv.slice(2);
const opts = { manifest: join(repoRoot, "docs/qa/e2e-coverage.json"), out: join(repoRoot, "test-results/e2e") };
for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  const val = args[i + 1];
  if (flag === "--android") { opts.android = resolve(val); i++; }
  else if (flag === "--ios") { opts.ios = resolve(val); i++; }
  else if (flag === "--manifest") { opts.manifest = resolve(val); i++; }
  else if (flag === "--out") { opts.out = resolve(val); i++; }
  else { console.error(`Unknown argument: ${flag}`); process.exit(2); }
}
if (!opts.android && !opts.ios) {
  console.error("Provide at least one of --android <junit-xml-dir> or --ios <bundle.xcresult>");
  process.exit(2);
}

// ------------------------------------------------------------ result model
// executed[platform] = Map<"ClassSimpleName.method", {status: "passed"|"failed"|"skipped", durationSec, detail?}>

function xmlDecode(s) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function parseJUnitDir(dir) {
  if (!existsSync(dir)) throw new Error(`Android JUnit dir not found: ${dir}`);
  const tests = new Map();
  const walk = (d) =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".xml") ? [join(d, e.name)] : []
    );
  const files = walk(dir);
  if (files.length === 0) throw new Error(`No JUnit XML files under ${dir}`);
  for (const file of files) {
    const xml = readFileSync(file, "utf8");
    // Match each <testcase .../> or <testcase ...>...</testcase>
    const caseRe = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
    let m;
    while ((m = caseRe.exec(xml))) {
      const attrs = m[1];
      const body = m[2] ?? "";
      const name = xmlDecode(/name="([^"]*)"/.exec(attrs)?.[1] ?? "");
      const classname = xmlDecode(/classname="([^"]*)"/.exec(attrs)?.[1] ?? "");
      const durationSec = Number(/time="([^"]*)"/.exec(attrs)?.[1] ?? 0);
      const simpleClass = classname.split(".").pop();
      let status = "passed";
      let detail;
      const failure = /<(failure|error)\b([^>]*)>/.exec(body);
      if (failure) {
        status = "failed";
        detail = xmlDecode(/message="([^"]*)"/.exec(failure[2])?.[1] ?? failure[1]);
      }
      else if (/<skipped\b/.test(body)) status = "skipped";
      tests.set(`${simpleClass}.${name}`, { status, durationSec, detail });
    }
  }
  return tests;
}

function parseXcresult(bundlePath) {
  if (!existsSync(bundlePath)) throw new Error(`xcresult bundle not found: ${bundlePath}`);
  const raw = execFileSync(
    "xcrun",
    ["xcresulttool", "get", "test-results", "tests", "--path", bundlePath],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  const root = JSON.parse(raw);
  const tests = new Map();
  const walk = (node, suite) => {
    if (!node || typeof node !== "object") return;
    const type = node.nodeType ?? node.type;
    if (type === "Test Case") {
      const method = String(node.name ?? "").replace(/\(\)$/, "");
      const resultStr = String(node.result ?? "").toLowerCase();
      const status = resultStr.includes("pass") ? "passed" : resultStr.includes("skip") ? "skipped" : "failed";
      // duration comes back as a display string like "12s" or "1m 3s"
      let durationSec = 0;
      const d = String(node.duration ?? "");
      const min = /(\d+(?:\.\d+)?)m/.exec(d);
      const sec = /(\d+(?:\.\d+)?)s/.exec(d);
      if (min) durationSec += Number(min[1]) * 60;
      if (sec) durationSec += Number(sec[1]);
      tests.set(`${suite}.${method}`, { status, durationSec, detail: status === "failed" ? node.details : undefined });
      return;
    }
    const nextSuite = type === "Test Suite" ? node.name : suite;
    for (const child of node.children ?? node.testNodes ?? []) walk(child, nextSuite);
  };
  walk({ children: root.testNodes ?? [] }, "");
  if (tests.size === 0) throw new Error(`No test cases found in ${bundlePath} (xcresulttool output shape unexpected?)`);
  return tests;
}

// ------------------------------------------------------------------- join
const manifest = JSON.parse(readFileSync(opts.manifest, "utf8"));
const executed = {};
if (opts.android) executed.android = parseJUnitDir(opts.android);
if (opts.ios) executed.ios = parseXcresult(opts.ios);
const platforms = Object.keys(executed);

// A manifest test entry matches an executed test when the executed key ends
// with "Class.method" (JUnit classnames are fully qualified; manifest uses
// simple class names).
function findExecuted(platform, ref) {
  const map = executed[platform];
  if (map.has(ref)) return map.get(ref);
  for (const [key, val] of map) if (key.endsWith(`.${ref}`) || key === ref) return val;
  return null;
}

const requirements = manifest.requirements ?? {};
const coverage = []; // {id, fs, title, platform, class, state, tests:[{ref,status}]}
const driftMisses = [];
const referenced = Object.fromEntries(platforms.map((p) => [p, new Set()]));

for (const [id, req] of Object.entries(requirements)) {
  for (const platform of platforms) {
    const entry = req[platform];
    if (!entry) continue;
    const row = { id, fs: req.fs, title: req.title, platform, class: entry.status, tests: [], state: entry.status };
    if (entry.status === "automated") {
      const refs = entry.tests ?? [];
      let anyFail = false, anyMissing = false;
      for (const ref of refs) {
        const hit = findExecuted(platform, ref);
        if (!hit) { anyMissing = true; row.tests.push({ ref, status: "MISSING" }); driftMisses.push({ id, platform, ref }); }
        else {
          referenced[platform].add(ref);
          if (hit.status === "failed") anyFail = true;
          row.tests.push({ ref, status: hit.status });
        }
      }
      row.state = refs.length === 0 || anyMissing ? "uncovered" : anyFail ? "covered-failing" : "covered-passing";
      if (refs.length === 0) driftMisses.push({ id, platform, ref: "(no tests listed but status=automated)" });
    }
    coverage.push(row);
  }
}

// Executed tests the manifest doesn't reference (informational)
const unmapped = {};
for (const platform of platforms) {
  unmapped[platform] = [...executed[platform].keys()].filter(
    (key) => ![...referenced[platform]].some((ref) => key.endsWith(`.${ref}`) || key === ref)
  );
}

// ---------------------------------------------------------------- summarize
const totals = {};
for (const platform of platforms) {
  const vals = [...executed[platform].values()];
  totals[platform] = {
    total: vals.length,
    passed: vals.filter((t) => t.status === "passed").length,
    failed: vals.filter((t) => t.status === "failed").length,
    skipped: vals.filter((t) => t.status === "skipped").length,
    durationSec: Math.round(vals.reduce((s, t) => s + (t.durationSec || 0), 0)),
  };
}
const anyTestFailed = platforms.some((p) => totals[p].failed > 0);
const drift = driftMisses.length > 0;
const overall = anyTestFailed || drift ? "FAIL" : "PASS";
const fsModules = [...new Set(coverage.filter((r) => r.state === "covered-passing").map((r) => r.fs))].sort();

const jsonReport = {
  generatedAt: new Date().toISOString(),
  overall,
  platforms: totals,
  featuresVerified: fsModules,
  requirementCoverage: coverage,
  drift: driftMisses,
  unmappedTests: unmapped,
};

// ---------------------------------------------------------------- markdown
const stateIcon = {
  "covered-passing": "✅", "covered-failing": "❌", uncovered: "🚨",
  manual: "📝", "unit-covered": "🧪", "api-integration": "🌐", "not-e2e-verifiable": "➖",
};
let md = `# E2E test report — ${overall}\n\nGenerated: ${jsonReport.generatedAt}\n\n`;
md += `## Execution results\n\n| Platform | Total | Passed | Failed | Skipped | Duration |\n|---|---|---|---|---|---|\n`;
for (const p of platforms) {
  const t = totals[p];
  md += `| ${p} | ${t.total} | ${t.passed} | ${t.failed} | ${t.skipped} | ${t.durationSec}s |\n`;
}
if (anyTestFailed) {
  md += `\n### Failures\n\n`;
  for (const p of platforms)
    for (const [key, t] of executed[p])
      if (t.status === "failed") md += `- **${p}** \`${key}\`${t.detail ? ` — ${String(t.detail).slice(0, 300)}` : ""}\n`;
}
md += `\n## Features verified (all automated requirements passing)\n\n${fsModules.length ? fsModules.map((f) => `- ${f}`).join("\n") : "- none"}\n`;
md += `\n## Requirement coverage\n\n| Req | FS | Platform | Class | State | Tests |\n|---|---|---|---|---|---|\n`;
for (const row of coverage) {
  const tests = row.tests.length
    ? row.tests.map((t) => `\`${t.ref.split(".").pop()}\` (${t.status})`).join("<br>")
    : "—";
  md += `| ${row.id} | ${row.fs} | ${row.platform} | ${row.class} | ${stateIcon[row.state] ?? ""} ${row.state} | ${tests} |\n`;
}
if (drift) {
  md += `\n## 🚨 Drift guard failures\n\nRequirements marked \`automated\` whose tests did not run — fix the suite or the manifest:\n\n`;
  for (const d of driftMisses) md += `- ${d.id} (${d.platform}): \`${d.ref}\`\n`;
}
const unmappedAll = platforms.flatMap((p) => unmapped[p].map((k) => `- ${p}: \`${k}\``));
if (unmappedAll.length) {
  md += `\n## Unmapped executed tests (not referenced by the manifest — consider mapping them)\n\n${unmappedAll.join("\n")}\n`;
}
md += `\nSee \`docs/qa/e2e-scenarios.md\` for the scenario behind each requirement ID and \`docs/qa/e2e-coverage.json\` for the manifest.\n`;

// -------------------------------------------------------------------- emit
mkdirSync(opts.out, { recursive: true });
writeFileSync(join(opts.out, "e2e-report.json"), JSON.stringify(jsonReport, null, 2));
writeFileSync(join(opts.out, "e2e-report.md"), md);
console.log(md);
console.log(`\nReport written to ${join(opts.out, "e2e-report.md")} and .json — overall: ${overall}`);
process.exit(overall === "PASS" ? 0 : 1);
