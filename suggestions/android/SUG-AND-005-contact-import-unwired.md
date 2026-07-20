# SUG-AND-005 — ONB-03 « Importer mes contacts » is a no-op button; READ_CONTACTS is declared but never used

- **Area:** android
- **Topic:** correctness
- **Impact:** high
- **Effort:** M
- **Implementing agent:** android-specialist (.claude/agents/android-specialist.md)
- **Related requirement IDs:** ONB-03, IDT-01, IDT-06

## Problem / Opportunity

FS-01 ONB-03 (docs/specs/FS-01-onboarding.md:22) requires: "Contact addition offers « Importer mes contacts » (permission-gated, hashed client-side per IDT-06) and manual entry." FS-01's status header says Implemented — but on Android the import button does nothing:

- /Users/mikedown/Workspace/Swab/apps/android/app/src/main/kotlin/com/swab/android/MainActivity.kt:154: `onImportContacts = { /* device contact picker: wired at Activity/permission layer */ }` — an empty lambda.
- `ContactsViewModel.addFromDevice` (ContactsViewModel.kt:42-48), which does the IDT-01 on-device hashing, is production dead code: grep shows its only callers are a unit test (ContactsViewModelTest.kt:52) and a doc comment (ContactsScreen.kt:15).
- Meanwhile `AndroidManifest.xml:5` declares `<uses-permission android:name="android.permission.READ_CONTACTS" />` — a dangerous permission the app requests install-time visibility for but never exercises. G1 least-privilege says don't hold scope you don't use, and Play Store review flags declared-but-unused dangerous permissions.
- The graceful-denial copy `Fr.CONTACTS_DENIED` (Fr.kt:40-41, "Pas d'accès aux contacts — aucun souci…") is also never rendered anywhere (grep: only Fr.kt and the ALL_STRINGS list).

The e2e suite honestly documents the gap (E2EFlows.kt:155-156: "device contact import is a no-op in this build"; CHANGELOG.md:19 "ONB-03 device import (unwired)"). Either wire it, or remove the permission and the visibly dead button until it lands — the current state is spec drift with extra attack surface.

## Implementation plan

Preferred: wire the picker (fulfills the spec; keeps copy).

1. In `MainActivity`'s `composable(Routes.CONTACTS)` block (MainActivity.kt:150-160), register a permission + picker flow:
   ```kotlin
   var showDenied by remember { mutableStateOf(false) }
   val pickContact = rememberLauncherForActivityResult(ActivityResultContracts.PickContact()) { uri ->
       uri?.let { contactsViewModel.importFromUri(context.contentResolver, it) }
   }
   val requestPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
       if (granted) pickContact.launch(null) else showDenied = true
   }
   ```
   `ContactsScreen` gains a `deniedVisible: Boolean` parameter rendering `BodyText(Fr.CONTACTS_DENIED)` (ContactsScreen.kt — add below the import button, line 31).
   Note: `ActivityResultContracts.PickContact` reads via the returned content-URI grant, so READ_CONTACTS is only needed to read the phone-number row (`ContactsContract.CommonDataKinds.Phone`) — keep the permission request before launching the picker; the manifest entry becomes genuinely used.
2. Add a small resolver helper `apps/android/app/src/main/kotlin/com/swab/android/onboarding/DeviceContactReader.kt`: `fun read(resolver: ContentResolver, uri: Uri): Pair<String /*name*/, String? /*rawPhone*/>` querying `DISPLAY_NAME` and the first `Phone.NUMBER`. Keep it Android-only glue; the hashing stays in `ContactsViewModel.addFromDevice` (ContactsViewModel.kt:44 — `PhoneHash.hashPhoneNumber`), so the raw number never leaves the handler (IDT-01).
3. `ContactsViewModel.importFromUri(resolver, uri)`: call the reader, then the existing `addFromDevice(name, rawPhone)`. Never store the raw number; only `displayName` + `phoneHash` reach the vault (VaultContact.phoneHash, Vault.kt:26).
4. If product prefers deferring: remove the manifest permission (AndroidManifest.xml:5) and hide the import button until the feature lands, updating docs/STATUS.md notes — but flag the ONB-03 spec drift in the PR rather than silently narrowing the spec (G4).
5. CHANGELOG entry (G5); update the "deliberately not automated" note in future e2e reports.

## Tests & acceptance criteria

- JVM: `DeviceContactReader` is Android-glue (not JVM-testable); keep hashing logic covered by the existing `ContactsViewModelTest` `IDT-01 addFromDevice hashes the raw phone before it reaches the vault` (ContactsViewModelTest.kt:47-52) plus a new case `IDT-01 importFromUri passes name and raw phone to addFromDevice` using a fake reader seam if you inject the reader function.
- Instrumented: the system picker cannot be driven headlessly by Compose tests — classify ONB-03 device import as `manual` in `docs/qa/e2e-coverage.json` (honest classification per G2) instead of the current unwired footnote, and add a manual verification note to the PR.
- Assert the denial path in an instrumented test by calling the screen with `deniedVisible = true` and checking `Fr.CONTACTS_DENIED` renders.
- Run: `cd apps/android && ./gradlew test` and `scripts/e2e-android.sh` (existing flows unaffected — manual-add path untouched).

## Risks & gotchas

- Privacy: the raw phone number must exist only transiently in the reader/handler (IDT-01, PhoneScreen precedent at SignupViewModel.kt:51). Never put it in a state flow, log, or vault field.
- `READ_CONTACTS` runtime denial must keep the flow fully usable (« aucun souci » copy + manual add) — FS-01 acceptance criterion 2 (docs/specs/FS-01-onboarding.md:33).
- Keep `ContactsScreen` previewable/permission-free (its stated design, ContactsScreen.kt:13-16): all launcher wiring stays in MainActivity.
