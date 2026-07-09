#!/usr/bin/env node
/**
 * Render agent prompts from the single source of truth (/agents/*.md) into
 * the locations each tool requires:
 *
 *   - GitHub Copilot:  .github/copilot-instructions.md          (repo-wide)
 *                      .github/instructions/<area>.instructions.md (path-scoped)
 *   - Claude Code:     .claude/agents/<name>.md  (thin wrappers using @imports —
 *                      Claude Code resolves them, so no content is duplicated)
 *
 * NEVER edit the rendered files by hand — edit /agents/*.md and re-run:
 *   node scripts/render-agents.mjs           # render
 *   node scripts/render-agents.mjs --check   # exit 1 if renders are stale (CI)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

const BANNER = "<!-- RENDERED by scripts/render-agents.mjs from /agents — edit there, then re-run the script. -->";

const AGENTS = [
  {
    name: "ios-specialist",
    source: "agents/ios-specialist.md",
    area: "ios",
    applyTo: "apps/ios/**",
    title: "iOS Native Specialist (area:ios)",
    description:
      "iOS Native Specialist for Swab (area:ios). Use for any work in apps/ios — Swift/SwiftUI (MVVM) screens, the on-device encrypted vault (CryptoKit + Keychain), offline-first features, and their tests. Inherits the RN app's knowledge via docs/migration/rn-native-handoff.md. MUST be used for changes touching apps/ios.",
  },
  {
    name: "android-specialist",
    source: "agents/android-specialist.md",
    area: "android",
    applyTo: "apps/android/**",
    title: "Android Native Specialist (area:android)",
    description:
      "Android Native Specialist for Swab (area:android). Use for any work in apps/android — Kotlin/Jetpack Compose (MVVM) screens, the on-device encrypted vault (Keystore + javax.crypto), offline-first features, and their tests. Inherits the RN app's knowledge via docs/migration/rn-native-handoff.md. MUST be used for changes touching apps/android.",
  },
  {
    name: "backend-specialist",
    source: "agents/backend-systems-specialist.md",
    area: "backend",
    applyTo: "apps/api/**,packages/api-client/**",
    title: "Backend & Systems Specialist (area:api)",
    description:
      "Backend & Systems Specialist for Swab (area:api). Use for any work in apps/api or packages/api-client — Fastify routes, matching engine, auth, vault storage, OpenAPI, and their tests. MUST be used for changes touching apps/api.",
  },
  {
    name: "web-specialist",
    source: "agents/web-frontend-specialist.md",
    area: "web",
    applyTo: "apps/web/**,packages/ui/**",
    title: "Web Frontend Specialist (area:web)",
    description:
      "Web Frontend Specialist for Swab (area:web). Use for any work in apps/web or packages/ui — Next.js landing/invite/account surfaces, shared UI primitives, accessibility, and their tests. MUST be used for changes touching apps/web.",
  },
  {
    name: "data-steward",
    source: "agents/data-specialist.md",
    area: "data",
    applyTo: "packages/db/**",
    title: "Data & Schema Steward (area:db) — SOLE writer of schema.prisma",
    description:
      "Data & Schema Steward for Swab (area:db) — the ONLY agent allowed to edit packages/db/prisma/schema.prisma. Use for schema changes, migrations, seed data, and Prisma client packaging. MUST be used for any change under packages/db.",
  },
  {
    name: "design-specialist",
    source: "agents/design-specialist.md",
    area: "design",
    applyTo: "blueprints/**,docs/design/**",
    title: "Design & Blueprint Specialist (area:design)",
    description:
      "Design & Blueprint Specialist for Swab (area:design). Use for blueprints (HTML prototypes), the Penpot design system and prototype (via the Penpot MCP), the graphic charter « Nuit », design tokens, and design notes feeding /speckit-specify. MUST be used for changes touching blueprints/ or docs/design/.",
  },
  {
    name: "notion-liaison-specialist",
    source: "agents/notion-liaison-specialist.md",
    area: "notion-liaison",
    applyTo: "docs/specs/**",
    title: "Spec ↔ Notion Liaison Specialist (area:notion-liaison)",
    description:
      "Spec ↔ Notion Liaison Specialist for Swab (area:notion-liaison). Use to sync docs/specs/FS-*.md with their French Notion mirror for the non-dev co-founder: checks the live Notion page and comments every invocation, translates changes in both directions, and flags conflicts instead of guessing. MUST be used for changes touching docs/specs/ that also need to reach Notion, or when asked to check/sync Notion.",
  },
  {
    name: "devops-specialist",
    source: "agents/devops-infrastructure-specialist.md",
    area: "devops",
    applyTo: ".github/**,turbo.json,docker-compose.yml,**/Dockerfile,pnpm-workspace.yaml",
    title: "DevOps & Infrastructure Specialist (area:sre)",
    description:
      "DevOps & Infrastructure Specialist for Swab (area:sre). Use for GitHub Actions workflows, turbo.json, Dockerfiles, docker-compose, CODEOWNERS, CI gates, Neon branch lifecycle, and deployment plumbing. MUST be used for changes touching .github/workflows or Docker files.",
  },
];

const read = (p) => readFileSync(join(root, p), "utf8");
const outputs = new Map(); // path -> content

// ---- GitHub Copilot: repo-wide instructions = the global directives, verbatim
const directives = read("agents/_global-directives.md")
  // Drop the source-file preamble block (starts with "> Source of truth"); it's meta.
  .replace(/^> Source of truth[\s\S]*?\n\n/m, "");
outputs.set(
  ".github/copilot-instructions.md",
  `${BANNER}\n${directives.replace(/^# .*$/m, "# Swab (صواب) — Repository Instructions")}`
);

// ---- GitHub Copilot: path-scoped per-area instructions = the specialist file, verbatim
for (const a of AGENTS) {
  const body = read(a.source).replace(/^# .*$/m, `# ${a.title}`);
  outputs.set(
    `.github/instructions/${a.area}.instructions.md`,
    `---\napplyTo: "${a.applyTo}"\n---\n${BANNER}\n${body}`
  );
}

// ---- Claude Code: thin wrappers — @imports pull the same source files at runtime
for (const a of AGENTS) {
  outputs.set(
    `.claude/agents/${a.name}.md`,
    `---\nname: ${a.name}\ndescription: ${a.description}\n---\n${BANNER}\n\nYou are Swab's ${a.title}. Your complete, binding rules — follow them exactly:\n\n@agents/_global-directives.md\n@${a.source}\n\nBefore implementing, read the governing spec(s) in \`docs/specs/\` and quote requirement IDs in test names, branch, and PR title. Your Definition of Done (in the rules above) includes the area changelog entry and, when a module changes state, \`docs/STATUS.md\`.\n`
  );
}

// ---- write or check
let stale = 0;
for (const [rel, content] of outputs) {
  const abs = join(root, rel);
  const current = existsSync(abs) ? readFileSync(abs, "utf8") : null;
  if (current === content) continue;
  if (check) {
    console.error(`STALE: ${rel}`);
    stale++;
  } else {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    console.log(`rendered: ${rel}`);
  }
}

if (check && stale) {
  console.error(`\n${stale} rendered file(s) out of date. Run: node scripts/render-agents.mjs`);
  process.exit(1);
}
if (check) console.log("agent renders up to date");
else console.log(`done (${outputs.size} files)`);
