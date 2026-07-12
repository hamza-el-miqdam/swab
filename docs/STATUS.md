# Swab — Implementation Status

> **The single answer to "what is done in this project?"**
> Update this file in the same PR as any change that starts, advances, or completes a module.
> Detail per change lives in the area changelogs (see [Changelogs](#changelogs)); this file stays a summary.

_Last updated: 2026-07-12_

> **Native migration in progress:** mobile is moving from Expo/React Native (`apps/mobile`) to
> native `apps/ios` (Swift/SwiftUI) + `apps/android` (Kotlin/Compose). `apps/mobile` is the
> **frozen reference implementation** (critical fixes only) until each module reaches native
> parity. Knowledge transfer: `docs/migration/rn-native-handoff.md` + `docs/migration/vault-test-vectors.json`.
> Module statuses below describe the RN reference. **Wave 1 (FS-07 client scope + FS-01),
> Wave 2 (FS-02 Relationship Map), and Wave 3 (FS-03 Contact Card, greenfield — no RN
> equivalent to port) all landed 2026-07-10**: `apps/ios` (110/110 tests, 93.9% `SwabCore`
> coverage) and `apps/android` (108/108 tests, 98.32% domain coverage). Waves 1–2 were built and
> run for real on Simulator/emulator; Android additionally got a full live walkthrough against
> `docker compose up`'s API (welcome → phone → OTP → contacts → calibrate → done → Carte,
> including tapping a contact node to open the peek sheet and toggling list mode), which found
> and fixed four real bugs along the way — emulator-to-host networking, an Android Keystore IV
> restriction, a Compose navigation state-loss bug, and a density-scaling bug in the radial map's
> `Canvas` rendering — see `apps/android/CHANGELOG.md`'s two 2026-07-10 entries. iOS is confirmed
> running on the "iPhone 17" Simulator (Welcome screen live, Carte screen screenshot-verified via
> a temporary seeded view) but not interactively walked — this environment has no assistive-access
> permission for scripted Simulator input. Wave 3 (FS-03) landed test-suite-verified plus an
> independent build check on both platforms, but has **not** had a live on-device walkthrough yet
> on either platform — flagged as a follow-up. A pre-existing bug was also found in the RN-ported
> `CalibrateScreen`'s ring-picker (unrelated to Wave 2, not yet fixed) — see
> `docs/migration/rn-audit-map.md`. Full per-criterion status is tracked in that file's Wave 1,
> Wave 2, and Wave 3 checklists, not duplicated here. **Wave 4 (E2E/QA), Android side, landed
> 2026-07-10:** a Compose UI instrumented test suite (`apps/android/app/src/androidTest/kotlin/com/swab/android/e2e/`,
> 8 tests + regression coverage for the Wave 1 nav-state-loss bug and the Wave 2 density-scaling
> bug) ran end-to-end via `./gradlew connectedAndroidTest` against a booted Pixel_6_Pro emulator
> and the live `docker compose up` API — **10/10 instrumented tests passed, 0 failures** (includes
> the pre-existing Keystore-IV regression test). One real test bug was found and fixed along the
> way (a stale assumption about `CarteViewModel` not refreshing on return from Fiche — it does);
> see `apps/android/CHANGELOG.md`'s 2026-07-10 Wave 4 entry. The `CalibrateScreen` ring-picker
> text-wrap bug remains open and un-regression-tested (rings 3/4 are still out of scope for
> automated calibration flows). **Wave 4 completed 2026-07-12 on both platforms:** Android's
> suite grew to 16 tests (added a legacy-vault backward-compat test — compile-time-excluded
> debug-only seed hook, `E2ESeedHooks`, plus ONB-09/MAP-02/MAP-06/FCH-04/FCH-08 gap coverage) —
> **16/16 passed** on a clean `./gradlew :app:clean :app:connectedDebugAndroidTest`. iOS built a
> from-scratch `SwabAppUITests` XCUITest target (13 tests: the original 8 plus the same five gap
> requirements) — first full run found every onboarding-touching test failing with a Keychain
> entitlement error (`errSecMissingEntitlement`, traced to `CODE_SIGNING_ALLOWED = NO` on all six
> `project.pbxproj` build configs, a stale Wave-1 default that predates any app-process Keychain
> use); switched to ad hoc signing (`CODE_SIGN_IDENTITY = "-"`, Simulator-only) and re-ran —
> **13/13 passed**. Both platforms verified independently from clean by the lead, not just agent
> self-report. E2E is now a hard Definition-of-Done gate (`agents/_global-directives.md` G2,
> both specialists' DoD) enforced via `scripts/e2e-{ios,android}.sh` → `test-results/e2e/e2e-report.md`,
> with a per-requirement scenario/coverage manifest in `docs/qa/` (see `docs/qa/e2e-scenarios.md`,
> `docs/qa/e2e-coverage.json`) covering all 40 FS-01/02/03/07 requirement IDs. CI wiring
> (macOS/emulator runners) is a filed follow-up, not yet built — see `docs/migration/rn-audit-map.md`.

## Modules (functional specs)

| Spec | Module | Status | Lead | Notes |
|---|---|---|---|---|
| FS-07 | Identity & Vault | 🟡 In progress | Backend | API done: phone-OTP auth (`/auth/otp`), JWT sessions, opaque vault store (`/vault`, versioned), `/health` + `/ready`. Mobile vault client done (AES-256-GCM on-device, SecureStore key). **Missing:** contact discovery endpoint, web invite landing. |
| FS-01 | Onboarding | 🟢 Implemented | Mobile | Signup (phone → OTP), contact import + skip path, radial calibration, completion. Test names carry ONB-02/03/04/07/08. Dev-mode OTP returned in API response (no SMS provider yet). |
| FS-02 | Relationship Map | 🟢 Implemented | Mobile | Radial map + list fallback from the vault, nav Carte/Envie/Sous-groupes, peek sheet, pan/zoom. MAP-01..09 tests green. Fiche transition now wired to FS-03 in both apps; clustering deferred (OQ-MAP-1). |
| FS-03 | Contact Card | 🟢 Implemented (iOS + Android native) | Mobile | Greenfield — never built in the RN reference. Four tap-editable axes, 12-month history feed, FCH-05 staleness nudge, FCH-06 filter-consequence text (with a documented `en pause` taxonomy divergence), FCH-08 pending-contact support. FCH-01..08 tests green in both `apps/ios` and `apps/android`; no reciprocity signal shown (FCH-03 deviation, see `apps/android/CHANGELOG.md`), FCH-04 relationship/match events deferred pending FS-04/05. |
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
| CI | 🟡 | `ci.yml` skeleton exists. Missing: scope guard, privacy-audit job, coverage enforcement, OpenAPI diff gate, native E2E workflow (macOS + emulator runners — filed follow-up). |
| Mobile E2E gate (Wave 4) | 🟢 | Local, agent-enforced Definition-of-Done gate — `scripts/e2e-ios.sh` / `scripts/e2e-android.sh` → `test-results/e2e/e2e-report.md`, requirement coverage manifest in `docs/qa/`. Not yet wired into CI. |
| Lint (repo-wide ESLint) | 🟢 | Flat config: root `eslint.config.mjs` (type-aware typescript-eslint) + Expo preset in `apps/mobile`. All packages run `eslint .` — the mobile `exit 0` stub is gone. |
| Design system (« Nuit ») | 🟡 | Token contract in `docs/design-system.md` + prototype in `docs/design/`; mobile `theme.ts` adopts it. Penpot library (colour styles, typographies, components, tokens) is built on the **Swab — Design System « Nuit »** page. **2026-07-12: the Penpot "Prototype — Parcours consolidé" page was restructured** — 22 screens regrouped from a flat sibling row into 7 named `Flow N · <Title>` boards (flex-layout, numeric screen order preserved, zero overlap/containment violations) plus 32 verified `NavigateTo` click interactions wiring in-flow sequences and cross-flow entry points. One real token drift fixed (segmented-control cells were radius 8, off the 10/12/14/999/57/64 scale — now linked to `radius.input`). 39 recurring micro-spacing values (1/6/10/13px in `paycard`/`tile`/`fitem`/`rowi`/`chip`) flagged as a **design-system.md documentation gap** (used too consistently to be mistakes; the documented spacing scale may be incomplete) — not mechanically overwritten, needs prototype-level verification. **2026-07-12: new `Flow 0 · Authentification` board** (5 screens: `1 · Bienvenue` reparented from Flow 1, `2 · Numéro de téléphone`, `3 · Code de vérification`, `4 · Votre nom`, `5 · Bon retour` — new) covering phone+OTP sign-up/sign-in per IDT-01..03; Flow 1 renumbered 1–4 locally (global IDs on Flows 2–7 untouched). Two new components (Text field, OTP code input; empty/focus/error states) built and `export_shape`-verified as swatches inside Flow 0, and documented in `docs/design-system.md` §4 — **formal placement into the "Swab — Design System" page's `§ Composants` section is still pending**: Penpot only allows writes to the page open in the connected browser tab, which stayed on "Prototype — Parcours consolidé" for this whole session (see gotcha in `agents/design-specialist.md`); needs a follow-up pass once the Design System page is the active tab. New-device sign-in (recovery phrase) remains an explicit gap, OQ-IDT-2. **2026-07-12 (follow-up pass): `1 · Bienvenue` simplified** — removed the "paycard" cohort-info block (résidence name / synced-entry date / expected-member count); the app has no such data about the user at this point in the flow (before phone auth even runs), so it was replaced with a plain one-tagline + one-sentence welcome, consistent with product law 5. CTA re-confirmed unchanged (`-> 2 · Numéro de téléphone`). **New `5 · Vos coordonnées` screen inserted** between `4 · Votre nom` and the renumbered `6 · Bon retour` — two optional fields (Adresse, Email), reusing the existing Text field component, always-enabled "Continuer" (effect identical to a skip, no fields ever block progress, per ONB-03/ONB-06 precedent). Rewired `4 · Votre nom -> 5 · Vos coordonnées -> 1 · Onboarding · clés`; `6 · Bon retour`'s own routing (`-> 6 · Carte des relations`) is unchanged. **Flags two candidate `User` fields (postal address, email) with no home in `swab-domain-spec.md`/`packages/db/prisma/schema.prisma` today — needs an `area:db` proposal before any backend/app work**; copy is proposed, not spec-sourced (marked as such in the HTML). Privacy note: a postal address isn't classification data, but it is sensitive PII outside the current `Vault`-encryption story — flagged for the data-steward to weigh in on storage/encryption placement when the `area:db` proposal is opened, no defensive redesign done here. Zero overlap/containment violations re-verified on Flow 0 after the insert+renumber (6/6 screens, `export_shape`-verified individually and as a full board). **2026-07-12: on `22 · Paramètres`, the "Mariages & naissances" event-notification row was split into two independent rows ("Mariages" + "Naissances"), each with its own toggle — cloned from the existing row (identical style/default), layout-driven reflow, zero overflow; kept in sync with `docs/design/swab-prototype-consolidated.html` and `blueprints/swab-app-prototype.html`.** |
| Agents (AIDD) | 🟢 | Single source of truth in `agents/`; `node scripts/render-agents.mjs` generates the Copilot (`.github/`) and Claude Code (`.claude/agents/`) copies (`--check` for CI). Areas: ios, android, backend, web, db, devops, design, notion-liaison. 2026-07-09: mobile-specialist (Expo RN) decommissioned; replaced by ios-specialist (area:ios) + android-specialist (area:android), knowledge inherited via `docs/migration/rn-native-handoff.md`. 2026-07-12: the design-blueprint agent and the design-system-token agent were merged into one `area:design` specialist (`agents/design-specialist.md`) covering blueprints, the Nuit token contract, and the Penpot library. |
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
