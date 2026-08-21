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

    /// SUG-IOS-009: `setMany` must land every entry in one file write, not
    /// one `set` per key — a crash between two separate writes is exactly
    /// how `Vault.persist`'s blob/version pair could land mismatched.
    func test_setMany_persistsAllKeysAcrossReopen() async {
        let url = makeTempURL()
        defer { try? FileManager.default.removeItem(at: url) }
        let store = FileKeyValueStore(url: url)
        await store.setMany(["a": "1", "b": "2"])

        let reopened = FileKeyValueStore(url: url)
        let a = await reopened.get("a")
        let b = await reopened.get("b")
        XCTAssertEqual(a, "1")
        XCTAssertEqual(b, "2")
    }

    /// SUG-IOS-009: the vault blob/version pair is ciphertext + a version
    /// counter, not secret on its own, but should carry the same
    /// defense-in-depth as the Keychain-backed wrap key
    /// (`SecureStore.swift`'s `WhenUnlockedThisDeviceOnly`).
    ///
    /// Asserts what `persist()` *requests*, which is the only portable
    /// contract: `SwabCoreTests` runs on the macOS host (`swift test`), and
    /// macOS honours data-protection classes inconsistently — see
    /// `test_write_appliesCompleteFileProtection_whereTheHostHonoursIt`.
    /// Has teeth because `persist()` passes exactly this value to
    /// `Data.write(to:options:)`; dropping the option here changes the write.
    func test_write_requestsCompleteFileProtectionUnlessOpen() {
        XCTAssertTrue(
            FileKeyValueStore.writeOptions.contains(.completeFileProtectionUnlessOpen),
            "the on-disk vault file must carry the same protection class as its Keychain wrap key"
        )
        XCTAssertTrue(
            FileKeyValueStore.writeOptions.contains(.atomic),
            "a torn write would leave the vault blob unparseable"
        )
    }

    /// The end-to-end half of the assertion above: the file really does come
    /// out of `persist()` carrying the class, on hosts that implement data
    /// protection at all.
    ///
    /// Whether the host does is established independently, by a control write
    /// with no protection option: if the control and the probe land on the
    /// same class, the platform is ignoring protection classes entirely and
    /// there is nothing here to assert. macOS 26 honours them (the probe
    /// reports `completeUnlessOpen`); the macOS 15 CI runner does not (both
    /// report the volume default `completeUntilFirstUserAuthentication`),
    /// which is why this cannot be a plain unconditional assertion.
    func test_write_appliesCompleteFileProtection_whereTheHostHonoursIt() async throws {
        let controlURL = makeTempURL()
        defer { try? FileManager.default.removeItem(at: controlURL) }
        try Data("control".utf8).write(to: controlURL, options: [.atomic])
        let controlClass = try controlURL.resourceValues(forKeys: [.fileProtectionKey]).fileProtection

        let url = makeTempURL()
        defer { try? FileManager.default.removeItem(at: url) }
        let store = FileKeyValueStore(url: url)
        await store.set("k", value: "v")
        let values = try url.resourceValues(forKeys: [.fileProtectionKey])

        try XCTSkipIf(
            values.fileProtection == controlClass,
            "host does not implement data-protection classes (both writes report \(String(describing: controlClass))) — the requested-options test covers the contract instead"
        )
        XCTAssertEqual(values.fileProtection, .completeUnlessOpen)
    }
}
