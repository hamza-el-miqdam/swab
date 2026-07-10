package com.swab.android.vault

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Base64

/**
 * Contract tests against docs/migration/vault-test-vectors.json (copied into
 * src/test/resources for this module — see apps/android/CHANGELOG.md).
 *
 * Verification gate (rn-native-handoff.md §7):
 *  1. Decrypting each vector's blob with the vector's key yields the vector's plaintext.
 *  2. Encrypting the plaintext with the vector's key AND IV reproduces the blob exactly
 *     (test-only IV injection — production always uses fresh random IVs).
 */
class VaultCryptoVectorTest {

    private data class Vector(
        val name: String,
        val keyBase64: String,
        val ivBase64: String,
        val plaintextUtf8: String,
        val blobBase64: String,
    )

    private fun loadVectors(): List<Vector> {
        val text = javaClass.classLoader!!.getResourceAsStream("vault-test-vectors.json")!!
            .bufferedReader(Charsets.UTF_8).readText()
        val root = Json.parseToJsonElement(text).jsonObject
        return root["aes256gcm"]!!.jsonArray.map { el ->
            val o = el.jsonObject
            Vector(
                name = o["name"]!!.jsonPrimitive.content,
                keyBase64 = o["keyBase64"]!!.jsonPrimitive.content,
                ivBase64 = o["ivBase64"]!!.jsonPrimitive.content,
                plaintextUtf8 = o["plaintextUtf8"]!!.jsonPrimitive.content,
                blobBase64 = o["blobBase64"]!!.jsonPrimitive.content,
            )
        }
    }

    // VLT-01: decrypting every vector's blob with the vector's key must yield the
    // vector's plaintext exactly.
    @Test
    fun `VLT-01 decrypts every vector to its exact plaintext`() {
        for (v in loadVectors()) {
            val key = Base64.getDecoder().decode(v.keyBase64)
            val decrypted = VaultCrypto.decrypt(v.blobBase64, key)
            assertEquals("vector ${v.name} plaintext mismatch", v.plaintextUtf8, decrypted)
        }
    }

    // VLT-01: encrypting the plaintext with the vector's fixed key+IV (test-only
    // IV injection) must reproduce the blob byte-for-byte.
    @Test
    fun `VLT-01 encrypting with fixed key and IV reproduces the exact blob`() {
        for (v in loadVectors()) {
            val key = Base64.getDecoder().decode(v.keyBase64)
            val iv = Base64.getDecoder().decode(v.ivBase64)
            val blob = VaultCrypto.encryptWithIv(v.plaintextUtf8, key, iv)
            assertEquals("vector ${v.name} blob mismatch", v.blobBase64, blob)
        }
    }

    // Round-trip: production encrypt() (random IV) must always decrypt back.
    @Test
    fun `VLT-01 random-IV encrypt then decrypt round-trips for every vector plaintext`() {
        for (v in loadVectors()) {
            val key = Base64.getDecoder().decode(v.keyBase64)
            val blob = VaultCrypto.encrypt(v.plaintextUtf8, key)
            val decrypted = VaultCrypto.decrypt(blob, key)
            assertEquals(v.plaintextUtf8, decrypted)
        }
    }

    // Two calls to encrypt() with the same key must not produce the same blob
    // (fresh random IV each time) — guards against an accidentally fixed IV.
    @Test
    fun `VLT-01 production encrypt uses a fresh random IV each call`() {
        val v = loadVectors().first()
        val key = Base64.getDecoder().decode(v.keyBase64)
        val blobA = VaultCrypto.encrypt(v.plaintextUtf8, key)
        val blobB = VaultCrypto.encrypt(v.plaintextUtf8, key)
        assert(blobA != blobB) { "two encryptions with the same key produced the same blob" }
    }
}
