# Changelog — repo root (area:devops · docs · agents · tooling · cross-cutting)

> Newest first. Changes that don't belong to a single app/package: CI/CD, docker, docs, agent prompts, scripts, workspace config.
> Per-area history: [apps/mobile](apps/mobile/CHANGELOG.md) · [apps/api](apps/api/CHANGELOG.md) · [packages/db](packages/db/CHANGELOG.md).
> Format: `## YYYY-MM-DD — title` then bullets. Agents: updating the right changelog is part of your Definition of Done (G4.7).

## 2026-07-12 — Wave 4: mobile E2E testing made a hard Definition-of-Done gate

- **What:** every functional requirement of the implemented specs (FS-01/02/03/07, ~40 requirement
  IDs) now has a scenario in new `docs/qa/e2e-scenarios.md` and a machine-readable verification-class
  entry in new `docs/qa/e2e-coverage.json` (`automated` / `unit-covered` / `api-integration` /
  `manual` / `not-e2e-verifiable` — honest classification, nothing silently dropped). New
  `scripts/e2e-report.mjs` (zero new dependencies — regex JUnit-XML parsing + `xcrun xcresulttool`
  shellout) joins on-device test results against that manifest and emits `test-results/e2e/e2e-report.{md,json}`,
  with a **drift guard**: the run fails if any requirement marked `automated` has no matching
  executed test, not just if a test fails. New wrapper entry points `scripts/e2e-android.sh` /
  `scripts/e2e-ios.sh` are the one-command gate (preflight API health + device check → full suite →
  report). `test-results/` and `*.xcresult` added to `.gitignore` — generated per run, never
  committed.
- **Why:** Waves 1–3 shipped strong unit coverage but the functional test doc (`docs/manual_tests/`)
  was a wave behind and mapped only to feature level, not requirement IDs; there was no automated
  on-device suite, no generated report, and nothing in the agents' Definition of Done required E2E
  before calling a task done.
- **Agent workflow guardrail:** `agents/_global-directives.md` (G2), `agents/ios-specialist.md`, and
  `agents/android-specialist.md` now require the platform's full E2E suite green via the wrapper
  scripts (report PASS, zero drift) before Done, with the report summary pasted into the PR; new/
  changed user-facing requirements update the scenario doc + manifest in the same PR.
  `docs/agent-playbook.md` §3/§5 updated to match. Rendered copies (`.github/`, `.claude/agents/`)
  regenerated via `node scripts/render-agents.mjs` — `--check` passes.
- **Platform suites landed and independently re-verified from clean by the lead** (not just agent
  self-report): Android 16/16 (`./gradlew :app:clean :app:connectedDebugAndroidTest`), iOS 13/13
  (`xcodebuild test`). Full detail in `apps/android/CHANGELOG.md` / `apps/ios/CHANGELOG.md` and
  `docs/migration/rn-audit-map.md`'s new Wave 4 section. Notably, the iOS suite exposed a real bug —
  `project.pbxproj` had code signing fully disabled since the Wave-1 app-shell scaffold (fine for
  bare `xcrun swift test`, but an unsigned app process has no Keychain entitlements once actually
  run via XCUITest); fixed with ad hoc signing (`CODE_SIGN_IDENTITY = "-"`, Simulator-only).
