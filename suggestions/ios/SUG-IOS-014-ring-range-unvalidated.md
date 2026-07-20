# SUG-IOS-014 — `VaultRing.range` is never enforced: `setRing`/`setFicheRing` accept any Int, contradicting the type's own doc comment

- **Area:** ios
- **Topic:** correctness
- **Impact:** low
- **Effort:** S
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** VLT-01, ONB-04, FCH-01

## Problem / Opportunity

`Vault.swift` declares `public typealias IntimacyRing = Int  // 1...4; validated at call sites (VaultRing).` (`apps/ios/Sources/SwabCore/Vault/Vault.swift:14-18`), but no call site validates:

- `Vault.setRing(id:ring:)` (`Vault.swift:191-193`) and `Vault.setFicheRing(id:ring:)` (`:220-224`) accept any `Int` and persist it into the encrypted blob.
- A ring of 0 or 7 then flows into rendering math that assumes 1...4: `MapGeometry.ringRadius` extrapolates (`Sources/SwabCore/Carte/MapGeometry.swift:23-25`), `MapGeometry.nodeSize(ring:)` goes negative for ring ≥ 12 (`:63-65` → `44 - (ring-1)*4`, and a negative `.frame(width:)` is a runtime warning/undefined layout), `CarteLabels.ringLabel[ring]` returns nil so `setFicheRing`'s history event records `value: nil` (`Vault.swift:221`), and `RingListView` drops the contact from every ring section while it is also not "unplaced" — it vanishes from list mode entirely (`Sources/SwabUI/Carte/RingListView.swift:13-22` builds sections only for `MapGeometry.rings` and `ring == nil`).

Today's UI only offers valid rings, but `Vault` is a public API in `SwabCore`, blobs can arrive via sync from another client (VLT-02), and Android is a separate implementation — the vault, as the single owner of this data, should enforce its own invariant.

## Implementation plan

1. Extend `VaultError` with `case invalidRing(Int)` (`Vault.swift:123-125`).
2. Add `guard VaultRing.range.contains(ring) else { throw VaultError.invalidRing(ring) }` at the top of `setRing` and `setFicheRing`.
3. Defensive read path: in `VaultContact.init(from:)` (`Vault.swift:86`), decode ring then normalize out-of-range values to `nil` (`ring = VaultRing.range.contains(r) ? r : nil`) — an out-of-range ring from a foreign/corrupt blob renders as "unplaced" (visible in the MAP-09 tray, nothing hidden) instead of breaking layout math.
4. Fix the stale comment at `Vault.swift:14` to say "validated by Vault's setters".

## Tests & acceptance criteria

- Additions to `Tests/SwabCoreTests/VaultTests.swift`:
  - `test_VLT01_setRing_outOfRange_throwsInvalidRing` — rings 0 and 5 both throw; contact unchanged.
  - `test_VLT01_decodeContactWithOutOfRangeRing_normalizesToUnplaced` — JSON with `"ring":9` decodes with `ring == nil`.
- Addition to `Tests/SwabCoreTests/FicheVaultTests.swift`:
  - `test_FCH01_setFicheRing_outOfRange_throwsAndAppendsNoHistory` — history stays empty after the throw.
- Run: `cd apps/ios && xcrun swift test`.

## Risks & gotchas

- View models currently call these setters with `try?` — a thrown `invalidRing` is silently absorbed, which is acceptable here (UI can't produce one) but pairs naturally with SUG-IOS-005's reporter.
- Normalizing on decode must NOT rewrite the blob eagerly — only change what a subsequent legitimate persist writes; never mutate storage during `hydrate()`.
- Keep `VaultRing.range` the single source of the bounds; do not duplicate `1...4` literals in the new guards.
