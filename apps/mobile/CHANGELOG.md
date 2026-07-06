# Changelog — apps/mobile (area:mobile)

> Newest first. One entry per merged change (or per working-tree milestone before the repo had this file).
> Format: `## YYYY-MM-DD — [REQ-IDs] title` then bullets: what changed, why, anything a future dev must know.
> Agents: updating this file is part of your Definition of Done (G4.7).

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
