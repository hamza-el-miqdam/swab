# Changelog — apps/mobile (area:mobile)

> Newest first. One entry per merged change (or per working-tree milestone before the repo had this file).
> Format: `## YYYY-MM-DD — [REQ-IDs] title` then bullets: what changed, why, anything a future dev must know.
> Agents: updating this file is part of your Definition of Done (G4.7).

## 2026-07-06 — [MAP-07] Carte pan/zoom + 150-contact density

- Pinch (1×–3×) and pan on the radial canvas via `GestureDetector`: gestures write reanimated shared values in worklets — zero JS-thread work during interaction (mobile rules 3–4). `GestureHandlerRootView` now wraps the app in `app/_layout.tsx`.
- Clamping is pure and unit-tested (`clamp`, `panBound` in `src/map/geometry.ts`): zoom bounded to 1×–3×, pan bounded to the scaled overflow so the map can never leave the viewport.
- 150-contact render asserted in tests; the 60fps claim still needs the manual on-device check (both platforms) before release sign-off.
- **Deferred:** clustering past ~150 contacts (OQ-MAP-1 — blueprint shows ≤ ~30, defer until real data).
- Test infra gotcha: RNGH's `fireGestureHandler` treats the FIRST `ACTIVE` event as `onStart`; `onUpdate` only fires from the second `ACTIVE` on. Shared-value → style propagation needs fake timers + `advanceTimersByTime` (reanimated `setUpTests()` is called in `test/setup.ts`; `react-native-gesture-handler/jestSetup` added to jest `setupFiles`).

## 2026-07-06 — [MAP-04] Peek sheet + légende des états

- Tap any contact (node, list row, or tray chip) → `src/map/PeekSheet.tsx`: reanimated slide-up, scrim, handle, rows Intimité / État / Rôles (unset axes shown as a quiet « — »).
- **FS-03 seam, flagged assumption:** « Ouvrir la fiche » is rendered DISABLED (`accessibilityState={{ disabled: true }}`) — visible and honest rather than hidden. FS-03 flips it to `router.push('/fiche/[id]')` and owns the grow-from-node transition (MAP-04 spatial continuity is NOT satisfied yet — deferred with the fiche itself).
- « Légende des états » toggle on the carte explains the état swatches on demand (collapsed by default).
- No bottom-sheet dependency added; scrim/sheet close is exercised via testID (a labelled close control awaits FS-03 copy).

## 2026-07-06 — [MAP-01/03/05/06/08/09] Radial map from the vault

- `app/(main)/carte.tsx` is the real home surface: loads `getContacts()` on focus (so an FS-03 re-tag animates on return), radial map default, list mode via Switch, calm empty state (approved copy), légende.
- `src/map/geometry.ts`: ring math extracted VERBATIM from the ONB-04 calibration screen (which now imports it — one spatial truth, ONB suites untouched). 150-per-ring positions are finite, deterministic, on-ring (property-style test).
- `src/map/ContactNode.tsx`: memoized initials node, size steps down per ring, ring changes animate with `withTiming` on the UI thread — first mount snaps (no travel), only changes move.
- **Flagged assumption — état → color:** blueprint palette mapped onto the SHIPPED 3-état vocabulary (disponible `#8FB59A` · occupé `#C8917E` · ailleurs `#8AA0BE`, unset → neutral surface) in `src/map/etatColors.ts`. The blueprint's richer 5-ring/5-état taxonomy is a divergence to resolve in a follow-up `area:mobile` issue — do NOT remap silently.
- **Flagged assumption — unplaced tray:** never-calibrated contacts stay visible in a chip tray under the map (nothing hidden silently); they also get a « — » section in list mode.
- `src/map/RingList.tsx` (MAP-08): SectionList grouped by ring, rows announce « name — ring » (TalkBack acceptance), feature-equivalent press action.
- MAP-05 is enforced structurally: a test scans `src/map/**` and `app/(main)/**` for API-client/fetch/WebSocket imports and fails on any hit. MAP-09: no TextInput exists on the carte (asserted).

