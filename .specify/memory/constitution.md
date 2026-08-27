<!--
Sync Impact Report
- Version change: 2.0.0 → 3.0.0
- Rationale: MAJOR — Principle I clause (d), the reveal invariant, is
  REDEFINED incompatibly. Per ADR-002 (2026-08-27, "envie becomes a
  proposition"), mutual reveal is retired: an envie is now a proposition,
  directed and visible to its recipients, with its proposer always named.
  The matching engine is not built. What survives, restated as the new (d):
  silence is never explained (no read receipts, no delivery status, no "vu",
  no signal to the proposer), there is no decline action anywhere (expiry is
  the only exit and looks identical regardless of reason), and a recipient's
  identity is disclosed to other recipients only by that recipient's own
  explicit choice. Clauses (a), (b), (c) are UNCHANGED — group privacy
  (ADR-002 commitment 3) and directional-link non-disclosure (IDT-08) already
  satisfy them; re-verified, not re-derived. This is the single clause the
  amendment touches; no other principle changed.
- Modified principles:
  - I. Zero-Trust Security (G1) — clause (d) redefined per above; the
    "## Project" one-line app description this constitution's preamble
    implicitly assumes (mirrored from `agents/_global-directives.md`) is also
    now the proposition model, not the mutual-match model.
- Added sections: none
- Removed sections: none
- Resolved: n/a
- Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check gate is generic
     ("Gates determined based on constitution file"), no edit needed.
  ✅ .specify/templates/spec-template.md — no constitution-specific references found.
  ✅ .specify/templates/tasks-template.md — no constitution-specific references found.
  ✅ .specify/templates/commands/*.md — not present in this install (skills-based
     integration instead); no stale agent-name references found.
  ⚠ `docs/specs/FS-05-*.md` (and any spec-kit `specs/**` artifacts derived from
     it) still assert mutual reveal — out of scope for this resync (tracked as
     ROADMAP Phase 0c / SUG-SPEC-016); this constitution now leads, they lag
     until rewritten.
- Follow-up TODOs: OQ-PRO-10 (does "no decline action anywhere" survive FS-05's
  planned « Passer cette fois »?) is open — tracked in
  `docs/decisions/ADR-002-envie-becomes-a-proposition.md` and
  `suggestions/specs/SUG-SPEC-014-adr002-amend-binding-directives.md`, not
  resolved by this resync.
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

**Privacy model (revised 2026-08-16 — ADR-001)**: relationship classification
data (intimité, rôles, état, ressenti), filter rules, and subgroup structures
are stored server-side in Postgres as ordinary queryable columns. The database
is the single source of truth; the device holds a cache. End-to-end encryption
and the opaque Vault blob are RETIRED. Data MUST be encrypted in transit (TLS)
and at rest (managed disk/KMS), and operator access MUST be least-privilege —
but it is technically possible, and in-app copy MUST NOT imply otherwise.

Still non-negotiable (these never depended on encryption — they are product
rules): (a) one user's classification data MUST NEVER be exposed to another
user; links stay directional and private (IDT-08), with no "X added you"
notifications, ever; (b) classification data, envie verbs, recipient lists,
phone hashes and push tokens MUST NOT appear in logs (III), wherever stored;
(c) phone numbers are stored only as client-side salted hashes (IDT-01);
(d) a proposition is directed and visible to its recipients
(`docs/decisions/ADR-002-envie-becomes-a-proposition.md`), and its proposer is
always named — but **silence is never explained**: ignoring a proposition
MUST be indistinguishable from never having seen it, with no read receipts,
no delivery status, no "vu", and no signal of any kind back to the proposer.
There is no decline action anywhere; expiry is the only exit, and it looks
identical whether the recipient was uninterested, busy, or absent. A
recipient's identity is disclosed to the *other* recipients only by that
recipient's own explicit choice, and a group is private to its owner —
creating one, or adding someone to it, notifies nobody and is visible to
nobody.

Rationale: recoverability won over operator-blindness. Device loss previously
meant permanent loss of the user's entire relationship map, with no recovery
path built. The trade-off, alternatives, and accepted costs are recorded in
`docs/decisions/ADR-001-server-side-classification-data.md`.

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

**Version**: 3.0.0 | **Ratified**: 2026-07-04 | **Last Amended**: 2026-08-27
