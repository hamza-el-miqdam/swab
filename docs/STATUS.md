# Swab — Implementation Status

> **The single answer to "what is done in this project?"**
> Update this file in the same PR as any change that starts, advances, or completes a module.
> Detail per change lives in the area changelogs (see [Changelogs](#changelogs)); this file stays a summary.

_Last updated: 2026-07-19_

> **Native migration complete.** Mobile is native `apps/ios` (Swift/SwiftUI) + `apps/android` (Kotlin/Compose); the Expo RN reference app was removed 2026-07-19 (knowledge in `docs/migration/rn-native-handoff.md`, `vault-test-vectors.json`, `rn-audit-map.md`). Waves 1–3 (FS-07 client + FS-01, FS-02, FS-03) landed 2026-07-10 on both platforms; Wave 4 (E2E) completed 2026-07-12 — Android 16/16 instrumented tests, iOS 13/13 XCUITests, both verified from clean against the live local API. E2E is a hard Definition-of-Done gate (`scripts/e2e-{ios,android}.sh` → PASS report, zero drift) with a per-requirement manifest in `docs/qa/` covering all 40 FS-01/02/03/07 IDs. Known open items: `CalibrateScreen` ring-picker text-wrap bug (rings 3/4), FS-03 live walkthrough not yet done on-device, CI wiring for E2E (macOS/emulator runners) filed as a follow-up — details in `docs/migration/rn-audit-map.md` and the area changelogs.

## Modules (functional specs)

| Spec | Module | Status | Lead | Notes |
|---|---|---|---|---|
| FS-07 | Identity & Vault | 🟡 In progress | Backend | API done: phone-OTP auth (`/auth/otp`), JWT sessions, opaque vault store (`/vault`, versioned), `/health` + `/ready`. Mobile vault client done (AES-256-GCM on-device, OS-keystore key). **Missing:** refresh rotation (IDT-02), account deletion (IDT-04), contact discovery (IDT-06), invite links + web invite landing (IDT-07/09). |
| FS-01 | Onboarding | 🟢 Implemented | Mobile | Signup (phone → OTP), contact import + skip path, radial calibration, completion. Dev-mode OTP returned in API response (no SMS provider yet). |
| FS-02 | Relationship Map | 🟢 Implemented | Mobile | Radial map + list fallback from the vault, 3-tab nav, peek sheet, pan/zoom. MAP-01..09 tests green; clustering deferred (OQ-MAP-1). |
| FS-03 | Contact Card | 🟢 Implemented | Mobile | Greenfield (no RN equivalent). Four tap-editable axes, 12-month history, staleness nudge, pending-contact support. FCH-01..08 green on both platforms; `en pause` taxonomy divergence documented; FCH-04 match events deferred pending FS-04/05. |
| FS-04 | Subgroups (FCA) | ⚪ Not started | Mobile | Pure on-device domain module. |
| FS-05 | Envie & Match | ⚪ Not started | Mobile + Backend | The only two-agent spec; OpenAPI seam not yet drafted. |
| FS-06 | Filtering rules | ⚪ Not started | Mobile | Rules live in the vault. |

Legend: ⚪ Not started · 🟡 In progress · 🟢 Implemented (spec acceptance tests green) · 🔵 Hardened (privacy audit passed)

## Platform & infrastructure

| Item | Status | Notes |
|---|---|---|
| Monorepo (Turborepo + pnpm, strict TS) | 🟢 | `apps/api`, `packages/db`, `packages/ui` (design tokens only — see below). `apps/ios` + `apps/android` are deliberately outside the turbo/pnpm pipeline (`xcrun swift test` / `./gradlew test` directly). `apps/web`, `packages/api-client`, `tools/orchestrator` not created yet. |
| Database schema v0.1 | 🟢 | `users`, `vaults`, `envies` + seed. Privacy invariant holds: no classification columns. |
| DB migrations | 🟢 | Baseline `prisma/migrations/20260719000000_init` landed 2026-08-08 (SUG-DB-002) — schema is no longer `db push`-only. **2026-08-08: `docker-compose.yml` and CI both now run `prisma migrate deploy`** (SUG-OPS-013, closes #21) — no more `db push` anywhere in the pipeline. Prisma-repo integration tests against the new CI Postgres are filed as #22 (area:api). |
| Local dev stack | 🟢 | `docker compose up --build` → Postgres :5432, API :3001, Adminer :8080. API boot now runs `prisma migrate deploy` (was `db push`). |
| CI | 🟡 | `ci.yml`: `scope-guard.yml` enforces `area:*` scope (warn-and-pass while unlabeled). `postgres:17` service + `prisma migrate deploy` wired (SUG-OPS-013). **Native unit tests now run in CI** (SUG-OPS-001): `android-unit` (`./gradlew test`, ubuntu) and `ios-unit` (`xcrun swift test`, macos-15), both gated by a cheap path-filter job so they only run when their platform's files changed. **`security.yml` added** (SUG-OPS-003): `gitleaks` (full-history, `.gitleaks.toml` allowlist for verified non-secret test fixtures) + path-filtered `trivy-api-image` (zero HIGH/CRITICAL gate), now scanning `apps/api/Dockerfile`'s `prod` target (SUG-OPS-007) — still red (23 findings, mostly unpatched transitive deps of Prisma's own tooling; Dependabot npm ecosystem, SUG-OPS-004, is the long-term fix path), down from 35 on the old dev-image scan. E2E/simulator suites still not wired (macOS + emulator runners — separate follow-up). Missing: privacy-audit job, coverage enforcement, OpenAPI diff gate. |
| Mobile E2E gate (Wave 4) | 🟢 | Local, agent-enforced DoD gate — `scripts/e2e-{ios,android}.sh` → `test-results/e2e/e2e-report.md` + requirement manifest in `docs/qa/`. Not yet wired into CI. |
| Lint (repo-wide ESLint) | 🟢 | Flat config: root `eslint.config.mjs` (type-aware typescript-eslint). All packages run `eslint .`. |
| Design system (« Nuit ») | 🟡 | Token contract in `docs/design-system.md` + prototype in `docs/design/`. Penpot library + "Prototype — Parcours consolidé" built and Play-mode-able (16 Flows, 33 screens, click-wired; 2026-07-17). **2026-07-19: token SSOT now exists in code** — `packages/ui/tokens/tokens.json` (hand-edited) generates `packages/ui/src/tokens.{ts,css}` + `apps/ios/.../Generated/DesignTokens.swift` + `apps/android/.../ui/theme/DesignTokens.kt` (`node packages/ui/scripts/generate.mjs`, `--check` for CI). **Both native themes wired 2026-07-19**: `apps/android/.../ui/theme/Theme.kt` builds Material3's `ColorScheme` from `DesignTokens` (single Nuit dark theme, no invented light palette — see `apps/android/CHANGELOG.md`) and `apps/ios/.../Carte/CarteTheme.swift` repoints to `DesignTokens.Color` (stale RN palette retired — see `apps/ios/CHANGELOG.md`). **2026-08-08: spacing-scale contradiction between design-system.md and tokens.json resolved** (SUG-DES-009) — SSOT spacing keys renamed `xs4/s8/sm12/m14/ml16/l20/xl24`, matching the published `4·8·12·14·16·20·24` scale exactly (the undocumented `32` dropped — zero prototype evidence); a `component.screen` token now carries the `14 20 20` screen padding. **2026-08-08: six standalone per-flow blueprints flagged superseded** (SUG-DES-001) — `blueprints/swab - {Carte des relations, Fiche contact, Flux envie et match, Onboarding, Paramètres modaux, Sous-groupes} (standalone)*.html` predate the Nuit charter (brown/gold palette, Hanken Grotesk) and now carry an explicit SUPERSEDED banner (HTML comment + visible top-of-page notice) pointing at `docs/design/swab-prototype-consolidated.html` + `docs/design-system.md` as the normative visual reference; flow structure/copy in them may still be consulted, visual values may not. Not re-skinned (Option A, cheaper first step — the files are ~950 KB tool-exported bundles, brittle to hand-edit). **2026-08-08: duplicate consolidated-prototype file resolved** (SUG-DES-013) — `blueprints/swab-app-prototype.html` was byte-identical to the normative `docs/design/swab-prototype-consolidated.html` with no sync guard; it's now a small pointer stub (kept under its filename so old links don't 404), and `agents/design-specialist.md` names the consolidated file as the single normative copy. **2026-08-08: off-token prototype colors resolved** (SUG-DES-014) — the carte illustration's two hardcoded stale-`ombre` SVG nodes and its `#4A5170` depth-cue node now derive from the current `ombre` token (`#8A91B5`, full + `.65` opacity); `#05070F` device-shell chrome documented as an intentional non-token exception in `docs/design-system.md` §3. A full hex inventory of the prototype now matches `tokens.json` except that documented exception. Open: 39 micro-spacing values (component-level odd values below the 7-step scale) still flagged as a design-system.md gap; new components not yet placed on the Design System page; postal-address/email fields need an `area:db` proposal. History in root `CHANGELOG.md`. |
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