## 2026-07-06 — [MAP-02] Navigation shell: Carte / Envie / Sous-groupes

- `app/(main)/_layout.tsx` (expo-router Tabs) with a custom bar `src/ui/nav-bar.tsx`: exactly three label-only tabs — badges/counters impossible by construction (product law 5). Envie & Sous-groupes are calm placeholders (approved copy) holding FS-05/FS-04 slots.
- Entry gate `app/index.tsx`: onboarding-complete now redirects to `/carte` (was an inline placeholder).
- i18n: `carte.title` is now « Ma carte » (blueprint verbatim), `carte.placeholder` removed; added `carte.subtitle/empty/me/listMode/legend/openFiche/sheet.*`, `nav.*`, `envie.*`, `sousgroupes.*`.

## 2026-07-06 — Real ESLint (Expo preset + repo base) replaces the `exit 0` stub

- `eslint.config.mjs` composes `eslint-config-expo/flat` with the root config; `lint` script now runs `eslint .`. New devDeps: `eslint@^9` (required — see root changelog gotcha), `eslint-config-expo@^57`.
- Lint-driven cleanups, no behavior change: `String()` around the untyped `process.env.EXPO_PUBLIC_*` reads (`src/api/client.ts`, `src/lib/phoneHash.ts`), removed redundant type assertions and stale `no-var-requires` directives in tests, justified disable for the mount-time load effect in `app/onboarding/calibrate.tsx`.

## 2026-07-06 — [VLT-01] Fix vault re-render bug + test/typecheck gate repair

- **Bug fix:** `src/vault/vault.ts` `getContacts()` returned the internal mutable cache array; after `setRing` mutated it in place, React saw the same reference and skipped re-renders — ring placements never appeared. Now returns a fresh array with shallow-copied entries. Regression test included.
- Jest now runs under pnpm: `transformIgnorePatterns` rewritten to match `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>` paths (all 6 suites previously failed to parse; also fixed a latent grouping bug in the old regex).
- Added `@types/node@^20.17.0` (devDependency): test infrastructure runs real AES-256-GCM against `node:crypto` as the Jest stand-in for the native module. Production code untouched.
- Coverage raised from ~50% to 98% lines: new tests for onboarding state/resume (ONB-08), phone + OTP screens (ONB-02), contacts skip/grant (ONB-03), calibration (ONB-04), completion (ONB-07), vault store (VLT-01), vault sync (VLT-04), phone hashing (IDT-06), API client (IDT-02).

## 2026-07-06 — [VLT-01] Fix Android boot crash: QuickBase64 native module not linked

- Pinned `react-native-quick-base64` to **exactly 2.2.2** (app dependency + `pnpm.overrides` at the workspace root). v3.0.0 is a pure-C++ TurboModule with no `android/build.gradle`, which Expo SDK 53 autolinking silently skips → `TurboModuleRegistry.getEnforcing('QuickBase64')` crashed at boot.
- ⚠️ Do not "upgrade" this package without verifying Expo autolinking supports it. The root override keeps the transitive copy (via `@craftzdog/react-native-buffer`) in lockstep with the linked native version under pnpm.
- Native-module changes require a full rebuild (`npx expo run:android`) — Metro reload is not enough.

## 2026-07-05 — [ONB-01..08] Onboarding flow (commit e2914a0)

- Implemented signup (phone → OTP), contact import with skip path, radial calibration, and completion steps under `app/onboarding/`.
- On-device vault: AES-256-GCM via `react-native-quick-crypto`, key in `expo-secure-store`, encrypted blob synced to `POST /vault`.
- French copy from FS-01 verbatim (`src/i18n/fr.ts`). Dev-mode OTP displayed as « Code (dev): … » — no SMS provider yet.
- ⚠️ Requires an Expo **dev client** (`npx expo run:ios|android`) — native crypto means Expo Go won't work.
