/// Vault sync (FS-07 VLT-02/VLT-04): pushes the opaque encrypted blob.
/// On 409 the client re-pulls the server version and retries once —
/// single-device POC, last write wins.
import Foundation

public protocol VaultSyncApi: Sendable {
    func pushVault(blob: String, version: Int) async throws -> VaultPushResult
    func getVault() async throws -> EncryptedVaultBlob?
}

public enum VaultSyncError: Error, Equatable, Sendable {
    case conflictPersisted
}

public struct VaultSync: Sendable {
    private let vault: Vault
    private let api: VaultSyncApi

    public init(vault: Vault, api: VaultSyncApi) {
        self.vault = vault
        self.api = api
    }

    public func sync() async throws {
        let (blob, version) = try await vault.getEncryptedVault()
        let result = try await api.pushVault(blob: blob, version: version)
        switch result {
        case .ok(let newVersion):
            await vault.setVaultVersion(newVersion)
        case .conflict:
            let server = try await api.getVault()
            let retryVersion = (server?.version ?? version) + 1
            let retry = try await api.pushVault(blob: blob, version: retryVersion)
            guard case .ok(let finalVersion) = retry else {
                throw VaultSyncError.conflictPersisted
            }
            await vault.setVaultVersion(finalVersion)
        }
    }
}
