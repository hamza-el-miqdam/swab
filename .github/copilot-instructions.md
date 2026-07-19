<!-- RENDERED by scripts/render-agents.mjs from /agents — edit there, then re-run the script. -->
# Swab (صواب) — Repository Instructions

## Project

Swab (صواب) — an app to express desires ("envies") to scopes of friends, revealed only on mutual match. Monorepo: Turborepo + pnpm, strict TypeScript on the JS/TS side. Mobile clients: `apps/ios` (Swift/SwiftUI, native) and `apps/android` (Kotlin/Jetpack Compose, native) — they replaced the retired Expo/React Native app (its knowledge is preserved in `docs/migration/rn-native-handoff.md` + `docs/migration/vault-test-vectors.json`). Also: `apps/web` (Next.js), `apps/api` (standalone Node service, container-ready), `packages/db` (Prisma + Postgres/Neon), `packages/ui`, `packages/api-client`, `tools/orchestrator`. Read `/docs/specs/*.md` and `swab-domain-spec.md` before any task.

## G1 — Zero-Trust Security

- Validate ALL input at every boundary with Zod schemas: API request bodies/params/headers, env vars (fail fast at boot via a typed `env.ts`), queue/webhook payloads, and data crossing package boundaries. Never trust the client — including our own apps.
- Secrets come from the environment only (GitHub environment secrets in CI, Vercel env vars at runtime). Never in code, config files, logs, error messages, or test fixtures. Use `.env.example` with placeholder values only.
- Principle of least privilege: every token, DB role, and workflow permission is scoped to the minimum required. If you need broader access, stop and flag it in the PR description instead of widening scope yourself.
- **Privacy invariant (product-defining):** relationship classification data (intimité, rôles, état, ressenti), filter rules, and subgroup structures exist ONLY on-device or inside the encrypted `Vault` blob. Server code must never parse, log, index, or infer this data. Scope names and filter reasons never appear in API payloads — only final resolved recipient ID lists.

## G2 — Test-Driven Development

- Write the failing test FIRST, then the implementation. No feature PR without unit + integration tests.
- Minimum 80% line coverage on changed packages, enforced in CI (`vitest --coverage` / `jest --coverage`; threshold configured in each package, not globally fudged).
- Test the contract, not the implementation: table-driven tests for pure logic, integration tests against a real Postgres (Neon CI branch), no mocking of Prisma in integration tests.
- Every bug fix starts with a regression test that reproduces it.
- **E2E gate (mobile — part of Definition of Done):** every functional requirement of an implemented spec has a scenario in `docs/qa/e2e-scenarios.md` and an entry in `docs/qa/e2e-coverage.json` (verification class: `automated` / `unit-covered` / `api-integration` / `manual` / `not-e2e-verifiable` — honest classification, never silently dropped). Before any `area:ios`/`area:android` task is Done, the platform's full on-device E2E suite runs via `scripts/e2e-ios.sh` / `scripts/e2e-android.sh` (booted Simulator/emulator + live local API): the generated `test-results/e2e/e2e-report.md` must be **PASS with zero drift-guard failures**, and its summary is pasted into the PR. E2E test names carry their requirement IDs (`test_ONB05_...`) — the report generator joins results to requirements through the manifest. New or changed user-facing requirements update scenarios + manifest in the same PR.

## G3 — Observability

- Structured logging only (`pino`), JSON output, one logger instance injected per layer. Levels: `debug` (local), `info` (state changes), `warn` (degraded), `error` (failed + actionable). Every log line carries `requestId` (propagated via headers) — never `console.log`.
- **Never log:** verbs of envies, recipient lists, vault contents, phone hashes, push tokens. Log IDs and counts instead.
- Health: every service exposes `GET /health` (liveness, no deps) and `GET /ready` (checks DB connectivity). Mobile/web report errors via a single error-boundary reporter.
- Metrics: record request duration, DB query duration, and match-computation duration as histograms (OpenTelemetry API, console/OTLP exporter — vendor-neutral for the AWS move).

## G4 — Workflow rules (all agents)

- Stay inside your declared file scope (see your agent file). A PR touching paths outside scope will be auto-rejected by the scope guard.
- `packages/db/prisma/schema.prisma` has exactly ONE writer: the Data & Schema Steward (`area:db`). Every other agent — Backend included — requests changes by opening an `area:db` issue with a proposed model diff and the query patterns motivating it.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`...). One issue = one branch = one PR. Keep PRs under ~400 changed lines; split otherwise.
- No new dependencies without justification in the PR description (bundle/attack-surface cost). No Vercel-proprietary APIs (KV/Blob/Edge Config) and no Neon-specific SQL anywhere in app code — AWS portability is a hard requirement.
- If a spec is ambiguous, comment on the issue and stop — do not guess product behavior. Product ethos to preserve in every decision: no counters, no gamification, no dark patterns, nothing hidden silently.

## G5 — Documentation & Changelogs (all agents — part of Definition of Done)

- **Every change updates its area changelog, in the same commit/PR.** Locations: `apps/ios/CHANGELOG.md` (area:ios), `apps/android/CHANGELOG.md` (area:android), `apps/api/CHANGELOG.md` (area:backend), `packages/db/CHANGELOG.md` (area:db, Data Steward only), root `CHANGELOG.md` (area:devops, docs, agents, design, specs, tooling, cross-cutting). Entry format, newest first: `## YYYY-MM-DD — [REQ-IDs] title` + bullets covering what changed, why, and anything a future developer must know (gotchas, pinned versions, follow-ups). A PR without a changelog entry is incomplete.
- **Changelog entries are summaries, not session logs.** Target ≤ 15 lines per entry: what/why in 2–4 bullets, then only the gotchas and follow-ups a future developer genuinely needs. Test-by-test narration, investigation diaries, command transcripts, and per-requirement status tables belong in the PR description or `docs/` — link to them instead of inlining. If an entry needs more, it's a sign the PR should have been split (G4).
- **`docs/STATUS.md` is the single summary of what is done.** Update it in the same PR whenever a module starts (⚪→🟡), completes (🟡→🟢, acceptance tests green — also flip the spec's `Status:` header to `Implemented`), or an infrastructure item changes state. Keep notes to 1–2 lines; history belongs in changelogs.
- Docs stay truthful: if your change makes README/DEVELOPMENT.md/spec text wrong (commands, ports, flows), fix that text in the same PR. Code and docs never disagree on `main`.
