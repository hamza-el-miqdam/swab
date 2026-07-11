package com.swab.android.identity

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Contract tests against docs/migration/vault-test-vectors.json#phoneHash
 * (FS-07 IDT-01/IDT-06). Every vector must reproduce the expected lowercase
 * hex sha256("<salt>:<normalized>").
 */
class PhoneHashVectorTest {

    private data class Vector(
        val input: String,
        val normalized: String,
        val salt: String,
        val sha256Hex: String,
    )

    private fun loadVectors(): List<Vector> {
        val text = javaClass.classLoader!!.getResourceAsStream("vault-test-vectors.json")!!
            .bufferedReader(Charsets.UTF_8).readText()
        val root = Json.parseToJsonElement(text).jsonObject
        return root["phoneHash"]!!.jsonArray.map { el ->
            val o = el.jsonObject
            Vector(
                input = o["input"]!!.jsonPrimitive.content,
                normalized = o["normalized"]!!.jsonPrimitive.content,
                salt = o["salt"]!!.jsonPrimitive.content,
                sha256Hex = o["sha256Hex"]!!.jsonPrimitive.content,
            )
        }
    }

    @Test
    fun `IDT-01 normalizePhone matches every vector's normalized form`() {
        for (v in loadVectors()) {
            assertEquals(v.input, v.normalized, PhoneHash.normalizePhone(v.input))
        }
    }

    @Test
    fun `IDT-06 hashPhoneNumber reproduces every vector's lowercase hex digest`() {
        for (v in loadVectors()) {
            val hash = PhoneHash.hashPhoneNumber(v.input, salt = v.salt)
            assertEquals(v.input, v.sha256Hex, hash)
        }
    }

    @Test
    fun `IDT-01 default salt is swab-poc-phone-salt-v1`() {
        assertEquals("swab-poc-phone-salt-v1", PhoneHash.DEFAULT_SALT)
    }
}
