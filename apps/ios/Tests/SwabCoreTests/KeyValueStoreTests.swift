/// Storage semantics contract (both `InMemoryKeyValueStore` and
/// `FileKeyValueStore` must behave identically for callers): last-write-wins
/// per key, read-your-writes.
import Foundation
import XCTest

@testable import SwabCore

final class InMemoryKeyValueStoreTests: XCTestCase {
    func test_getMissingKey_returnsNil() async {
        let store = InMemoryKeyValueStore()
        let value = await store.get("missing")
        XCTAssertNil(value)
    }

    func test_setThenGet_roundTrips() async {
        let store = InMemoryKeyValueStore()
        await store.set("k", value: "v1")
        await store.set("k", value: "v2")
        let value = await store.get("k")
        XCTAssertEqual(value, "v2")
    }
}

final class FileKeyValueStoreTests: XCTestCase {
    private func makeTempURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("swab-kv-\(UUID().uuidString).json")
    }

    func test_freshFile_startsEmpty() async {
        let url = makeTempURL()
        defer { try? FileManager.default.removeItem(at: url) }
        let store = FileKeyValueStore(url: url)
        let value = await store.get("k")
        XCTAssertNil(value)
    }

    func test_setThenGet_roundTrips() async {
        let url = makeTempURL()
        defer { try? FileManager.default.removeItem(at: url) }
        let store = FileKeyValueStore(url: url)
        await store.set("onboarding.step.v1", value: "contacts")
        let value = await store.get("onboarding.step.v1")
        XCTAssertEqual(value, "contacts")
    }

    /// The whole point of the file backing: a fresh store instance over the
    /// same file must see prior writes (simulated process restart, ONB-08).
    func test_persistsAcrossFreshStoreInstance() async {
        let url = makeTempURL()
        defer { try? FileManager.default.removeItem(at: url) }

        let first = FileKeyValueStore(url: url)
        await first.set("k", value: "persisted")

        let second = FileKeyValueStore(url: url)
        let value = await second.get("k")
        XCTAssertEqual(value, "persisted")
    }

    func test_overwritingKey_lastWriteWins() async {
        let url = makeTempURL()
        defer { try? FileManager.default.removeItem(at: url) }
        let store = FileKeyValueStore(url: url)
        await store.set("k", value: "first")
        await store.set("k", value: "second")

        let reopened = FileKeyValueStore(url: url)
        let value = await reopened.get("k")
        XCTAssertEqual(value, "second")
    }
}
