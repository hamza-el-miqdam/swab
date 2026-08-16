# SUG-SPEC-005 — Normative spec text still names retired Expo/RN tech and dead `apps/mobile` paths

- **Area:** specs
- **Topic:** docs
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** spec-specialist (.claude/agents/spec-specialist.md) — name notion-liaison-specialist for the mirror re-sync
- **Related requirement IDs:** VLT-01, FLT-06, SGR-01 (non-functional sections of FS-02/FS-04)

## Problem / Opportunity

The Expo RN app was removed 2026-07-19 (`docs/STATUS.md:9`; CLAUDE.md header), yet requirement text and non-functional sections still bind implementers to it. FS-04 and FS-06 are ⚪ Not started (`docs/STATUS.md:19,21`) — the next implementing agent is told to read these specs first and will hit dead paths:

- **FS-07 VLT-01 (normative, Implemented):** "key in `expo-secure-store`" (`docs/specs/FS-07-identity-vault.md:32`). Reality: iOS Keychain / Android Keystore (`docs/STATUS.md:15` "AES-256-GCM on-device, OS-keystore key"; e2e-scenarios.md:213 already says "Keychain / Keystore"). The spec requirement names a library that no longer exists in the repo.
- **FS-06 FLT-06 (normative, unbuilt):** evaluation must live "in `apps/mobile/src/domain/filtering.ts`" (`docs/specs/FS-06-filtering.md:26`). `apps/mobile` does not exist.
- **FS-04 non-functional (unbuilt):** "Module is pure TS (`apps/mobile/src/domain/fca.ts`), 100% unit-testable, no React imports (mobile agent rule 4)" (`docs/specs/FS-04-subgroups.md:37`). Pure TS is impossible in Swift/Kotlin apps; the mobile agent was decommissioned 2026-07-09 (CLAUDE.md).
- **FS-02 non-functional (Implemented):** "`react-native-reanimated` UI-thread animation … (mobile agent rules 3–4 apply)" (`docs/specs/FS-02-relationship-map.md:37`).

G5: "Docs stay truthful … Code and docs never disagree on `main`."

## Implementation plan

1. `docs/specs/FS-07-identity-vault.md:32` (VLT-01): replace "key in `expo-secure-store`, derived key backed up via a user-held recovery phrase ⚠️ ASSUMPTION" with "key held in the platform secure store (iOS Keychain via CryptoKit / Android Keystore), derived key backed up via a user-held recovery phrase ⚠️ ASSUMPTION".
2. `docs/specs/FS-06-filtering.md:26` (FLT-06): replace "in `apps/mobile/src/domain/filtering.ts`" with "implemented as a pure, UI-framework-free domain module on each platform (`apps/ios` Swift / `apps/android` Kotlin), behavior-locked by shared cross-platform test vectors (pattern: `docs/migration/vault-test-vectors.json`)". Keep the `applyFilters(members, axes, rules) → {included, filtered:[{contact, rule}], lowPriority}` signature — it is the contract.
3. `docs/specs/FS-04-subgroups.md:37`: replace the sentence with "Module is a pure, UI-framework-free domain module on each platform (`apps/ios` Swift / `apps/android` Kotlin), 100% unit-testable, deterministic per SGR-01, behavior-locked by shared cross-platform test vectors (ios/android specialist purity rules apply)."
4. `docs/specs/FS-02-relationship-map.md:37`: replace "`react-native-reanimated` UI-thread animation, no JS-thread work during gestures, memoized contact nodes (mobile agent rules 3–4 apply)" with "GPU/UI-thread animation on each platform (SwiftUI / Compose), no main-thread blocking work during gestures, contact nodes cheap to recompose (ios/android specialist performance rules apply)."
5. Root `CHANGELOG.md` entry (`area:specs`); hand the four changed sentences to notion-liaison-specialist.

## Tests & acceptance criteria

- `grep -rn "apps/mobile\|expo-\|react-native" docs/specs/` → zero hits.
- No behavioral requirement changed: FLT-06's function contract, SGR-01 determinism, VLT-01's AES-256-GCM + recovery-phrase assumption, and FS-02 perf budgets are word-for-word preserved.
- FS-07/FS-02 are Implemented — confirm the reworded text matches what the native apps actually do (STATUS.md:15 notes and `apps/ios`/`apps/android` changelogs) rather than inventing new obligations.

## Risks & gotchas

- Do not silently resolve the dual-implementation question (one shared spec, two native implementations) into anything stronger than "shared test vectors" — mandating a shared library would be a product/architecture decision (G4: stop and ask).
- The cross-platform-vector pattern is proven for the vault (`docs/migration/vault-test-vectors.json`); citing it as the pattern for FCA/filtering keeps SGR-01's determinism testable across platforms.
- Notion mirror: four sentences re-translate; conflicts must be flagged not auto-resolved.
