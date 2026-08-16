package com.swab.android.security

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.Base64

/**
 * SUG-AND-006: [KeystoreEnvelope] is the shared envelope-crypto primitive
 * extracted from AndroidKeystoreVaultKeyStore so the vault key and the
 * session tokens use one proven implementation instead of two.
 *
 * It carries the provider quirk the vault test was originally written for:
 * an Android Keystore AES/GCM key generated with randomized-encryption
 * required (the default) rejects a caller-supplied IV on ENCRYPT_MODE. Only
 * a real Keystore provider reproduces that, hence instrumented.
 */
@RunWith(AndroidJUnit4::class)
class KeystoreEnvelopeTest {

    private fun freshEnvelope() = KeystoreEnvelope("swab.test.envelope.${System.nanoTime()}")

    @Test
    fun test_VLT01_encryptThenDecrypt_roundTrips() {
        val envelope = freshEnvelope()
        val plaintext = "envelope round trip".encodeToByteArray()

        val decrypted = envelope.decrypt(envelope.encrypt(plaintext))

        assertArrayEquals(plaintext, decrypted)
    }

    @Test
    fun test_VLT01_encrypt_doesNotLeakPlaintext() {
        val envelope = freshEnvelope()

        val blob = envelope.encrypt("super-secret-value".encodeToByteArray())

        assertFalse(blob.contains("super-secret-value"))
    }

    @Test
    fun test_VLT01_encryptingSameInputTwice_producesDifferentBlobs() {
        val envelope = freshEnvelope()
        val plaintext = "same input".encodeToByteArray()

        // Fresh Keystore-chosen IV per call; equal blobs would mean IV reuse.
        assertFalse(envelope.encrypt(plaintext) == envelope.encrypt(plaintext))
    }

    @Test
    fun test_VLT01_blobLayout_isIvThenCiphertextAndTag() {
        val envelope = freshEnvelope()
        val plaintext = ByteArray(32)

        val decoded = Base64.getDecoder().decode(envelope.encrypt(plaintext))

        // 12-byte IV || ciphertext (32) || GCM tag (16). This layout is the
        // one the pre-existing wrapped vault key already uses on disk and
        // MUST NOT change — doing so bricks every installed vault.
        assertTrue(decoded.size == 12 + plaintext.size + 16)
    }

    @Test
    fun test_VLT01_decrypt_returnsNullOnGarbage_ratherThanThrowing() {
        val envelope = freshEnvelope()

        assertNull(envelope.decryptOrNull("not-base64-at-all!!"))
        assertNull(envelope.decryptOrNull(Base64.getEncoder().encodeToString(ByteArray(4))))
    }

    @Test
    fun test_VLT01_decrypt_returnsNullWhenBlobWasMadeByADifferentKey() {
        val blob = freshEnvelope().encrypt("cross-alias".encodeToByteArray())

        // A different alias means a different Keystore key: authentication
        // must fail closed, not throw.
        assertNull(freshEnvelope().decryptOrNull(blob))
    }
}
