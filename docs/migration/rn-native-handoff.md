# RN → Native Handoff — Knowledge Inheritance from the Mobile Engineering Specialist

> **Audience:** the iOS Native Specialist (`area:ios`, `apps/ios/**`) and the Android Native
> Specialist (`area:android`, `apps/android/**`). This document captures everything the
> decommissioned Mobile Engineering Specialist (`area:mobile`) knew that outlives the React
> Native toolchain. Both native agent prompts import this file — treat it as **binding**
> alongside `agents/_global-directives.md` and the specs in `docs/specs/`.
>
> `apps/mobile` (Expo/React Native) remains in the repo as the **frozen reference
> implementation** until each feature reaches native parity. Read its source when in doubt —
> it is the executable spec for everything below — but do not extend it.

## 1. What exists, and in what order to migrate it

Per `docs/STATUS.md` (authoritative for done/not-done; spec headers all say `Approved`):

| Spec | Module | RN status | Migration note |
|---|---|---|---|
| FS-07 | Identity & Vault | 🟡 Mobile vault client done; API done | **Migrate first** — everything depends on it; crypto interop is the highest risk. |
| FS-01 | Onboarding | 🟢 Implemented | Migrate with FS-07 (signup is the first half of onboarding). |
| FS-02 | Relationship Map | 🟢 Implemented | Second wave. Pure geometry ports 1:1. |
| FS-03 | Contact Card | ⚪ Not started | Greenfield — build natively only, after FS-02 parity. |
| FS-04 | Subgroups (FCA) | ⚪ Not started | Greenfield. Must stay a pure, UI-free on-device function. |
| FS-05 | Envie & Match | ⚪ Not started | Greenfield. Two-sided spec (mobile + backend). |
| FS-06 | Filtering rules | ⚪ Not started | Greenfield. Rules live only in the vault. |

Reference implementation map (all under `apps/mobile/`):

- Vault crypto: `src/vault/crypto.ts` · vault store: `src/vault/vault.ts` · sync: `src/vault/sync.ts`
- Phone hashing: `src/lib/phoneHash.ts` · base64: `src/lib/base64.ts` · local kv: `src/lib/db.ts`
- API client (privacy-constrained): `src/api/client.ts` · session/JWT: `src/lib/session.ts`
- Onboarding state machine: `src/onboarding/state.ts` · pending signup: `src/onboarding/signup.ts`
- Screens: `app/onboarding/*` (welcome → phone → otp → contacts → calibrate → done), `app/(main)/*`
- Radial map: `src/map/{RadialMap,ContactNode,PeekSheet,RingList}.tsx`, `geometry.ts`, `etatColors.ts`, `labels.ts`
- French copy (normative, spec-verbatim): `src/i18n/fr.ts`
- Tests worth reading as contracts: `apps/mobile/test/` + `src/**/*.test.ts` (names carry REQ-IDs)

## 2. Binary contracts — MUST match byte-for-byte across RN, iOS, Android

These are wire/interop contracts, not implementation suggestions. `docs/migration/vault-test-vectors.json`
contains fixed-input vectors generated from the reference implementation; **every native crypto
implementation must reproduce them exactly in its unit tests before anything else is built.**

### 2.1 Vault encryption (FS-07 VLT-01)

- Primitive: **AES-256-GCM**, 32-byte key, 12-byte random IV, 16-byte auth tag, no AAD.
- Wire format: `base64( IV(12) ‖ AUTH_TAG(16) ‖ CIPHERTEXT )` — standard base64 alphabet
  (`+/`), **with** `=` padding. Plaintext is UTF-8 JSON of the vault data.
- iOS: CryptoKit `AES.GCM` — note `AES.GCM.SealedBox.combined` is `IV ‖ CIPHERTEXT ‖ TAG`;
  you must reorder to `IV ‖ TAG ‖ CIPHERTEXT` on seal and back on open.
- Android: `javax.crypto` `Cipher.getInstance("AES/GCM/NoPadding")` — `doFinal` returns
  `CIPHERTEXT ‖ TAG`; reorder likewise.
- Key material: 32 random bytes, generated **on-device right after OTP verification, before
  any classification input is possible** (ONB-02). The key never leaves the device (recovery
  phrase backup is FS-07 OQ-IDT-2, explicitly out of scope). Storage:
  - RN reference: `expo-secure-store` under id `swab.vault.key.v1` (base64 of the raw key).
  - iOS: Keychain, `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, no iCloud sync.
  - Android: Android Keystore (or EncryptedFile/Keystore-wrapped key) — never plain SharedPreferences.
  - The store id / account name should keep the `swab.vault.key.v1` versioned-name convention.

### 2.2 Phone hashing (FS-07 IDT-01/IDT-06)

- Raw phone numbers never leave the device. What is sent is
  `SHA-256( SALT + ":" + normalized_number )`, **lowercase hex**.
- `SALT` is a per-deployment namespace shared by all clients (not a secret):
  env `EXPO_PUBLIC_PHONE_HASH_SALT`, default `swab-poc-phone-salt-v1`. Native apps must use
  the same value per deployment or contact discovery breaks.
- Normalization (best-effort E.164, `src/lib/phoneHash.ts`): trim; remember whether the
  trimmed string starts with `+`; strip every non-digit; re-prefix `+` if it was there.
  Identical normalization on all platforms or the same contact hashes differently.

### 2.3 API surface consumed by the client (FS-07; reference `src/api/client.ts`)

Base URL from env (`EXPO_PUBLIC_API_URL`, default `http://localhost:3001`). JSON bodies,
`authorization: Bearer <accessToken>` once logged in.

