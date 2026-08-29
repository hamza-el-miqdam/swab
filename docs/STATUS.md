# Swab — Implementation Status

> **The single answer to "what is done in this project?"**
> Update this file in the same PR as any change that starts, advances, or completes a module.
> Detail per change lives in the area changelogs (see [Changelogs](#changelogs)); this file stays a summary.
> **What is *next*, in what order, and how — see [ROADMAP.md](ROADMAP.md).**

_Last updated: 2026-08-27_

> **Native migration complete.** Mobile is native `apps/ios` + `apps/android`; RN knowledge in `docs/migration/` (see its README for what is still binding). Both E2E suites are a hard DoD gate (`scripts/e2e-{ios,android}.sh`). Open: FS-03 on-device walkthrough, E2E not in CI.

## Modules (functional specs)

| Spec | Module | Status | Lead | Notes |
|---|---|---|---|---|
| FS-07 | Identity & Vault | 🟡 In progress | Backend | Auth (phone-OTP, JWT sessions), `/health` + `/ready`. **ADR-001 stage 3:** slice 1 typed `/contacts` CRUD + delta pull; slice 2 role routes + #153 roles read-path fix (VLT-05 restoration) — closes #117. `Vault` deprecated, still served. Next: filter rules, subgroups, history. Missing: refresh rotation, deletion, discovery, invites. |
| FS-01 | Onboarding | 🟢⚠️ | Mobile | Signup (phone → OTP), contact import + skip path, radial calibration, completion. Dev-mode OTP returned in API response (no SMS provider yet). **ADR-001:** built on the retired vault; ONB-02/05 change in the client-stage migration. |
| FS-02 | Relationship Map | 🟢⚠️ | Mobile | Radial map + list fallback from the local cache, 3-tab nav, peek sheet, pan/zoom. MAP-01..09 tests green; clustering deferred (OQ-MAP-1). **ADR-001:** reads move vault→cache; behaviour unchanged, lowest-impact spec. |
| FS-03 | Contact Card | 🟢⚠️ | Mobile | Four tap-editable axes, 12-month history, staleness nudge, pending contacts. FCH-01..08 green; vocab + `en pause` resolved 2026-08-09 (#15, #16); FCH-04 match events await FS-04/05. **ADR-001:** per-edit write model changes (FCH-01/04); FCH-09 stored identifiers done both platforms — stage-2 unblocked. |
| FS-04 | Subgroups (FCA) | ⚪ Not started | Mobile | **[ADR-002](decisions/ADR-002-envie-becomes-a-proposition.md) amendment landed (SUG-SPEC-017).** Groups stay **private to their owner** (SGR-07/08/09 untouched) but become manual by default: `SGR-10..SGR-15` add create/rename/edit-membership/delete, the owner-privacy invariant, accepting an FCA suggestion into a group, and the server-vs-device persistence split. FCA is now an opt-in suggestion only. Next: `area:db` issue [#166](https://github.com/hamza-el-miqdam/swab/issues/166) proposes `Group`/`GroupMember` (owner-scoped) — implementation blocked on it landing. |
| FS-05 | Envie & Match | ⚪ Not started | Mobile + Backend | **[ADR-002](decisions/ADR-002-envie-becomes-a-proposition.md) — full rewrite required, new requirement IDs.** Directed proposition (accept / counter-propose / ignore); identity reveals per-recipient choice; no matching engine. G1(d) amended 2026-08-27, Phase 0b done — see [ROADMAP.md](ROADMAP.md). OQ-PRO-6 still open before authoring. |
| FS-06 | Filtering rules | ⚪ Not started | Mobile + Backend | **[ADR-002](decisions/ADR-002-envie-becomes-a-proposition.md) — survival undecided (OQ-PRO-7).** Silent filtering is incoherent when you propose to a named group; may survive only to feed FS-04 suggestions. Prior notes (rules server-side, on-device evaluation per OQ-FLT-2) assume the retired broadcast model. |

Legend: ⚪ Not started · 🟡 In progress · 🟢 Implemented (spec acceptance tests green) · 🟢⚠️ Implemented against a superseded design (green, but needs rework — see the note) · 🔵 Hardened (privacy audit passed)

## Platform & infrastructure

| Item | Status | Notes |
|---|---|---|
| Monorepo (Turborepo + pnpm, strict TS) | 🟢 | `apps/api`, `packages/db`, `packages/ui` (design tokens only — see below). `apps/ios` + `apps/android` are deliberately outside the turbo/pnpm pipeline (`xcrun swift test` / `./gradlew test` directly). `apps/web`, `packages/api-client`, `tools/orchestrator` not created yet. |
| Database schema v0.1 | 🟡 | `users`; FS-05 envie/match models (`envies`, `envie_recipients`, `matches`, `proposals`) + seed; ADR-001 classification columns on `contact_links`/`contact_roles` + `client_mutations` ledger (2026-08-17). `vaults` deprecated, not dropped. Open `area:db`: monotonic sync sequence for a strict keyset delta-pull cursor — see `apps/api/CHANGELOG.md` 2026-08-22. |
| DB migrations | 🟢 | Baseline migration exists; both `docker-compose.yml` and CI run `prisma migrate deploy` — no `db push` anywhere in the pipeline. Postgres integration tests: `apps/api/tests/prisma-repo.test.ts` + `apps/api/tests/contacts-repo.postgres.test.ts` (both require a reachable Postgres and fail loudly without one). |
| Local dev stack | 🟢 | `docker compose up --build` → Postgres :5432, API :3001, Adminer :8080. API boot now runs `prisma migrate deploy` (was `db push`). |
| CI | 🟡 | `ci.yml`: scope-guard, Postgres + `prisma migrate deploy`, native unit tests (path-filtered). `security.yml`: gitleaks + Trivy on `prod` image — green (zero HIGH/CRITICAL). Missing: E2E in CI, privacy-audit job, coverage enforcement, OpenAPI diff gate. |
| Mobile E2E gate (Wave 4) | 🟢 | Local, agent-enforced DoD gate — `scripts/e2e-{ios,android}.sh` → `test-results/e2e/e2e-report.md` + requirement manifest in `docs/qa/`. Not yet wired into CI. |
| Lint (repo-wide ESLint) | 🟢 | Flat config: root `eslint.config.mjs` (type-aware typescript-eslint). All packages run `eslint .`. |
| Design system (« Nuit ») | 🟡 | Token SSOT `packages/ui/tokens/tokens.json` → native tokens (`generate.mjs`, `--check` in CI); both platforms consume Color/Typography/Radius. Contract: `docs/design-system.md`. **Open:** 39 off-scale spacing values; new components missing from the DS page; postal fields need `area:db`. |
| Agents (AIDD) | 🟢 | Source of truth in `agents/`; `node scripts/render-agents.mjs` renders Copilot (`.github/`) + Claude Code (`.claude/agents/`) copies (`--check` for CI). Areas: ios, android, backend, web, db, devops, design, specs, notion-liaison. 2026-07-19: spec-specialist (area:specs) added — owns `docs/specs/FS-*.md` authoring + spec-kit pipeline. |
| Spec ↔ Notion sync (French mirror) | 🟡 | All 7 specs mirrored in French under Notion "Swab — Spécifications (FS-*)" for the non-dev co-founder. `docs/specs/.notion-sync.json` tracks snapshots; re-diffed on every liaison invocation. Code stays canonical; conflicts flagged, never auto-resolved. **Stale since 2026-08-16 (ADR-001):** re-sync deferred until the spec review (#64) settles. |
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
