package com.swab.android.vault

import java.security.SecureRandom

/**
 * Vault key storage abstraction (VLT-01, ONB-02). Production is backed by
 * the Android Keystore (see AndroidKeystoreVaultKeyStore in the app's
 * platform layer — never plain SharedPreferences, per android-specialist.md
 * rule 1 and rn-native-handoff.md §2.1). [InMemoryVaultKeyStore] is the JVM
 * unit-test fake so vault/sync logic is testable without a device.
 *
 * Store id keeps the RN reference's versioned-name convention:
 * `swab.vault.key.v1`.
 */
interface VaultKeyStore {
    /**
     * Returns the existing 32-byte vault key, or generates and persists a
     * fresh one. Called right after OTP verification, before any
     * classification input is possible (ONB-02) — the key never leaves the
     * device.
     */
    suspend fun getOrCreateVaultKey(): ByteArray

    companion object {
        const val STORE_ID: String = "swab.vault.key.v1"
        const val KEY_LENGTH_BYTES: Int = 32
    }
}

/** JVM test fake — holds the key in memory only. */
class InMemoryVaultKeyStore : VaultKeyStore {
    private var key: ByteArray? = null

    override suspend fun getOrCreateVaultKey(): ByteArray {
        val existing = key
        if (existing != null) {
            return existing
        }
        val fresh = ByteArray(VaultKeyStore.KEY_LENGTH_BYTES)
        SecureRandom().nextBytes(fresh)
        key = fresh
        return fresh
    }
}
