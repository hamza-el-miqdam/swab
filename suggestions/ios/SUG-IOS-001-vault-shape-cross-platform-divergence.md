# SUG-IOS-001 — FS-03 vault fields diverge from Android: same blob is not round-trippable across platforms

- **Area:** ios
- **Topic:** correctness
- **Impact:** high
- **Effort:** M
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** VLT-01, FCH-04, FCH-05, IDT-05

## Problem / Opportunity

The handoff contract (`docs/migration/rn-native-handoff.md:95-110` §2.5, and §7 point 4: "A blob freshly encrypted on one platform decrypts on the others") requires that native vault models round-trip the same JSON. The Wave-1 fields do, but the FS-03 additions were made independently on each platform and now disagree in three ways:

1. **Field name:** iOS uses `stalenessSnoozedUntil` (`apps/ios/Sources/SwabCore/Vault/Vault.swift:43`), Android uses `staleSnoozedUntil` (`apps/android/app/src/main/kotlin/com/swab/android/vault/Vault.kt:44`). A blob written on one platform silently loses the snooze on the other (both decoders are unknown-field-tolerant, so this is silent data loss, not a crash).
2. **History location and shape:** iOS stores `history` per contact as `[FicheHistoryEvent]` with an enum `kind` (`Vault.swift:39`, `apps/ios/Sources/SwabCore/Fiche/FicheHistoryEvent.swift:8-32`); Android stores a flat `history: List<VaultHistoryEvent>` at the `VaultData` level with `contactId`/`axis`/`summary`/`at` fields (`Vault.kt:56-69`). Neither platform can read the other's history at all.
3. **Date encoding:** iOS encodes `Date` with `JSONEncoder()`'s default strategy — seconds since 2001-01-01 as a Double (`Vault.swift:156,164` create bare `JSONDecoder()`/`JSONEncoder()` with no `dateDecodingStrategy`/`dateEncodingStrategy`); Android uses epoch **milliseconds** as `Long` (`Vault.kt:42,44`). Even if names matched, timestamps would be misinterpreted by ~55 years.

Today this is masked because the POC is single-device (VLT-02), but IDT-05 (device transfer / recovery) and the handoff's own §7 gate make the blob a cross-platform contract. `docs/migration/vault-test-vectors.json` predates FS-03, so no test catches this.

This needs a cross-platform decision first (which shape wins) — per G4, do not silently pick one. The iOS-side work below assumes the resolution is recorded in the handoff doc / an `area:specs` issue.

## Implementation plan

1. Open an issue proposing a canonical FS-03 vault-shape extension (suggest: per-contact `history`, field name `stalenessSnoozedUntil`, all timestamps as **epoch milliseconds integers** — epoch millis is the RN-era JS-native convention and what Android already does). Get the android-specialist and spec-specialist to ack; record the agreed shape in a new subsection of `docs/migration/rn-native-handoff.md` §2.5 (that doc edit can ride the iOS PR since both native agents import it).
2. In `apps/ios/Sources/SwabCore/Vault/Vault.swift`, stop using default date coding: create private helpers
   `static func makeDecoder() -> JSONDecoder` / `makeEncoder() -> JSONEncoder` that set `dateDecodingStrategy`/`dateEncodingStrategy` = `.custom` reading/writing `Int64` epoch milliseconds (`.millisecondsSince1970` is the built-in that does exactly this — use it). Use them at `hydrate()` (`Vault.swift:156`) and `persist(_:)` (`Vault.swift:164`).
3. Backward compatibility for already-written iOS blobs (which contain reference-date Doubles): in `VaultContact.init(from:)` (`Vault.swift:81-94`), decode `lastAxisChangeAt`/`stalenessSnoozedUntil` tolerantly — try `Date` via the new strategy; on failure or implausible value (e.g. raw number < 10^11 means it was reference-date seconds), fall back to `Date(timeIntervalSinceReferenceDate:)`. Same for `FicheHistoryEvent.date`. Simplest robust approach: decode as `Double`, and treat values < 4102444800 (year 2100 in seconds) as legacy reference-date seconds, larger values as epoch millis.
4. Align the field name with whatever step 1 decides. If Android's `staleSnoozedUntil` wins instead, change `CodingKeys` in `Vault.swift:71-74` to map `stalenessSnoozedUntil` → `"staleSnoozedUntil"` while also accepting the old key on decode (`decodeIfPresent` under both keys).
5. Extend the vectors: add an `fs03VaultShape` section to `apps/ios/Tests/SwabCoreTests/Fixtures/vault-test-vectors.json`'s sibling (a NEW fixture file, e.g. `vault-shape-fs03-vectors.json`, since `docs/migration/vault-test-vectors.json` is shared and its update belongs to the cross-platform issue) containing one canonical JSON blob with history + staleness fields, and assert byte-level key names and date representation.

## Tests & acceptance criteria

- `Tests/SwabCoreTests/VaultShapeInteropTests.swift`:
  - `test_VLT01_fs03Fields_encodeWithCanonicalKeyNamesAndEpochMillis` — encode a `VaultData` with history + staleness, decode with `JSONSerialization`, assert the exact key set and that dates serialize as integer epoch millis.
  - `test_VLT01_legacyReferenceDateBlob_decodesWithoutTimeShift` — a hand-written JSON fragment using the old Double reference-date value decodes to the expected `Date` (±1s).
  - `test_VLT01_androidShapeSnoozeKey_decodes` (only if step 1 chooses dual-key tolerance).
- Run: `cd apps/ios && xcrun swift test`. All existing 110 tests must stay green, including `RegressionAndResilienceE2ETests.test_vaultBackwardCompat_legacyShapeDoesNotCrashOnLaunch` via `scripts/e2e-ios.sh`.

## Risks & gotchas

- Do NOT change shape unilaterally — G4 forbids guessing product/contract decisions; land the cross-platform agreement first.
- Existing on-device blobs (dev/TestFlight installs) contain reference-date Doubles; skipping step 3 corrupts every stored `lastAxisChangeAt` into the year ~1970/2001 and could re-trigger staleness nudges (FCH-05) spuriously.
- `FicheHistoryEvent.Kind` uses Swift-synthesized enum Codable (`{"axisChanged":{"axis":...,"value":...}}`) — if the agreed canonical history shape is Android's flat `axis/summary` form, that is a larger migration; scope it in the cross-platform issue rather than this PR.
