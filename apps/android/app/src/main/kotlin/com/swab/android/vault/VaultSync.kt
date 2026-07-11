package com.swab.android.vault

import com.swab.android.network.ApiClient
import com.swab.android.network.EncryptedVaultBlobDto
import com.swab.android.network.VaultPushResult

/**
 * Vault sync (FS-07 VLT-02/VLT-04): pushes the opaque encrypted blob. On 409
 * the client re-pulls the server version and retries once — single-device
 * POC, last write wins. Port of apps/mobile/src/vault/sync.ts.
 */
class VaultSync(
    private val vault: Vault,
    private val apiClient: ApiClient,
) {
    class ConflictPersistedException : Exception("vault sync: conflict persisted after retry")

    suspend fun syncVault() {
        val local = vault.getEncryptedVault()
        val result = apiClient.pushVault(EncryptedVaultBlobDto(local.blob, local.version))
        if (result is VaultPushResult.Ok) {
            vault.setVaultVersion(result.version)
            return
        }
        val server = apiClient.getVault()
        val retryVersion = (server?.version ?: local.version) + 1
        val retry = apiClient.pushVault(EncryptedVaultBlobDto(local.blob, retryVersion))
        if (retry !is VaultPushResult.Ok) {
            throw ConflictPersistedException()
        }
        vault.setVaultVersion(retry.version)
    }
}