- **Doc truth-up:** FS-01/02/07 `Status:` headers flipped `Approved` → `Implemented` (they'd landed
  in Wave 1 but G5's header-flip step was missed at the time); FS-03's header corrected (said
  "Android parity pending" — Android landed in Wave 3). `docs/manual_tests/README.md` now points at
  the new suite as the binding gate, keeping itself as a manual/exploratory smoke-test doc.
- **Deferred (follow-up, not built this wave):** wiring the E2E gate into GitHub Actions CI (needs a
  macOS runner for XCUITest and a Linux/KVM emulator runner for `connectedAndroidTest` — cost/setup
  tradeoff, scoped to `area:sre`/devops-specialist, `.github/workflows` only). The gate today is
  local and agent-enforced, not yet machine-enforced on every PR.
- **Gotchas:** the iOS/Android Simulator/emulator can silently shut down between sessions —
  `xcrun simctl list devices booted` / `adb devices` should be checked before assuming either wrapper
  script will find a target. Docker Desktop does not auto-start the daemon on `docker compose up` if
  it isn't already running (`open -a Docker` first, then poll `docker info`).

## 2026-07-09 — Native migration Phase 1: iOS + Android specialists replace the Mobile (Expo RN) specialist

- **Decision:** Swab's mobile client moves from cross-platform Expo/React Native to fully native `apps/ios` (Swift/SwiftUI, MVVM) and `apps/android` (Kotlin/Jetpack Compose, MVVM). `apps/mobile` stays in the repo as the **frozen reference implementation** (read-only except critical fixes) until each module reaches native parity; it will be removed in a later PR. First migration target: FS-07 Identity & Vault + FS-01 Onboarding.
- **Knowledge inheritance before decommission:** the Mobile Engineering Specialist's complete context — feature inventory, binary contracts (AES-256-GCM vault wire format `base64(IV‖TAG‖CT)`, phone-hash `sha256("SALT:E164")`, API shapes, sync semantics), business rules, product ethos, known divergences, and RN-only gotchas — is captured in `docs/migration/rn-native-handoff.md`. Both new agent files import it as binding.
- New `docs/migration/vault-test-vectors.json` — crypto vectors generated from the RN reference implementation (node:crypto, API-identical to react-native-quick-crypto). Both native crypto cores must reproduce every vector exactly before building on top; this file is the objective "knowledge transfer verified" gate.
- Added `agents/ios-specialist.md` (area:ios, scope `apps/ios/**`) and `agents/android-specialist.md` (area:android, scope `apps/android/**`); registered in `scripts/render-agents.mjs` → `.github/instructions/{ios,android}.instructions.md` + `.claude/agents/{ios,android}-specialist.md`.
- Decommissioned the Mobile Engineering Specialist: removed from the `AGENTS` registry, deleted `agents/mobile-specialist.md` and its rendered copies (`.claude/agents/mobile-specialist.md`, `.github/instructions/mobile.instructions.md` — the render script never cleans up orphans, so this is manual by design).
- Docs updated to stay truthful: `agents/_global-directives.md` project description + G5 changelog locations, `CLAUDE.md`, `docs/STATUS.md`, `apps/mobile/CHANGELOG.md` freeze banner. `.specify/memory/constitution.md` still mirrors the pre-migration directives — **follow-up: re-run `/speckit-constitution` to resync** (global directives win on conflict, per governance).
- **Gotchas:** new Claude Code subagents are only picked up after a session restart. `apps/ios`/`apps/android` and their changelogs do not exist yet — they land with the Phase 2 scaffold PR, deliberately kept out of the turbo/pnpm pipeline (CI wiring is an `area:sre` follow-up).

## 2026-07-09 — New agent: Spec ↔ Notion Liaison Specialist (area:notion-liaison) + French spec mirror

- Added `agents/notion-liaison-specialist.md` — seventh specialist, the only bridge between `docs/specs/FS-*.md` (English, code-canonical) and a French mirror in Notion for the non-dev co-founder to read, comment on, and edit directly. Registered in `scripts/render-agents.mjs`; renders to `.github/instructions/notion-liaison.instructions.md` and `.claude/agents/notion-liaison-specialist.md`.
- Created the Notion structure: parent page "Swab — Spécifications (FS-*)" with one French subpage per FS-01…07, each carrying a "source canonique" note pointing back to its code file. Requirement IDs (ONB-01, MAP-03, …) preserved verbatim as translation anchors.
- New `docs/specs/.notion-sync.json` — sync-state file the agent owns. Stores full content snapshots (English + French, not hashes) per spec so the agent can diff by direct comparison. **Mandatory behavior:** every invocation re-fetches the live Notion page and comments before doing anything else — never assumes the last-synced snapshot is still current.
- **Design decision:** the co-founder can freely edit French text or comment (not comment-only) — free edit was chosen over the safer comment-only default. To offset that risk: code remains canonical (per CLAUDE.md), and if both the code and the Notion page changed since the last sync, the agent stops and reports the conflict instead of picking a side (G4 ambiguity rule extended to two-way doc sync).
- **Gotcha:** the Notion workspace connected this session is Hamza's own account — pages were created privately; sharing the parent page with the actual co-founder is a manual step (Notion's own share UI), not something the agent does autonomously.

