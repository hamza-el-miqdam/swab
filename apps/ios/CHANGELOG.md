# apps/ios — Changelog

> Newest first. Format: `## YYYY-MM-DD — [REQ-IDs] title` + what/why/gotchas, ≤ ~15 lines per entry (G5).

> Entries before 2026-08-15 are archived in [../../docs/archive/ios-CHANGELOG-pre-2026-08-15.md](../../docs/archive/ios-CHANGELOG-pre-2026-08-15.md) — moved, not deleted.


## 2026-08-16 — [FCH-09, SUG-IOS-011] Stored classification values are identifiers, not French copy

- **What changed:** new `ClassificationValues.swift` with `Etat` / `Ressenti` / `RoleContexte` (identifiers per FS-03 § *Stored value vocabulary*). The vault now persists `busy`, not `occupé`; `EtatColors` is keyed by `Etat` instead of by `Fr.t(...)`; `FicheFilterConsequence` compares `.paused`; `Vault`'s setters take the typed value, so writing display copy into the vault is a compile error.
- **Why:** ADR-001 stage 0b. Rewording a label — or shipping the planned Arabic locale — silently orphaned every stored value: the contact kept its data but rendered as unset through `color(for:)`'s fallback. After stage 2 these are database columns and the same rewording becomes a data migration.
- **Nothing user-visible changes.** Chips still render French labels; the views map label → value at the boundary, the way the Intimité ring already did. The XCUITest suite needed one edit (`etats[2]` → `etatLabels[2]`) and no new assertions.
- **Dual-read is permanent.** `legacyFrenchTokens` is a **frozen literal, never derived from `Fr`** — deriving it would re-create the exact coupling being removed. Unknown tokens (`douceur`, `confidente`, still present in `vault-test-vectors.json`) round-trip verbatim and render unset; a read never drops data.
- **History events deliberately still store the display label.** FCH-04 hands event creation to the server at ADR-001 stage 2, which will model it properly; re-encoding it now would be thrown away. `test_FCH01_setFicheRoles_persistsAndAppendsHistory` pins both halves at once.
- **Gotcha for the Android mirror:** Swift `String ==` uses canonical equivalence, so `"occupé"` matches whether it was stored NFC or NFD. **Kotlin compares UTF-16 code units and will not** — the port must normalise to NFC before the legacy lookup, or accented tokens silently fail to migrate.
- Verified: `xcrun swift test` 140/140 · `scripts/e2e-ios.sh` **PASS**, 16/16 executed, zero drift-guard failures.
