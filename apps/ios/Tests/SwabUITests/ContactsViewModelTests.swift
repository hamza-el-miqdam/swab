/// ONB-03 — `DeviceContact` identity + `ContactsViewModel.pick` dedupe
/// (SUG-IOS-013): duplicate device-contact display names must not collide,
/// and re-picking the same device contact must not create a second vault
/// contact.
import XCTest
@testable import SwabUI
import SwabCore

@MainActor
final class ContactsViewModelTests: XCTestCase {
    private func makeViewModel(contacts: [DeviceContact]) -> (ContactsViewModel, Vault) {
        let vault = Vault(kv: InMemoryKeyValueStore(), secureStore: InMemorySecureStore())
        let onboarding = OnboardingStateStore(kv: InMemoryKeyValueStore())
        let importer = FakeContactsImporter(granted: true, contacts: contacts)
        let viewModel = ContactsViewModel(vault: vault, importer: importer, onboarding: onboarding)
        return (viewModel, vault)
    }

    func test_ONB03_pickSameDeviceContactTwice_addsSingleVaultContact() async throws {
        let contact = DeviceContact(id: "device-1", name: "Sam", phone: "+15551234567")
        let (viewModel, vault) = makeViewModel(contacts: [contact])
        await viewModel.importContacts()

        await viewModel.pick(contact)
        await viewModel.pick(contact)

        let contacts = try await vault.getContacts()
        XCTAssertEqual(contacts.count, 1)
    }

    func test_ONB03_twoDeviceContactsWithSameName_bothPickable() async throws {
        let a = DeviceContact(id: "device-a", name: "Sam")
        let b = DeviceContact(id: "device-b", name: "Sam")
        let (viewModel, vault) = makeViewModel(contacts: [a, b])
        await viewModel.importContacts()

        await viewModel.pick(a)
        await viewModel.pick(b)

        let contacts = try await vault.getContacts()
        XCTAssertEqual(contacts.count, 2)
    }

    func test_ONB03_pickedContact_removedFromImportableList() async throws {
        let contact = DeviceContact(id: "device-1", name: "Sam")
        let (viewModel, _) = makeViewModel(contacts: [contact])
        await viewModel.importContacts()
        XCTAssertEqual(viewModel.importable.count, 1)

        await viewModel.pick(contact)

        XCTAssertTrue(viewModel.importable.isEmpty)
    }
}
