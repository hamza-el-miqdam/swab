# SUG-DES-006 — État node palette is hardcoded twice in app code and absent from the token SSOT

- **Area:** design
- **Topic:** tokens
- **Impact:** medium
- **Effort:** M
- **Implementing agent:** design-specialist (.claude/agents/design-specialist.md) for the SSOT + regen; ios-specialist / android-specialist for repointing `EtatColors`
- **Related requirement IDs:** MAP-03

## Problem / Opportunity

The design persona defines the defect precisely: "A colour that exists in the app but not in the token file … is a defect" (`agents/design-specialist.md:10-11`). The MAP-03 état→color mapping is exactly that, duplicated on both platforms:

- `apps/ios/Sources/SwabCore/Carte/EtatColors.swift:9-11` — `available = "#8FB59A"`, `busy = "#C8917E"`, `away = "#8AA0BE"`.
- `apps/android/app/src/main/kotlin/com/swab/android/carte/EtatColors.kt:18-22` — the same three hex literals, independently maintained.

None of these values exists in `packages/ui/tokens/tokens.json:9-24`; they are also close-but-not-equal cousins of the Nuit status hues (`sauge #6FBFA3`, `corail #D98A73`, `ciel #84A9E6`), which invites accidental "harmonization" in either direction. Two hand-maintained copies of an off-charter palette = guaranteed eventual drift.

## Implementation plan

1. design-specialist: add an `etat` group to `tokens.json` **carrying the values verbatim** (this is extraction, not invention — they come from the Carte blueprint via the RN port, per the divergence flag in `EtatColors.swift:1-7`):

   ```json
   "color": {
     ...,
     "etat-disponible": { "value": "#8fb59a", "role": "MAP-03 état node — disponible. Blueprint-ported; 3-état vocabulary (5-état divergence flagged, rn-native-handoff.md §5)." },
     "etat-occupe":     { "value": "#c8917e", "role": "MAP-03 état node — occupé." },
     "etat-ailleurs":   { "value": "#8aa0be", "role": "MAP-03 état node — ailleurs." }
   }
   ```

2. Run `node packages/ui/scripts/generate.mjs`; commit `tokens.json` + all four generated files (allowed per the codegen exception, `agents/design-specialist.md:29-36`). Document the three tokens in `docs/design-system.md` §1 (new "État (MAP-03)" sub-table) with the divergence note.
3. Open `area:ios` and `area:android` proposals: repoint `EtatColors.swift:9-11` to `DesignTokens.Color.etatDisponible/etatOccupe/etatAilleurs` and `EtatColors.kt:19-21` to `DesignTokens.Color.ETAT_DISPONIBLE/...` — keeping the `Fr.t(...)` keying and null/fallback behavior (`EtatColors.swift:34-39`, `EtatColors.kt:27-30`) untouched.
4. Existing `EtatColorsTests` on both platforms must keep passing unchanged (values identical — pure indirection).

## Tests & acceptance criteria

- `grep -rn "8FB59A\|C8917E\|8AA0BE" apps/ios/Sources apps/android/app/src/main` matches only the generated `DesignTokens.*` files afterwards.
- `xcrun swift test` (110+ tests) and `./gradlew test` (216+) stay green with zero test edits — proves value-neutral refactor.
- `node packages/ui/scripts/generate.mjs --check` passes.

## Risks & gotchas

- **Do NOT change the hex values to sauge/corail/ciel** — the 3-état palette is a flagged product divergence ("do not silently expand/resolve", `EtatColors.kt:5-15`); this suggestion only moves where the values live.
- The état *names* in token keys are UI/classification vocabulary; that's fine in client-side token files but must never leak into API payloads (G1 privacy invariant) — tokens.json is client/design data only.
- Classification semantics stay on-device: the tokens name presence états already shown in UI copy (`Fr.ETAT_*`), no new exposure.
