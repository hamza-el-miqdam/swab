package com.swab.android.vault

import com.swab.android.network.ApiClient
import com.swab.android.network.EncryptedVaultBlobDto
import com.swab.android.network.VaultPushResult
import com.swab.android.observability.NoopLogger
import com.swab.android.observability.SwabLogger
import com.swab.android.sync.PendingSync

/**
 * Vault sync (FS-07 VLT-02, replayed per VLT-10): pushes the opaque
 * encrypted blob. On 409
 * the client re-pulls the server version and retries once — single-device
 * POC, last write wins. Port of apps/mobile/src/vault/sync.ts.
 */
class VaultSync(
    private val vault: Vault,
    private val apiClient: ApiClient,
    private val logger: SwabLogger = NoopLogger(),
) : PendingSync {
    class ConflictPersistedException : Exception("vault sync: conflict persisted after retry")

    /**
     * The scheduler's view of this class (SUG-AND-001). It schedules
     * [PendingSync], not a vault: ADR-001 stage 4 replaces the whole-blob push
     * with a durable per-record outbox (VLT-10), and when it does, the outbox
     * becomes the [PendingSync] and every trigger keeps working untouched.
     */
    override suspend fun flush() = syncVault()

    suspend fun syncVault() {
        val local = vault.getEncryptedVault()
        val result = apiClient.pushVault(EncryptedVaultBlobDto(local.blob, local.version))
        if (result is VaultPushResult.Ok) {
            vault.setVaultVersion(result.version)
            return
        }
        // SUG-AND-012 / G3: version numbers only — never the blob (comment,
        // not just convention: see SwabLogPrivacyTest).
        logger.event(SwabLogger.Level.INFO, "vault.sync.conflict.retry", mapOf("localVersion" to local.version))
        val server = apiClient.getVault()
        val retryVersion = (server?.version ?: local.version) + 1
        val retry = apiClient.pushVault(EncryptedVaultBlobDto(local.blob, retryVersion))
        if (retry !is VaultPushResult.Ok) {
            logger.event(SwabLogger.Level.ERROR, "vault.sync.conflict.persisted", mapOf("retryVersion" to retryVersion))
            throw ConflictPersistedException()
        }
        vault.setVaultVersion(retry.version)
    }
}
