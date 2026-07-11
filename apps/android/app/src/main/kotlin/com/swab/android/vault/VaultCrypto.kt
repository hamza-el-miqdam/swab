package com.swab.android.vault

import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Vault encryption — Android port of apps/mobile/src/vault/crypto.ts (VLT-01, ONB-02).
 *
 * Primitive: AES-256-GCM via `javax.crypto` (`Cipher.getInstance("AES/GCM/NoPadding")`).
 * No AAD, 12-byte IV, 16-byte (128-bit) auth tag.
 *
 * GOTCHA (rn-native-handoff.md §2.1): `Cipher.doFinal` on encrypt returns
 * `CIPHERTEXT ‖ TAG`, but the wire format is `IV ‖ TAG ‖ CIPHERTEXT` — the tag
 * must be sliced off the end and moved before the ciphertext on encrypt, and
 * the reverse on decrypt (tag re-appended to the end before doFinal, since
 * Cipher expects `CIPHERTEXT ‖ TAG` for GCM decryption on the JVM).
 *
 * Wire format: base64( IV(12) || AUTH_TAG(16) || CIPHERTEXT ), standard
 * alphabet with padding (java.util.Base64 default matches).
 */
object VaultCrypto {
    private const val IV_LENGTH = 12
    private const val TAG_LENGTH = 16
    private const val TAG_LENGTH_BITS = TAG_LENGTH * 8
    private const val TRANSFORMATION = "AES/GCM/NoPadding"

    /** Production entry point: always uses a fresh random IV. */
    fun encrypt(plaintext: String, key: ByteArray): String {
        val iv = ByteArray(IV_LENGTH)
        SecureRandom().nextBytes(iv)
        return encryptWithIv(plaintext, key, iv)
    }

    /**
     * Test-only IV injection (rn-native-handoff.md §7 verification gate).
     * Production code must always call [encrypt] instead.
     */
    fun encryptWithIv(plaintext: String, key: ByteArray, iv: ByteArray): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(
            Cipher.ENCRYPT_MODE,
            SecretKeySpec(key, "AES"),
            GCMParameterSpec(TAG_LENGTH_BITS, iv),
        )
        // doFinal returns CIPHERTEXT || TAG here.
        val ciphertextThenTag = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        val ciphertext = ciphertextThenTag.copyOfRange(0, ciphertextThenTag.size - TAG_LENGTH)
        val tag = ciphertextThenTag.copyOfRange(ciphertextThenTag.size - TAG_LENGTH, ciphertextThenTag.size)

        // Reorder to IV || TAG || CIPHERTEXT for the wire.
        val out = ByteArray(iv.size + tag.size + ciphertext.size)
        System.arraycopy(iv, 0, out, 0, iv.size)
        System.arraycopy(tag, 0, out, iv.size, tag.size)
        System.arraycopy(ciphertext, 0, out, iv.size + tag.size, ciphertext.size)
        return Base64.getEncoder().encodeToString(out)
    }

    fun decrypt(blobBase64: String, key: ByteArray): String {
        val payload = Base64.getDecoder().decode(blobBase64)
        val iv = payload.copyOfRange(0, IV_LENGTH)
        val tag = payload.copyOfRange(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
        val ciphertext = payload.copyOfRange(IV_LENGTH + TAG_LENGTH, payload.size)

        // Cipher expects CIPHERTEXT || TAG for GCM decryption.
        val ciphertextThenTag = ByteArray(ciphertext.size + tag.size)
        System.arraycopy(ciphertext, 0, ciphertextThenTag, 0, ciphertext.size)
        System.arraycopy(tag, 0, ciphertextThenTag, ciphertext.size, tag.size)

        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(
            Cipher.DECRYPT_MODE,
            SecretKeySpec(key, "AES"),
            GCMParameterSpec(TAG_LENGTH_BITS, iv),
        )
        val plaintext = cipher.doFinal(ciphertextThenTag)
        return String(plaintext, Charsets.UTF_8)
    }
}
