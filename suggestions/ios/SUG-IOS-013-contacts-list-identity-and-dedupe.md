# SUG-IOS-013 — Contacts import list uses `id: \.name`: duplicate names collide; repeated picks create duplicate vault contacts

- **Area:** ios
- **Topic:** correctness
- **Impact:** low
- **Effort:** S
- **Implementing agent:** ios-specialist (.claude/agents/ios-specialist.md)
- **Related requirement IDs:** ONB-03

## Problem / Opportunity

- `ContactsView` renders the importable device contacts with `List(viewModel.importable, id: \.name)` (`apps/ios/Sources/SwabUI/Onboarding/ContactsView.swift:39`). Two device contacts named "Sam" (common in real address books) produce duplicate `ForEach` IDs — SwiftUI's undefined-behavior territory (skipped/mismatched rows, console warnings), and only one of the two people is effectively pickable.
- `DeviceContact` has no identity field at all (`apps/ios/Sources/SwabUI/Onboarding/ContactsImporting.swift:11-19`), so there is nothing better to key on today.
- Neither `pick` nor `addManual` dedupes (`apps/ios/Sources/SwabUI/Onboarding/OnboardingViewModels.swift:163-175`): tapping the same imported contact twice, or adding the same manual name twice, creates two distinct vault contacts (fresh `UUID()` each time in `Vault.addContact`, `Sources/SwabCore/Vault/Vault.swift:185`). The user then has to calibrate a phantom duplicate; nothing in the UI supports removing it (no contact deletion exists yet).

This matters more once the real `CNContactStore` importer (deferred per `ContactsImporting.swift:1-8`) lands — real address books have duplicates as the norm.

## Implementation plan

1. Give `DeviceContact` an identity: add `public let id: String` (populate with `CNContact.identifier` when the system importer lands; `FakeContactsImporter` callers pass explicit ids or default `UUID().uuidString`). Conform to `Identifiable`.
2. Change the list to `List(viewModel.importable) { contact in ... }` (uses `Identifiable`), keeping the button label and `accessibilityLabel(contact.name)` unchanged.
3. Dedupe on pick: in `ContactsViewModel.pick` (`OnboardingViewModels.swift:163-167`), track picked device-contact ids in a `private var pickedIds: Set<String>`; guard-return if already picked. This is device-import bookkeeping, not a product rule — two *different* people with the same display name must remain addable.
4. For `addManual`, do NOT silently dedupe by name (same-name people are legitimate); leave as-is and note the decision in the changelog entry.
5. UI affordance: after a pick, either remove the row from `importable` or render it visibly selected — removing it (`importable.removeAll { $0.id == contact.id }`) is simplest and honest.

## Tests & acceptance criteria

- With the SwabUI test target from SUG-IOS-006 (or fold these into that PR):
  - `test_ONB03_pickSameDeviceContactTwice_addsSingleVaultContact` — `FakeContactsImporter(granted: true, contacts: [c])`, call `pick(c)` twice, `vault.getContacts().count == 1`.
  - `test_ONB03_twoDeviceContactsWithSameName_bothPickable` — two `DeviceContact`s named "Sam" with different ids; picking both yields two vault contacts.
  - `test_ONB03_pickedContact_removedFromImportableList`.
- Run: `cd apps/ios && xcrun swift test`; E2E suite unaffected (imports are stubbed denied in the app shell, `App/SwabApp.swift:181`).

## Risks & gotchas

- `DeviceContact` gains a stored property — update `FakeContactsImporter` call sites; the initializer default keeps source compatibility.
- Do not key vault dedupe on `phoneHash` yet — hashes can collide legitimately (same number shared by two entries) and contact-merge UX is FS-07/IDT-06 territory.
