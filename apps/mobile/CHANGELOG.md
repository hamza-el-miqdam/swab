# Changelog — apps/mobile (area:mobile)

> Newest first. One entry per merged change (or per working-tree milestone before the repo had this file).
> Format: `## YYYY-MM-DD — [REQ-IDs] title` then bullets: what changed, why, anything a future dev must know.
> Agents: updating this file is part of your Definition of Done (G4.7).

## 2026-07-07 — [FCH-01..FCH-08] Fiche contact

- New screen `app/contact/[id].tsx`: the four axes (intimité, rôles·contexte multi-select, état, ressenti) tap-editable, vault-only writes (FCH-01); history feed newest first over 12 months (FCH-04); inline staleness nudge with exactly « C’est toujours ça » / « À revoir plus tard » (FCH-05); FS-06 consequence line for état « en pause » (FCH-06); pending indication + inactive envie eligibility for contacts without `linkedUserId` (FCH-08). The file imports no network module by design.
- Vault extensions (`src/vault/vault.ts`): per-contact `history: VaultHistoryEvent[]` (coarse events — `axis-change`/`reconfirm`/`match`, no free text), `setRoles`, `reconfirmAxes`, `snoozeRetag`, `recordMatch` (for FS-05 later), `linkContact` (for FS-07 discovery later), `createdAt`, `retagSnoozedAt`. Every axis setter appends a history event. Pre-FS-03 blobs hydrate with sane defaults (`reviveVault`); legacy contacts with no timestamps never trigger the nudge (no nagging after an upgrade).
- Pure logic in `src/domain/fiche.ts`: `isRetagDue` (quiet period default 180 days ⚠️ FCH-05 spec assumption, snooze 30 days, both configurable) and `historyWindow` (12 months, newest first; same-millisecond ties resolved by append order). No React, fully unit-tested.
- Vocab centralized in `src/domain/taxonomies.ts` (RINGS/ETATS/RESSENTIS/ROLES + `ETAT_CONSEQUENCE` map, per-état-value so future FS-06 consequences plug in without touching components); `calibrate.tsx` now imports it. **FCH-06 spec-conflict resolution:** `etat.paused: 'en pause'` added as an ÉTAT value (blueprint-attested); `ressenti.paused` kept as-is — the two axes share the wording, not the meaning. Rôles·contexte list is an OQ-FCH-1 placeholder (ami·e, famille, collègue, voisin·e).
- Interim entry point: the carte placeholder (`app/index.tsx`) lists contacts plainly under « Tes fiches » linking to their fiches — temporary until the FS-02 map exists.
- ⚠️ Follow-ups deferred to FS-02: MAP-04 spatial-continuity transition (back is a plain `router.back()` for now) and the real map entry point. Deferred with FS-05: calling `recordMatch` on match reception. No Maestro flow added — the fiche is not one of the three critical paths.

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
