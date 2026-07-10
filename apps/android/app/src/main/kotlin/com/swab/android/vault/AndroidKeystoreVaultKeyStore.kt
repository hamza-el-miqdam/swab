package com.swab.android.vault

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.swab.android.storage.KeyValueStore
import java.security.KeyStore
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Production [VaultKeyStore]: envelope encryption via the Android Keystore
 * (android-specialist.md rule 1 — never plain SharedPreferences).
 *
 * The 32-byte vault key itself must stay a portable raw AES key (it is used
 * directly with [VaultCrypto], which must reproduce the cross-platform
 * vector blobs byte-for-byte — an Android Keystore key handle cannot be
 * exported as raw bytes, so it cannot BE the vault key). Instead:
 *  1. A non-exportable AES-256-GCM "wrapping key" is generated inside the
 *     Android Keystore (hardware-backed where available), alias
 *     `swab.vault.wrap.v1`.
 *  2. The actual 32-byte vault key is generated once with [SecureRandom],
 *     then encrypted ("wrapped") with the Keystore key and persisted as an
 *     opaque blob via [kv] under [VaultKeyStore.STORE_ID].
 *  3. On every app start the wrapped blob is unwrapped using the Keystore
 *     key (which never leaves secure hardware) to recover the raw vault key.
 *
 * NOTE: this class requires a real Android Keystore provider and is not
 * exercised by JVM unit tests (see InMemoryVaultKeyStore for that seam) —
 * on-device verification is deferred, see apps/android/CHANGELOG.md.
 */
class AndroidKeystoreVaultKeyStore(private val kv: KeyValueStore) : VaultKeyStore {
    companion object {
        private const val WRAP_KEY_ALIAS = "swab.vault.wrap.v1"
        private const val ANDROID_KEY_STORE = "AndroidKeyStore"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val TAG_LENGTH_BITS = 128
        private const val IV_LENGTH = 12
    }

    private fun keyStore(): KeyStore =
        KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }

    private fun getOrCreateWrapKey(): SecretKeySpecHolder {
        val ks = keyStore()
        val existing = ks.getKey(WRAP_KEY_ALIAS, null)
        if (existing != null) return SecretKeySpecHolder.fromKeystoreKey(existing as javax.crypto.SecretKey)

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
        val spec = KeyGenParameterSpec.Builder(
            WRAP_KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        generator.init(spec)
        val key = generator.generateKey()
        return SecretKeySpecHolder.fromKeystoreKey(key)
    }

    override suspend fun getOrCreateVaultKey(): ByteArray {
        val wrapped = kv.get(VaultKeyStore.STORE_ID)
        val wrapKey = getOrCreateWrapKey()

        if (wrapped != null) {
            val payload = Base64.getDecoder().decode(wrapped)
            val iv = payload.copyOfRange(0, IV_LENGTH)
            val ciphertextAndTag = payload.copyOfRange(IV_LENGTH, payload.size)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, wrapKey.key, GCMParameterSpec(TAG_LENGTH_BITS, iv))
            return cipher.doFinal(ciphertextAndTag)
        }

        val vaultKey = ByteArray(VaultKeyStore.KEY_LENGTH_BYTES)
        SecureRandom().nextBytes(vaultKey)

        val iv = ByteArray(IV_LENGTH)
        SecureRandom().nextBytes(iv)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, wrapKey.key, GCMParameterSpec(TAG_LENGTH_BITS, iv))
        val ciphertextAndTag = cipher.doFinal(vaultKey)

        val out = ByteArray(iv.size + ciphertextAndTag.size)
        System.arraycopy(iv, 0, out, 0, iv.size)
        System.arraycopy(ciphertextAndTag, 0, out, iv.size, ciphertextAndTag.size)
        kv.set(VaultKeyStore.STORE_ID, Base64.getEncoder().encodeToString(out))
        return vaultKey
    }

    /** Thin wrapper so we don't leak the concrete Keystore SecretKey type widely. */
    private class SecretKeySpecHolder private constructor(val key: javax.crypto.SecretKey) {
        companion object {
            fun fromKeystoreKey(key: javax.crypto.SecretKey) = SecretKeySpecHolder(key)
        }
    }
}
