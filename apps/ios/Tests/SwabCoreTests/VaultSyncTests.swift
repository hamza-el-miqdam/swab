/// FS-07 VLT-02/VLT-04: push, 409 → re-pull server version, retry once with
/// (serverVersion ?? localVersion) + 1, fail loudly if the retry also conflicts.
import Foundation
import XCTest

@testable import SwabCore

private actor FakeVaultSyncApi: VaultSyncApi {
    enum PushBehavior {
        case ok(version: Int)
        case conflictThenOk(afterVersion: Int)
        case alwaysConflict
    }

    private var pushBehavior: PushBehavior
    private var serverVault: EncryptedVaultBlob?
    private(set) var pushCalls: [(blob: String, version: Int)] = []
    private(set) var getVaultCallCount = 0

    init(pushBehavior: PushBehavior, serverVault: EncryptedVaultBlob?) {
        self.pushBehavior = pushBehavior
        self.serverVault = serverVault
    }

    func pushVault(blob: String, version: Int) async throws -> VaultPushResult {
        pushCalls.append((blob, version))
        switch pushBehavior {
        case .ok(let v):
            return .ok(version: v)
        case .conflictThenOk(let afterVersion):
            pushBehavior = .ok(version: afterVersion)
            return .conflict
        case .alwaysConflict:
            return .conflict
        }
    }

    func getVault() async throws -> EncryptedVaultBlob? {
        getVaultCallCount += 1
        return serverVault
    }
}

final class VaultSyncTests: XCTestCase {
    private func makeVault() async throws -> (Vault, blob: String, version: Int) {
        let vault = Vault(kv: InMemoryKeyValueStore(), secureStore: InMemorySecureStore())
        _ = try await vault.addContact(displayName: "A")
        let (blob, version) = try await vault.getEncryptedVault()
        return (vault, blob, version)
    }

    func test_VLT02_pushSucceeds_updatesLocalVersionFromServer() async throws {
        let (vault, _, localVersion) = try await makeVault()
        let api = FakeVaultSyncApi(pushBehavior: .ok(version: localVersion + 5), serverVault: nil)

        try await VaultSync(vault: vault, api: api).sync()

        let (_, storedVersion) = try await vault.getEncryptedVault()
        XCTAssertEqual(storedVersion, localVersion + 5)
    }

    func test_VLT02_conflictThenSuccess_retriesOnceWithServerVersionPlusOne() async throws {
        let (vault, _, localVersion) = try await makeVault()
        let serverVersion = 42
        let api = FakeVaultSyncApi(
            pushBehavior: .conflictThenOk(afterVersion: serverVersion + 1),
            serverVault: EncryptedVaultBlob(blob: "server-blob", version: serverVersion)
        )

        try await VaultSync(vault: vault, api: api).sync()

        let calls = await api.pushCalls
        XCTAssertEqual(calls.count, 2)
        XCTAssertEqual(calls[0].version, localVersion)
        XCTAssertEqual(calls[1].version, serverVersion + 1, "retry uses (serverVersion ?? local) + 1")

        let (_, storedVersion) = try await vault.getEncryptedVault()
        XCTAssertEqual(storedVersion, serverVersion + 1)
    }

    func test_VLT02_conflictWithNoServerVault_retriesWithLocalVersionPlusOne() async throws {
        let (vault, _, localVersion) = try await makeVault()
        let api = FakeVaultSyncApi(
            pushBehavior: .conflictThenOk(afterVersion: localVersion + 1),
            serverVault: nil
        )

        try await VaultSync(vault: vault, api: api).sync()

        let calls = await api.pushCalls
        XCTAssertEqual(calls[1].version, localVersion + 1, "falls back to local version when server has none")
    }

    func test_VLT02_persistedConflictAfterRetry_failsLoudly() async throws {
        let (vault, _, _) = try await makeVault()
        let api = FakeVaultSyncApi(pushBehavior: .alwaysConflict, serverVault: nil)

        await XCTAssertThrowsErrorAsync(try await VaultSync(vault: vault, api: api).sync()) { error in
            XCTAssertEqual(error as? VaultSyncError, .conflictPersisted)
        }

        let calls = await api.pushCalls
        XCTAssertEqual(calls.count, 2, "exactly one retry — no conflict loop")
    }
}

func XCTAssertThrowsErrorAsync<T>(
    _ expression: @autoclosure () async throws -> T,
    _ errorHandler: (Error) -> Void = { _ in },
    file: StaticString = #filePath,
    line: UInt = #line
) async {
    do {
        _ = try await expression()
        XCTFail("expected an error to be thrown", file: file, line: line)
    } catch {
        errorHandler(error)
    }
}