## 2026-07-09 — First spec-kit pipeline test: specs/001-envie-match

- Ran `/speckit-specify` against the already-approved `docs/specs/FS-05-envie-match.md` as a pipeline test: does converting a mature FS-* spec into spec-kit's format lose precision? Result: `specs/001-envie-match/spec.md`, all requirement-quality checklist items pass, all 16 ENV-* requirement IDs traced through as FR-001…FR-016.
- FS-05 remains the authoritative source (stated explicitly in the new spec's header); this is a mirror for `/speckit-plan` and `/speckit-tasks` to consume, not a replacement. No other FS-* specs migrated yet — this was a one-feature trial.
- **Gotcha:** spec-kit's "technology-agnostic success criteria" guideline doesn't fully fit privacy/concurrency correctness properties (e.g. "non-match unobservable via API response") — documented as a deliberate, noted exception in the checklist rather than a failure.
- Next: `/speckit-plan` → `/speckit-tasks` on this same feature to judge whether the full pipeline is worth adopting repo-wide before migrating the remaining 6 specs.

## 2026-07-09 — New agent: Design & Blueprint Specialist (area:design)

- Added `agents/design-specialist.md` — sixth specialist, owner of the front of the blueprint → spec → code pipeline: HTML blueprints (`blueprints/`), the Penpot design system/prototype (via the Penpot MCP plugin), and the graphic charter « Nuit » (palette, typography, Button/Tag components, iPhone 17 template — values documented as normative in the agent file).
- Registered in `scripts/render-agents.mjs`; renders to `.github/instructions/design.instructions.md` and `.claude/agents/design-specialist.md`. Scope: `blueprints/**`, `docs/design/**`, Penpot; proposes (never edits) design tokens for `packages/ui`.
- Includes field-tested Penpot MCP gotchas from the 2026-07-09 prototype build (writes target the browser-active page; async layout sizing; white default fills; hex-only fill colors; spurious `:error` responses — verify before retrying).
- **Gotcha:** new Claude Code subagents are only picked up after a session restart.

## 2026-07-09 — GitHub spec-kit adopted for spec-driven development

- Installed [github/spec-kit](https://github.com/github/spec-kit) via `uvx --from git+https://github.com/github/spec-kit.git specify init --here --integration claude`. New tooling: `.specify/` (templates, scripts, workflow config) and `.claude/skills/speckit-*` (8 slash-command skills: constitution, specify, plan, tasks, implement, clarify, analyze, checklist).
- Ratified `.specify/memory/constitution.md` v1.0.0 by mirroring — not duplicating — the existing `agents/_global-directives.md` (G1–G5). Governance section states explicitly: if the two ever diverge, `agents/_global-directives.md` wins; amendments happen there first, then this constitution is re-synced via `/speckit-constitution`.
- Requires `uv` (Astral) locally — installed via `brew install uv`. Not yet wired into CI.
- **Gotcha:** `RATIFICATION_DATE` in the constitution is a `TODO` — the original adoption date of `agents/_global-directives.md` isn't recorded in repo history. Fill in if it's ever recovered.
- `CLAUDE.md` gained a "Spec-driven development (spec-kit)" section documenting the `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` flow and the constitution's mirror-not-replace relationship to `agents/_global-directives.md`. Existing `docs/specs/FS-*.md` specs are not being migrated into spec-kit's format — spec-kit is for new feature scaffolding going forward.
- Follow-up: this is the foundation for the intended blueprint → spec → code workflow (design system blueprints feeding `/speckit-specify`); no blueprint tooling exists yet.

## 2026-07-06 — Repo-wide ESLint (flat config): `lint` is now a real gate

- Root `eslint.config.mjs`: typescript-eslint `recommendedTypeChecked` (type-aware via `projectService`, off each package's own tsconfig) + `eslint-config-prettier` last (Prettier stays the formatter). Bug-catching extras: `eqeqeq`, `no-console` (G3: pino only), `switch-exhaustiveness-check`. Test files relax `require-await`, `no-require-imports` (jest fresh-module pattern) and the `no-unsafe-*` family (jest mocks are any-typed).
- `apps/mobile/eslint.config.mjs` composes `eslint-config-expo/flat` (React/RN/react-hooks rules) with the root base. ESLint 9 resolves configs from each package's cwd upward, so api/db use the root file directly.
- All three packages now run `eslint .` as their `lint` script — the mobile stub (`exit 0`) is gone. `turbo.json` gained `globalDependencies: ["eslint.config.mjs"]` so config edits invalidate lint caches.
- New root devDependencies (justification: repo-wide lint tooling): `eslint@^9`, `@eslint/js@^9`, `typescript-eslint@^8`, `eslint-config-prettier`; `apps/mobile` adds `eslint@^9` + `eslint-config-expo@^57`.
- **Gotcha (pnpm):** mobile MUST declare `eslint` itself — without it, pnpm's auto-install-peers satisfied `eslint-config-expo`'s peer with eslint@10, producing a second `@typescript-eslint/eslint-plugin` instance and a "Cannot redefine plugin" ConfigError. Keep the eslint majors aligned across root and mobile.

## 2026-07-06 — Agent prompts consolidated to one source + render script

- `agents/*.md` is now the ONLY editable location for agent behavior. `scripts/render-agents.mjs` generates all tool copies: `.github/copilot-instructions.md` + `.github/instructions/*.instructions.md` (verbatim renders for Copilot) and `.claude/agents/*.md` (thin wrappers whose `@` imports resolve back to `agents/` at runtime for Claude Code).
- Removed the `agents/claude-code/` staging directory and the manual `cp` install step; `.claude/agents/` is now generated and tracked in git (works right after clone).
- `node scripts/render-agents.mjs --check` exits non-zero if renders are stale — wire it into CI as a required check (`area:sre` follow-up).

## 2026-07-06 — Maintainability pass: status doc, per-area changelogs, agent upgrades

- Added `docs/STATUS.md` — the single summary of what is implemented, per spec module and per infrastructure item.
- Added per-area `CHANGELOG.md` files (mobile, api, db, root) seeded from git history; new directive **G4.7** makes updating them part of every agent's Definition of Done.
- Upgraded agent prompts (`agents/*.md`) with changelog/status duties and field-tested gotchas (pnpm strict layout, Expo autolinking, dev-client rebuilds); re-rendered Copilot + Claude Code copies.
- `.gitignore` hardened: native `android/`/`ios/` dirs (Expo CNG — regenerated by `expo run`), build info, IDE noise, `.claude/agents/` (rendered copies).
- README setup/run sections corrected (Docker-first local dev; Neon/Vercel only for cloud), Android SDK PATH instructions added.

## 2026-07-05 — Local dev stack + Android tooling

- `docker-compose.yml`: Postgres 17 (:5432, named volume), API (:3001, schema push on boot), Adminer (:8080). `.dockerignore`, `apps/api/Dockerfile`.
- `scripts/`: `setup-android-emulator.sh` (SDK env + AVD management), `run-android.sh`, `run-ios.sh` quick-starts; `ANDROID_SETUP.md`, `DEVELOPMENT.md` guides.
- Android SDK PATH added to shell config; two AVDs (Pixel 6 Pro / Pixel 8 Pro) provisioned.

## 2026-07-04 — Project foundation (commits 02a3739, 456bf42, 66e2f03)

- Monorepo init: Turborepo + pnpm workspace, strict TS base config, blueprints, `docs/` (product overview, agent playbook, FS-01..07 specs with stable requirement IDs), domain spec, AIDD blueprint.
- Agents v1: `agents/_global-directives.md` (single source of truth) + five specialists, rendered to `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`, and `agents/claude-code/`.
- CI skeleton (`.github/workflows/ci.yml`).
