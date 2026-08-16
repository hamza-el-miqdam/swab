# SUG-IOS-011 — Persisted classification values are French display strings: vault data is coupled to UI copy (and to the future RTL/Arabic roadmap)

- **Area:** ios
- **Topic:** architecture
- **Impact:** medium
- **Effort:** L
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** VLT-01, FCH-06, MAP-03

## Problem / Opportunity

The vault stores état/ressenti (and fiche-role) values as the literal French display strings:

- `CalibrateView` passes `Fr.t(.etatAvailable)` etc. straight into `vault.setEtat` (`apps/ios/Sources/SwabUI/Onboarding/CalibrateView.swift:38-39, 167-181`), and `FicheVocabulary.etats/ressentis` are built from `Fr.t(...)` (`apps/ios/Sources/SwabCore/Fiche/FicheVocabulary.swift:15-16`).
- Rendering and logic then key off those strings: `EtatColors.byLabel` is a dictionary keyed by `Fr.t(...)` (`apps/ios/Sources/SwabCore/Carte/EtatColors.swift:16-20`), and `FicheFilterConsequence` does `etat == Fr.t(.ressentiPaused)` string comparison (`apps/ios/Sources/SwabCore/Fiche/FicheFilterConsequence.swift:20`).

Consequences: (a) any future copy change — including the planned Arabic/RTL locale (`Fr.swift:3-4`, handoff `docs/migration/rn-native-handoff.md:142-144`) — silently orphans persisted data: a contact stored with `etat = "disponible"` stops matching `byLabel` and renders as "unset" (the `color(for:)` fallback, `EtatColors.swift:34-38`); (b) FS-06 filtering logic will inherit string-fragile comparisons; (c) cross-platform blob portability requires both platforms to freeze identical French strings forever.

This shape is inherited from the RN reference (`handoff:95-107` defines `etat?: string`) — so per G4/handoff §5, do **not** change it silently; it needs a coordinated decision (ios + android + specs). The iOS work below is the proposal to bring to that issue.

## Implementation plan

1. Open a cross-platform issue proposing stable identifiers in the vault: `etat ∈ {"available","busy","away"}`, `ressenti ∈ {"light","precious","paused"}` (matching the existing `I18nKey` suffixes, `Fr.swift:55-63`), display strings resolved at render time via `Fr`. Get android-specialist + spec-specialist ack; note it changes §2.5 of the handoff and interacts with SUG-IOS-001's shape reconciliation (do both in one contract bump).
2. iOS implementation once agreed:
   - Add `public enum Etat: String, Codable { case available, busy, away }` and `public enum Ressenti: String, Codable { case light, precious, paused }` in `SwabCore` with `var label: String { Fr.t(...) }`.
   - Migrate on decode: in `VaultContact.init(from:)` (`Sources/SwabCore/Vault/Vault.swift:81-94`), map legacy French strings → identifiers (a fixed dictionary: `"disponible"→"available"`, etc.); encode identifiers only.
   - Replace `EtatColors.byLabel` keys with identifiers; `FicheFilterConsequence` compares identifiers; `CalibrateView`/`FicheView` chips display `label` but write identifiers.
3. Keep `FicheVocabulary.roles` (placeholder taxonomy, OQ-FCH-1) as-is unless the same issue resolves the role vocabulary — flag but don't block.

## Tests & acceptance criteria

- `Tests/SwabCoreTests/EtatMigrationTests.swift`:
  - `test_VLT01_legacyFrenchEtatString_decodesToIdentifier` — JSON with `"etat":"disponible"` decodes to `.available` and re-encodes as `"available"`.
  - `test_MAP03_colorLookup_byIdentifier_neverFallsBackForKnownValues` — all three états resolve to their palette colors, not the unset fallback.
  - `test_FCH06_pausedConsequence_matchesOnIdentifierNotCopy` — consequence text appears for `.paused` even if `Fr` copy hypothetically changed (assert against the enum, not `Fr.t`).
- Existing `FichePrivacyInvariantTests` classification-string list (`Tests/SwabCoreTests/FichePrivacyInvariantTests.swift:32-37`) must be extended with the new identifier strings — identifiers are still classification data and must never appear on the wire.
- Run: `cd apps/ios && xcrun swift test` + full `scripts/e2e-ios.sh` (UI copy unchanged, so E2E lookups stay valid).

## Risks & gotchas

- This is a vault-shape change: it MUST ride the same coordinated contract bump as SUG-IOS-001, with dual-read (legacy French strings accepted on decode indefinitely) — never a hard cutover.
- The E2E and unit suites assert French strings in *UI* labels — keep display behavior byte-identical; only the persisted representation changes.
- `EtatColors`'s 3-vs-5 état divergence is separately flagged (`EtatColors.swift:3-7`); do not expand the value set here.
