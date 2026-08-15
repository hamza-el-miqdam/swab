# Swab — Implementation Status

> **The single answer to "what is done in this project?"**
> Update this file in the same PR as any change that starts, advances, or completes a module.
> Detail per change lives in the area changelogs (see [Changelogs](#changelogs)); this file stays a summary.

_Last updated: 2026-08-15_

> **Native migration complete.** Mobile is native `apps/ios` (Swift/SwiftUI) + `apps/android` (Kotlin/Compose); Expo RN knowledge preserved in `docs/migration/`. Both platforms' full E2E suites are green as a hard Definition-of-Done gate (`scripts/e2e-{ios,android}.sh`, zero drift, requirement manifest in `docs/qa/`). Known open items: FS-03 on-device walkthrough, E2E not yet wired into CI — see `docs/migration/rn-audit-map.md`.

## Modules (functional specs)

| Spec | Module | Status | Lead | Notes |
|---|---|---|---|---|
| FS-07 | Identity & Vault | 🟡 In progress | Backend | API done: phone-OTP auth (`/auth/otp`), JWT sessions, opaque vault store (`/vault`, versioned), `/health` + `/ready`. Mobile vault client done (AES-256-GCM on-device, OS-keystore key). **Missing:** refresh rotation (IDT-02), account deletion (IDT-04), contact discovery (IDT-06), invite links + web invite landing (IDT-07/09). |
| FS-01 | Onboarding | 🟢 Implemented | Mobile | Signup (phone → OTP), contact import + skip path, radial calibration, completion. Dev-mode OTP returned in API response (no SMS provider yet). |
| FS-02 | Relationship Map | 🟢 Implemented | Mobile | Radial map + list fallback from the vault, 3-tab nav, peek sheet, pan/zoom. MAP-01..09 tests green; clustering deferred (OQ-MAP-1). |
| FS-03 | Contact Card | 🟢 Implemented | Mobile | Greenfield (no RN equivalent). Four tap-editable axes, 12-month history, staleness nudge, pending-contact support. FCH-01..08 green on both platforms; `en pause` état-vs-ressenti divergence resolved 2026-08-09 (issue #16, état canonical); Rôles·contexte/Ressenti vocabularies finalized from blueprint 2026-08-09 (issue #15); FCH-04 match events deferred pending FS-04/05. |
| FS-04 | Subgroups (FCA) | ⚪ Not started | Mobile | Pure on-device domain module. |
| FS-05 | Envie & Match | ⚪ Not started | Mobile + Backend | The only two-agent spec; OpenAPI seam not yet drafted. |
| FS-06 | Filtering rules | ⚪ Not started | Mobile | Rules live in the vault. |

Legend: ⚪ Not started · 🟡 In progress · 🟢 Implemented (spec acceptance tests green) · 🔵 Hardened (privacy audit passed)

## Platform & infrastructure

| Item | Status | Notes |
|---|---|---|
| Monorepo (Turborepo + pnpm, strict TS) | 🟢 | `apps/api`, `packages/db`, `packages/ui` (design tokens only — see below). `apps/ios` + `apps/android` are deliberately outside the turbo/pnpm pipeline (`xcrun swift test` / `./gradlew test` directly). `apps/web`, `packages/api-client`, `tools/orchestrator` not created yet. |
| Database schema v0.1 | 🟢 | `users`, `vaults`, `envies` + seed. Privacy invariant holds: no classification columns. |
| DB migrations | 🟢 | Baseline migration exists; both `docker-compose.yml` and CI run `prisma migrate deploy` — no `db push` anywhere in the pipeline. Postgres integration tests: `apps/api/tests/prisma-repo.test.ts`. |
| Local dev stack | 🟢 | `docker compose up --build` → Postgres :5432, API :3001, Adminer :8080. API boot now runs `prisma migrate deploy` (was `db push`). |
| CI | 🟡 | `ci.yml`: scope-guard (warn-and-pass while unlabeled), Postgres service + `prisma migrate deploy`, native unit tests (`android-unit`/`ios-unit`, path-filtered). `security.yml`: gitleaks (full-history) + Trivy on the `prod` API image — still red (23 findings, mostly unpatched transitive deps; Dependabot is the long-term fix). Missing: E2E in CI, privacy-audit job, coverage enforcement, OpenAPI diff gate. |
| Mobile E2E gate (Wave 4) | 🟢 | Local, agent-enforced DoD gate — `scripts/e2e-{ios,android}.sh` → `test-results/e2e/e2e-report.md` + requirement manifest in `docs/qa/`. Not yet wired into CI. |
| Lint (repo-wide ESLint) | 🟢 | Flat config: root `eslint.config.mjs` (type-aware typescript-eslint). All packages run `eslint .`. |
| Design system (« Nuit ») | 🟡 | Token SSOT `packages/ui/tokens/tokens.json` generates native tokens (`node packages/ui/scripts/generate.mjs`, `--check` in CI); both platforms consume Color/Typography/Radius. Contract: `docs/design-system.md`; normative prototype: `docs/design/swab-prototype-consolidated.html`. **Open:** 39 off-scale spacing values; new components not on the Design System page; postal fields need `area:db`. |
| Agents (AIDD) | 🟢 | Source of truth in `agents/`; `node scripts/render-agents.mjs` renders Copilot (`.github/`) + Claude Code (`.claude/agents/`) copies (`--check` for CI). Areas: ios, android, backend, web, db, devops, design, specs, notion-liaison. 2026-07-19: spec-specialist (area:specs) added — owns `docs/specs/FS-*.md` authoring + spec-kit pipeline. |
| Spec ↔ Notion sync (French mirror) | 🟢 | All 7 specs mirrored in French under Notion "Swab — Spécifications (FS-*)" for the non-dev co-founder. `docs/specs/.notion-sync.json` tracks snapshots; re-diffed on every liaison invocation. Code stays canonical; conflicts flagged, never auto-resolved. |
| SMS provider (OTP) | ⚪ | Dev mode returns the code in the response; provider selection is an open question. |
| Privacy audit (playbook §6) | ⚪ | Must run before any external tester and after every schema/API change. |

## Changelogs

Every change lands with an entry in its area changelog (rule G5 in `agents/_global-directives.md`):

- [apps/ios/CHANGELOG.md](../apps/ios/CHANGELOG.md) — `area:ios`
- [apps/android/CHANGELOG.md](../apps/android/CHANGELOG.md) — `area:android`
- [apps/api/CHANGELOG.md](../apps/api/CHANGELOG.md) — `area:backend`
- [packages/db/CHANGELOG.md](../packages/db/CHANGELOG.md) — `area:db`
- [CHANGELOG.md](../CHANGELOG.md) (repo root) — `area:devops`, docs, agents, design, specs, tooling, cross-cutting

## How to update this file

- Starting a module → flip it to 🟡 with a one-line note of what's in flight.
- Finishing a module → 🟢 only when the spec's acceptance criteria have green tests; update the spec's `Status:` header to `Implemented` in the same PR.
- 🔵 is set only by a passing privacy audit (playbook §6).
- Keep notes to one or two lines — history belongs in the changelogs, not here.
