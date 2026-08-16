package com.swab.android.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Envelope encryption backed by a non-exportable AES-256-GCM key held in the
 * Android Keystore (hardware-backed where available) under [alias].
 *
 * Extracted from `AndroidKeystoreVaultKeyStore` (SUG-AND-006) so the vault
 * key and the session tokens share one proven implementation rather than
 * two copies. Each caller owns a distinct alias, so compromising or clearing
 * one does not affect the other:
 *  - `swab.vault.wrap.v1` — wraps the raw 32-byte vault key
 *  - `swab.session.wrap.v1` — wraps the access/refresh JWTs
 *
 * **On-disk format (MUST NOT change):** `base64(IV(12) ‖ CIPHERTEXT ‖ TAG(16))`,
 * which is what `Cipher.doFinal` already returns for GCM. This is the layout
 * existing installs' wrapped vault keys are stored in — altering it makes
 * every installed vault undecryptable (VLT-01). Note it deliberately differs
 * from `VaultCrypto`'s cross-platform wire format (`IV ‖ TAG ‖ CT`): this
 * blob is device-local and never leaves the handset, so it has no
 * cross-platform contract to honour.
 *
 * NOTE: requires a real Android Keystore provider, so it is not exercised by
 * JVM unit tests — see `KeystoreEnvelopeTest` (androidTest) and the
 * `domainCoverageExcludes` list in app/build.gradle.kts.
 */
class KeystoreEnvelope(private val alias: String) {
    companion object {
        private const val ANDROID_KEY_STORE = "AndroidKeyStore"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val TAG_LENGTH_BITS = 128
        const val IV_LENGTH = 12
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }
        val existing = keyStore.getKey(alias, null)
        if (existing != null) return existing as SecretKey

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    /** Encrypts [plaintext], returning `base64(IV ‖ CT ‖ TAG)`. */
    fun encrypt(plaintext: ByteArray): String {
        // Android Keystore AES/GCM keys are generated with randomized
        // encryption required (the default), so the provider refuses a
        // caller-supplied IV on ENCRYPT_MODE and throws
        // InvalidAlgorithmParameterException("Caller-provided IV not
        // permitted"). Init with no spec and read the Keystore-chosen IV
        // back afterwards. DECRYPT_MODE has no such restriction.
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val iv = cipher.iv
        val ciphertextAndTag = cipher.doFinal(plaintext)

        val out = ByteArray(iv.size + ciphertextAndTag.size)
        System.arraycopy(iv, 0, out, 0, iv.size)
        System.arraycopy(ciphertextAndTag, 0, out, iv.size, ciphertextAndTag.size)
        return Base64.getEncoder().encodeToString(out)
    }

    /**
     * Decrypts a blob produced by [encrypt]. Throws if the blob is malformed
     * or fails GCM authentication — use [decryptOrNull] wherever a failure is
     * recoverable (a cleared Keystore key, a corrupted value, or a pre-encryption
     * plaintext left by an older build).
     */
    fun decrypt(blobBase64: String): ByteArray {
        val payload = Base64.getDecoder().decode(blobBase64)
        require(payload.size > IV_LENGTH) { "envelope blob too short" }
        val iv = payload.copyOfRange(0, IV_LENGTH)
        val ciphertextAndTag = payload.copyOfRange(IV_LENGTH, payload.size)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(TAG_LENGTH_BITS, iv))
        return cipher.doFinal(ciphertextAndTag)
    }

    /** [decrypt], but `null` instead of throwing — fails closed, never crashes. */
    fun decryptOrNull(blobBase64: String): ByteArray? =
        runCatching { decrypt(blobBase64) }.getOrNull()
}
