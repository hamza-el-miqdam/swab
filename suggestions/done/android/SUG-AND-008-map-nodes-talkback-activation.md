# SUG-AND-008 — Radial map nodes are not activatable by TalkBack and have sub-48dp touch targets

- **Area:** android
- **Topic:** accessibility
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** MAP-01, MAP-04, MAP-08

## Problem / Opportunity

`ContactNode` in /Users/mikedown/Workspace/Swab/apps/android/app/src/main/kotlin/com/swab/android/ui/carte/RadialMap.kt:230-247 builds its tap handling from raw `pointerInput`:

```kotlin
.semantics {
    role = Role.Button
    contentDescription = Labels.contactLabel(contact)
}
.pointerInput(contact.id) {
    detectTapGestures(onTap = { onPress(contact) })
}
```

Two problems:

1. **No `onClick` semantics action.** `detectTapGestures` registers no `SemanticsActions.OnClick`, so TalkBack announces the node as a button (role + label are set) but double-tap-to-activate performs ACTION_CLICK, which has no handler — the node cannot be opened by screen-reader users. The list fallback (RingList.kt:68 uses `Modifier.clickable`, which is correct) satisfies MAP-08, but the map itself advertises button semantics it doesn't honor — worse than not advertising them. Contrast with `RingList`'s rows and every Material button elsewhere, which get the action from `clickable`/`Button`.
2. **Touch targets below the 48dp minimum.** `MapGeometry.nodeSize` (MapGeometry.kt:47) is `44 - (ring-1)*4` → 44/40/36/32dp for rings 1-4; the Box is exactly that size (RadialMap.kt:233 `.size(sizeDp)`). Material accessibility guidance (and the `minimumInteractiveComponentSize` default Compose applies to real click targets) requires 48dp; ring-4 nodes are 32dp — hard to hit for motor-impaired users, on top of being the smallest visual targets.

## Implementation plan

1. Replace the pointerInput+semantics pair on `ContactNode`'s Box with `combinedClickable`-free plain `clickable` (no ripple concerns — keep `indication = null` if the ripple looks wrong on the map):
   ```kotlin
   .clip(CircleShape)
   .background(background)
   .border(1.dp, border, CircleShape)
   .clickable(
       interactionSource = remember { MutableInteractionSource() },
       indication = null,
       onClickLabel = Fr.CARTE_OPEN_FICHE,
       role = Role.Button,
   ) { onPress(contact) }
   .semantics { contentDescription = Labels.contactLabel(contact) }
   ```
   `clickable` registers the OnClick semantics action, merges role, and TalkBack double-tap works. Delete the now-redundant `role` from the semantics block and the `pointerInput` block (RadialMap.kt:237-243).
2. Enlarge the interactive area without changing visuals: wrap the visual circle in a parent Box of `max(size, 48f).dp` that owns the `clickable` + semantics, and center the visual circle inside it. Adjust the offset by the delta so `MapGeometry.positionOn` centers stay identical:
   ```kotlin
   val touchSize = maxOf(size, 48f)
   val pad = (touchSize - size) / 2f
   Box(Modifier.offset((x.value - pad).dp, (y.value - pad).dp).size(touchSize.dp).clickable(...)) {
       Box(Modifier.align(Alignment.Center).size(size.dp).clip(CircleShape)... )
   }
   ```
   Overlap between adjacent 48dp targets on dense rings is acceptable (golden-angle spread, MapGeometry.kt:22, keeps neighbors apart); tap dispatch goes to the topmost node as before.
3. Verify `MeNode` (RadialMap.kt:169-180) is non-interactive — it is (no click), so its 44dp size is fine; leave it.
4. CHANGELOG entry (G5).

## Tests & acceptance criteria

- Instrumented, in `RelationshipMapE2ETest` (runs via `scripts/e2e-android.sh`):
  - `test_MAP08_mapNode_hasClickActionForTalkBack`: after onboarding with one placed contact, `onNodeWithContentDescription(Labels.contactLabel(...))` → `assertHasClickAction()` (compose-ui-test built-in) and `performClick()` opens the peek sheet (assert `Fr.CARTE_OPEN_FICHE` appears).
  - Existing `test_MAP04_peekSheetShowsCorrectRowsAndOpenFicheIsEnabled` (RelationshipMapE2ETest.kt:49) must stay green — it currently taps via coordinates/semantics and will exercise the new path.
  - `test_densityRegression_placedNodeSizeIsNotCollapsed` (RelationshipMapE2ETest.kt:172) measures rendered node pixels — update it to measure the inner visual circle (give the inner Box a stable `testTag` if needed) so the 48dp touch wrapper doesn't fail the size assertion.
- JVM: none needed (pure UI change); `./gradlew test` stays green.

## Risks & gotchas

- Keep the tap-vs-pan gesture split working: the map's `detectTransformGestures` sits on the outer container (RadialMap.kt:93-107); `clickable` on nodes coexists with it the same way `detectTapGestures` did, but verify pinch-zoom over a node still pans/zooms (E2E manual check on emulator).
- The density regression test is the guard for the documented dp-vs-px bug (RadialMap.kt:67-73) — do not change `MapGeometry` values while adjusting offsets.
- `onClickLabel` reuses `Fr.CARTE_OPEN_FICHE` — no new copy invented (Fr.kt:12-14 rule).
