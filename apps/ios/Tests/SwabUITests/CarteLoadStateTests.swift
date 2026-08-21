/// SUG-IOS-004 / VLT-01 / MAP-06: `CarteViewModel.loadState` must
/// distinguish "genuinely empty vault" from "data present but unreadable" —
/// the two must never collapse into the same MAP-06 calm-empty UI state
/// (that was silent data loss). The suggestion this fixes assumed no
/// `SwabUITests` target existed yet (SUG-IOS-006); SUG-IOS-005 added one, so
/// the state machine is exercised directly here rather than only through the
/// `RegressionAndResilienceE2ETests` XCUITest.
import XCTest
@testable import SwabUI
import SwabCore

@MainActor
final class CarteLoadStateTests: XCTestCase {
    func test_VLT01_freshVault_loadStateIsLoadedNotUnreadable() async throws {
        let vault = Vault(kv: InMemoryKeyValueStore(), secureStore: InMemorySecureStore())
        let vm = CarteViewModel(vault: vault)

        await vm.refresh()

        XCTAssertEqual(vm.loadState, .loaded)
        XCTAssertEqual(vm.contacts, [])
    }

    func test_VLT01_corruptBlob_loadStateIsUnreadableNotLoaded() async throws {
        let kv = InMemoryKeyValueStore()
        await kv.set("vault.blob.v1", value: "not-a-valid-ciphertext-blob")
        let vault = Vault(kv: kv, secureStore: InMemorySecureStore())
        let vm = CarteViewModel(vault: vault)

        await vm.refresh()

        XCTAssertEqual(vm.loadState, .unreadable)
        XCTAssertEqual(vm.contacts, [], "contacts stay empty on failure, but loadState must say why")
    }
}
