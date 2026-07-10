# Swab — Implementation Status

> **The single answer to "what is done in this project?"**
> Update this file in the same PR as any change that starts, advances, or completes a module.
> Detail per change lives in the area changelogs (see [Changelogs](#changelogs)); this file stays a summary.

_Last updated: 2026-07-10_

> **Native migration in progress:** mobile is moving from Expo/React Native (`apps/mobile`) to
> native `apps/ios` (Swift/SwiftUI) + `apps/android` (Kotlin/Compose). `apps/mobile` is the
> **frozen reference implementation** (critical fixes only) until each module reaches native
> parity. Knowledge transfer: `docs/migration/rn-native-handoff.md` + `docs/migration/vault-test-vectors.json`.
> Module statuses below describe the RN reference. **Wave 1 (FS-07 client scope + FS-01) and
> Wave 2 (FS-02 Relationship Map) native parity both landed 2026-07-10**: `apps/ios` (77/77 tests,
> 92.7% `SwabCore` coverage) and `apps/android` (80/80 tests, 98.4% domain coverage). Both apps
> were built and run for real on Simulator/emulator; Android additionally got a full live
> walkthrough against `docker compose up`'s API for both waves (welcome → phone → OTP → contacts →
> calibrate → done → Carte, including tapping a contact node to open the peek sheet and toggling
> list mode), which found and fixed four real bugs along the way — emulator-to-host networking, an
> Android Keystore IV restriction, a Compose navigation state-loss bug, and a density-scaling bug
> in the radial map's `Canvas` rendering — see `apps/android/CHANGELOG.md`'s two 2026-07-10
> entries. iOS is confirmed running on the "iPhone 17" Simulator (Welcome screen live, Carte screen
> screenshot-verified via a temporary seeded view) but not interactively walked — this environment
> has no assistive-access permission for scripted Simulator input. A pre-existing bug was also
> found in the RN-ported `CalibrateScreen`'s ring-picker (unrelated to Wave 2, not yet fixed) — see
> `docs/migration/rn-audit-map.md`. Full per-criterion status is tracked in that file's Wave 1 and
> Wave 2 checklists, not duplicated here.

## Modules (functional specs)

| Spec | Module | Status | Lead | Notes |
|---|---|---|---|---|
| FS-07 | Identity & Vault | 🟡 In progress | Backend | API done: phone-OTP auth (`/auth/otp`), JWT sessions, opaque vault store (`/vault`, versioned), `/health` + `/ready`. Mobile vault client done (AES-256-GCM on-device, SecureStore key). **Missing:** contact discovery endpoint, web invite landing. |
| FS-01 | Onboarding | 🟢 Implemented | Mobile | Signup (phone → OTP), contact import + skip path, radial calibration, completion. Test names carry ONB-02/03/04/07/08. Dev-mode OTP returned in API response (no SMS provider yet). |
| FS-02 | Relationship Map | 🟢 Implemented | Mobile | Radial map + list fallback from the vault, nav Carte/Envie/Sous-groupes, peek sheet, pan/zoom. MAP-01..09 tests green. Fiche transition pending FS-03; clustering deferred (OQ-MAP-1). |
| FS-03 | Contact Card | ⚪ Not started | Mobile | Depends on FS-02 ✅. « Ouvrir la fiche » seam is wired (disabled) in the peek sheet. |
| FS-04 | Subgroups (FCA) | ⚪ Not started | Mobile | Pure on-device domain module. |
| FS-05 | Envie & Match | ⚪ Not started | Mobile + Backend | The only two-agent spec; OpenAPI seam not yet drafted. |
| FS-06 | Filtering rules | ⚪ Not started | Mobile | Rules live in the vault. |

Legend: ⚪ Not started · 🟡 In progress · 🟢 Implemented (spec acceptance tests green) · 🔵 Hardened (privacy audit passed)

## Platform & infrastructure

| Item | Status | Notes |
|---|---|---|
| Monorepo (Turborepo + pnpm, strict TS) | 🟢 | `apps/mobile` (frozen RN reference), `apps/api`, `packages/db`. `apps/ios` (Swift Package, not yet an Xcode app) and `apps/android` (Gradle/Compose) exist with Wave 1 built but are deliberately outside the turbo/pnpm pipeline — run `xcrun swift test` / `./gradlew test` directly. `apps/web`, `packages/ui`, `packages/api-client`, `tools/orchestrator` not created yet. |
| Database schema v0.1 | 🟢 | `users`, `vaults`, `envies` + seed. Privacy invariant holds: no classification columns. |
| Local dev stack | 🟢 | `docker compose up --build` → Postgres :5432, API :3001, Adminer :8080. |
| Mobile dev clients | 🟢 | iOS + Android via `expo run:*` (native crypto → Expo Go unsupported). Android SDK/emulator setup scripted in `scripts/`. |
| CI | 🟡 | `ci.yml` skeleton exists. Missing: scope guard, privacy-audit job, coverage enforcement, OpenAPI diff gate. |
| Lint (repo-wide ESLint) | 🟢 | Flat config: root `eslint.config.mjs` (type-aware typescript-eslint) + Expo preset in `apps/mobile`. All packages run `eslint .` — the mobile `exit 0` stub is gone. |
| Agents (AIDD) | 🟢 | Single source of truth in `agents/`; `node scripts/render-agents.mjs` generates the Copilot (`.github/`) and Claude Code (`.claude/agents/`) copies (`--check` for CI). 2026-07-09: mobile-specialist (Expo RN) decommissioned; replaced by ios-specialist (area:ios) + android-specialist (area:android), knowledge inherited via `docs/migration/rn-native-handoff.md`. |
| Spec ↔ Notion sync (French mirror) | 🟢 | All 7 `docs/specs/FS-*.md` mirrored, translated to French, under Notion page "Swab — Spécifications (FS-*)" for the non-dev co-founder to read/comment/edit. `docs/specs/.notion-sync.json` tracks per-spec snapshots; re-diffed on every invocation of the notion-liaison-specialist agent. Code stays canonical; conflicts are flagged, never auto-resolved. |
| SMS provider (OTP) | ⚪ | Dev mode returns the code in the response; provider selection is an open question. |
| Privacy audit (playbook §6) | ⚪ | Must run before any external tester and after every schema/API change. |

## Changelogs

Every change lands with an entry in its area changelog (rule G4.7 in `agents/_global-directives.md`):

- `apps/ios/CHANGELOG.md` — `area:ios`
- `apps/android/CHANGELOG.md` — `area:android`
- [apps/mobile/CHANGELOG.md](../apps/mobile/CHANGELOG.md) — frozen RN reference (critical fixes only)
- [apps/api/CHANGELOG.md](../apps/api/CHANGELOG.md) — `area:backend`
- [packages/db/CHANGELOG.md](../packages/db/CHANGELOG.md) — `area:db`
- [CHANGELOG.md](../CHANGELOG.md) (repo root) — `area:devops`, docs, agents, tooling, cross-cutting

## How to update this file

- Starting a module → flip it to 🟡 with a one-line note of what's in flight.
- Finishing a module → 🟢 only when the spec's acceptance criteria have green tests; update the spec's `Status:` header to `Implemented` in the same PR.
- 🔵 is set only by a passing privacy audit (playbook §6).
- Keep notes to one or two lines — history belongs in the changelogs, not here.