| Endpoint | Body → Response | Notes |
|---|---|---|
| `POST /auth/otp/request` | `{ phoneHash }` → `{ devCode? }` | POC: non-prod returns the OTP in `devCode` (no SMS provider yet, OQ-IDT-1). |
| `POST /auth/otp/verify` | `{ phoneHash, code, displayName? }` → `{ accessToken, refreshToken }` | JWT session. |
| `POST /vault` | `{ blob, version }` → `{ version }`, or **409** on version conflict | `blob` is the opaque base64 ciphertext. |
| `GET /vault` | → `{ blob, version }`, or **404** if none | |

**The only user-data shapes a client may ever send:** `phoneHash`, `code`, `displayName`,
and the opaque `{ blob, version }`. There is deliberately no type for rings, rôles, état,
ressenti, scope names, or filter reasons in any client networking layer. If you find
yourself adding one — stop; you are breaking the product's core promise (G1).

### 2.4 Vault sync semantics (FS-07 VLT-02/VLT-04; reference `src/vault/sync.ts`)

Push `{ blob, version }`; on 409, GET the server vault, retry **once** with
`(serverVersion ?? localVersion) + 1`; if it still conflicts, fail loudly. Single-device
POC: last write wins. Local version starts at 1 and increments on every persist.

### 2.5 Vault data shape (inside the ciphertext — never on the wire in clear)

```ts
{ contacts: Array<{
    id: string;            // UUID v4
    displayName: string;
    phoneHash?: string;    // stays local until FS-07 discovery runs
    ring?: 1 | 2 | 3 | 4;  // intimité, 1 = innermost; unset until calibrated (ONB-04)
    roles: string[];
    etat?: string;
    ressenti?: string;
} > }
```

Serialized as UTF-8 JSON before encryption. Native models must round-trip this JSON
(unknown-field-tolerant parsing recommended — the shape will grow with FS-03/04/06).

### 2.6 Onboarding state machine (ONB-08; reference `src/onboarding/state.ts`)

Steps, in order: `welcome → phone → contacts → calibrate → done → complete`. The current
step is persisted locally in plain storage (a step name is not classification data) under
`onboarding.step.v1`; app launch resumes at the persisted step. The step stays `phone`
until OTP verification succeeds — the pending phone hash is memory-only, so a restart
during OTP re-asks the number.

## 3. Business rules & privacy invariants (product-defining)

1. **Offline-first is the privacy architecture, not a feature.** The four classification
   axes (intimité/ring, rôles, état, ressenti), filter rules, subgroups, and relation
   history live only on-device, encrypted at rest. Map/fiche/sous-groupes must work with
   zero connectivity; only emit-envie and match reception require network.
2. The vault module is the only place classification axes exist in memory; the sync module
   ships ciphertext only. Accessors must return **fresh copies**, never live internal
   references (VLT-01 regression: in-place mutation of a shared reference made the UI skip
   re-renders — the same aliasing bug is reproducible in Swift/Kotlin).
3. Scope resolution happens on-device: portée → concrete recipient ID list **before**
   calling `POST /envies` (FS-05, future). The transparent-filtering screen renders from
   local data only.
4. FCA subgroup detection (FS-04, future) is a pure function — no UI imports, 100%
   unit-testable, property-tested.
5. Server code never parses, logs, indexes, or infers classification data. Anything that
   would let it is a bug by definition.

## 4. Product ethos (enforced in review)

- **No counters, no badges, no streaks, no "match!" celebration animation.** Ever.
- Soft French language; UI copy comes from the specs **verbatim** — port the strings in
  `apps/mobile/src/i18n/fr.ts`, do not rewrite or "improve" them. French is the primary
  locale; the brand صواب means Arabic/RTL is on the roadmap — keep layouts RTL-safe
  (leading/trailing, never hardcoded left/right).
- "Passer" (pass on an envie) must be indistinguishable from silence on the other side —
  verify in integration tests.
- Accessibility: every touchable has a role + label; dynamic type respected; the radial
  map keeps a screen-reader-navigable list fallback.

## 5. Known divergences & deferred items (do not silently "fix")

- **État→color mapping and 4 rings vs the blueprint's 5** are unresolved divergences
  (noted in `src/map/etatColors.ts`). Carry them as-is; resolution is a product decision.
- Radial map clustering beyond ~150 contacts is deferred (OQ-MAP-1).
- FS-03 "grow-from-node" fiche transition and map spatial continuity are deferred; the
  peek sheet's « Ouvrir la fiche » button is wired but disabled (FS-03 seam).
- SMS provider unselected; dev-mode OTP comes back in the API response.

## 6. RN-toolchain-only knowledge (dies with `apps/mobile` — kept for its maintenance)

Not applicable to native work, needed only if the frozen RN app must be touched:
Jest `transformIgnorePatterns` must match pnpm's `.pnpm` layout; `react-native-quick-base64`
is pinned to exactly 2.2.2 (Expo SDK 53 autolinking skips pure-C++ TurboModules without
`android/build.gradle`); native-module changes need a full `expo run:ios|android` rebuild
(Metro only swaps JS); transitive native deps must be direct deps in
`apps/mobile/package.json`; Jest maps `react-native-quick-crypto` to `node:crypto`
(see `apps/mobile/test/quick-crypto-node.js`).

## 7. Verification gate for "knowledge transfer complete"

A native platform is considered correctly bootstrapped when its test suite proves, using
`docs/migration/vault-test-vectors.json`:

1. Decrypting each vector's `blob` with the vector's key yields the vector's plaintext.
2. Encrypting the plaintext with the vector's key **and IV** reproduces the blob exactly
   (test-only IV injection; production code must always use fresh random IVs).
3. Hashing each phone-vector input with the default salt yields the expected lowercase hex.
4. A blob freshly encrypted on one platform decrypts on the others (covered transitively
   by 1+2, since the vectors were generated by the RN reference implementation).
