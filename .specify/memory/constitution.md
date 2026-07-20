<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Rationale: MINOR — principles materially expanded/reworded from the source
  (agents/_global-directives.md), none removed or redefined incompatibly.
  This is a drift resync, not a new ratification.
- Modified principles:
  - II. Test-Driven Development (G2) — added the E2E gate paragraph (mobile
    Definition of Done: docs/qa/e2e-scenarios.md scenarios, e2e-coverage.json
    manifest with five verification classes, scripts/e2e-{ios,android}.sh
    PASS with zero drift-guard failures pasted into the PR, requirement IDs
    in E2E test names).
  - V. Documentation & Changelogs (G5) — changelog area list corrected:
    removed the retired Expo/React Native app's changelog entry
    (area:mobile, that app was retired 2026-07-19), added the two native
    apps' changelog paths (area:ios, area:android), and added design/specs
    to the root CHANGELOG area list; added the "summaries not session logs,
    ≤15 lines" rule; added "also flip the spec's Status: header to
    Implemented" to the STATUS.md bullet.
- Added sections: none (existing I–V Principles, Additional Constraints,
  Development Workflow, Governance sections retained)
- Removed sections: none
- Resolved: the ratification-date placeholder — set to 2026-07-04, the date
  of the first commit touching agents/_global-directives.md
  (`git log --follow --format=%ad --date=short -- agents/_global-directives.md | tail -1`).
- Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check gate is generic
     ("Gates determined based on constitution file"), no edit needed.
  ✅ .specify/templates/spec-template.md — no constitution-specific references found.
  ✅ .specify/templates/tasks-template.md — no constitution-specific references found.
  ✅ .specify/templates/commands/*.md — not present in this install (skills-based
     integration instead); no stale agent-name references found.
- Follow-up TODOs: none
-->

# Swab Constitution

## Core Principles

### I. Zero-Trust Security (G1)

All input MUST be validated at every boundary using Zod schemas: API request
bodies/params/headers, env vars (fail fast at boot via a typed `env.ts`),
queue/webhook payloads, and data crossing package boundaries. The client —
including Swab's own apps — is never trusted.

Secrets MUST come from the environment only (GitHub environment secrets in CI,
Vercel env vars at runtime), never from code, config files, logs, error
messages, or test fixtures. Every token, DB role, and workflow permission MUST
be scoped to least privilege; broader access needs are flagged in the PR
description, not self-granted.

**Privacy invariant (non-negotiable, product-defining)**: relationship
classification data (intimité, rôles, état, ressenti), filter rules, and
subgroup structures exist ONLY on-device or inside the encrypted Vault blob.
Server code MUST NOT parse, log, index, or infer this data. Scope names and
filter reasons never appear in API payloads — only final resolved recipient
ID lists.

Rationale: Swab's entire value proposition depends on relationship data never
being reconstructable server-side, even under compromise. This is enforced
architecturally, not just by policy.

Full detail: `agents/_global-directives.md` (G1), imported into `CLAUDE.md`.

### II. Test-Driven Development (G2)

The failing test MUST be written before the implementation. No feature PR
ships without unit and integration tests. Minimum 80% line coverage on
changed packages, enforced in CI — thresholds are configured per-package,
never globally fudged.

Tests validate the contract, not the implementation: table-driven tests for
pure logic, integration tests against a real Postgres (Neon CI branch), no
mocking of Prisma in integration tests. Every bug fix starts with a
regression test that reproduces it before the fix is written.

**E2E gate (mobile — part of Definition of Done)**: every functional
requirement of an implemented spec MUST have a scenario in
`docs/qa/e2e-scenarios.md` and an entry in `docs/qa/e2e-coverage.json`,
honestly classified into one of five verification classes — `automated`,
`unit-covered`, `api-integration`, `manual`, `not-e2e-verifiable` — never
silently dropped. Before any `area:ios`/`area:android` task is Done, the
platform's full on-device E2E suite MUST run via `scripts/e2e-ios.sh` /
`scripts/e2e-android.sh` (booted Simulator/emulator + live local API): the
generated `test-results/e2e/e2e-report.md` must be PASS with zero
drift-guard failures, and its summary is pasted into the PR. E2E test names
carry their requirement IDs (`test_ONB05_...`) so the report generator can
join results to requirements through the manifest. New or changed
user-facing requirements update scenarios + manifest in the same PR.

Rationale: a solo-maintained, AI-assisted codebase has no second reviewer
catching behavioral drift by eye — the test suite is the actual reviewer.

Full detail: `agents/_global-directives.md` (G2).

### III. Observability (G3)

Structured logging only (`pino`, JSON output), one logger instance injected
per layer, never `console.log`. Levels: `debug` (local), `info` (state
changes), `warn` (degraded), `error` (failed + actionable). Every log line
carries `requestId`.

**Never log**: verbs of envies, recipient lists, vault contents, phone
hashes, push tokens — log IDs and counts instead.

Every service exposes `GET /health` (liveness, no deps) and `GET /ready`
(checks DB connectivity). Metrics (request duration, DB query duration,
match-computation duration) are recorded as histograms via the OpenTelemetry
API, vendor-neutral for the planned AWS move.

Rationale: without an ops team, an unobservable failure in production is
effectively permanent until a user complains — logging and health checks are
the early-warning system.

Full detail: `agents/_global-directives.md` (G3).

### IV. Workflow Discipline (G4)

Every agent (human or AI) stays inside its declared file scope; a PR
touching paths outside scope is auto-rejected by the scope guard.
`packages/db/prisma/schema.prisma` has exactly ONE writer — the Data & Schema
Steward. Every other agent requests schema changes by opening an `area:db`
issue with a proposed model diff and the query patterns motivating it.

Commits follow Conventional Commits; one issue = one branch = one PR, kept
under ~400 changed lines (split otherwise). No new dependencies without
justification in the PR description. No Vercel-proprietary APIs (KV/Blob/Edge
Config) and no Neon-specific SQL anywhere in app code — AWS portability is a
hard requirement.

If a spec is ambiguous, stop and comment on the issue — do not guess product
behavior. No counters, no gamification, no dark patterns, nothing hidden
silently, in any decision.

Rationale: with a single technical founder driving AI agents across every
area of the codebase, scope discipline and small PRs are what keep changes
reviewable and revertible.

Full detail: `agents/_global-directives.md` (G4).

### V. Documentation & Changelogs (G5)

Every change updates its area changelog in the same commit/PR:
`apps/ios/CHANGELOG.md` (area:ios), `apps/android/CHANGELOG.md`
(area:android), `apps/api/CHANGELOG.md` (area:backend),
`packages/db/CHANGELOG.md` (area:db, Data Steward only), root
`CHANGELOG.md` (area:devops, docs, agents, design, specs, tooling,
cross-cutting). Entry format, newest first: `## YYYY-MM-DD — [REQ-IDs] title`
plus what/why/gotchas. A PR without a changelog entry is incomplete.

Changelog entries are summaries, not session logs — target ≤ 15 lines per
entry: what/why in 2–4 bullets, then only the gotchas and follow-ups a future
developer genuinely needs. If an entry needs more, the PR should have been
split.

`docs/STATUS.md` is the single summary of what is done — updated in the same
PR whenever a module starts (⚪→🟡), completes (🟡→🟢, acceptance tests green
— also flip the spec's `Status:` header to `Implemented`), or an
infrastructure item changes state. Keep notes to 1–2 lines; history belongs
in changelogs.

Docs stay truthful: if a change makes README/DEVELOPMENT.md/spec text wrong,
that text is fixed in the same PR. Code and docs never disagree on `main`.

Rationale: a solo founder without institutional memory in teammates' heads
needs the repo itself to be the memory — stale docs are a silent liability.

Full detail: `agents/_global-directives.md` (G5).

## Additional Constraints

- **Schema single-writer**: `packages/db/prisma/schema.prisma` is edited only
  by the Data & Schema Steward agent/role. All other agents open an
  `area:db` proposal instead of editing it directly.
- **French UI copy is normative and verbatim**: user-facing French copy comes
  from `docs/specs/FS-*.md` exactly as written — no invented or paraphrased
  copy, no counters, celebrations, or urgency language anywhere in the UI.

## Development Workflow

Spec-driven, AI-assisted development: functional specs in `docs/specs/`
(stable requirement IDs, e.g. `ONB-05`, `ENV-11`) are the input to
`/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Requirement IDs
are quoted in branch names, PR titles, and test names so code traces back to
its spec. `docs/agent-playbook.md` governs the issue protocol, build order,
and privacy audit process referenced by these skills.

## Governance

`agents/_global-directives.md` is the canonical, single source of truth for
Principles I–V above — it is imported into `CLAUDE.md` via `@`-import per
this project's own anti-duplication rule. This constitution is spec-kit's
planning-time mirror of those directives, kept intentionally concise so
`/speckit-plan`'s Constitution Check gate has something to check against
without re-litigating the source text.

**If this file and `agents/_global-directives.md` ever diverge, the global
directives file wins.** Substantive amendments happen in
`agents/_global-directives.md` first (following its own G4/G5 change
process), then this constitution is re-synced via `/speckit-constitution` to
match — this file is never edited independently for substance, only for
resync or for the Swab-specific Additional Constraints / Development
Workflow sections that have no home in the global directives file.

Amendment procedure: propose the change in `agents/_global-directives.md`,
get it merged, then run `/speckit-constitution` again with the updated
principle text so this file, the version, and the Sync Impact Report all
move together. All specs and plans produced by spec-kit are expected to
comply with the current version of this file; violations must be justified
in the plan's Complexity Tracking section or rejected.

**Version**: 1.1.0 | **Ratified**: 2026-07-04 | **Last Amended**: 2026-07-20
