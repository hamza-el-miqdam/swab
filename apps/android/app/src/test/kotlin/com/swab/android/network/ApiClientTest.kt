package com.swab.android.network

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * ONB-05 / G1: asserts, by construction, that the ApiClient's request bodies
 * carry ONLY `phoneHash`/`code`/`displayName`/`{blob,version}` — there is
 * deliberately no type for rings, roles, état, ressenti, scope names, or
 * filter reasons anywhere in this networking layer.
 */
class ApiClientTest {

    private class RecordingTransport(private val response: HttpResponse) : HttpTransport {
        var lastBody: String? = null
        var lastUrl: String? = null

        override suspend fun request(method: String, url: String, headers: Map<String, String>, body: String?): HttpResponse {
            lastBody = body
            lastUrl = url
            return response
        }
    }

    @Test
    fun `ONB-05 requestOtp sends only phoneHash`() = runTest {
        val transport = RecordingTransport(HttpResponse(200, """{"devCode":"123456"}"""))
        val client = ApiClient(transport, baseUrl = "http://x")
        client.requestOtp(OtpRequestBody(phoneHash = "abc"))
        assertEquals("""{"phoneHash":"abc"}""", transport.lastBody)
    }

    @Test
    fun `ONB-05 verifyOtp sends only phoneHash, code and optional displayName`() = runTest {
        val transport = RecordingTransport(HttpResponse(200, """{"accessToken":"a","refreshToken":"r"}"""))
        val client = ApiClient(transport, baseUrl = "http://x")
        client.verifyOtp(OtpVerifyBody(phoneHash = "abc", code = "111111", displayName = "Sam"))
        val body = transport.lastBody!!
        assertTrue(body.contains("phoneHash"))
        assertTrue(body.contains("code"))
        assertTrue(body.contains("displayName"))
        // No classification-axis field name can ever appear here by type construction,
        // but assert the obvious ones defensively too.
        assertTrue(!body.contains("ring") && !body.contains("etat") && !body.contains("ressenti") && !body.contains("roles"))
    }

    @Test
    fun `VLT-02 pushVault sends only the opaque blob and version`() = runTest {
        val transport = RecordingTransport(HttpResponse(200, """{"blob":"x","version":2}"""))
        val client = ApiClient(transport, baseUrl = "http://x")
        client.pushVault(EncryptedVaultBlobDto(blob = "cipher", version = 1))
        assertEquals("""{"blob":"cipher","version":1}""", transport.lastBody)
    }

    @Test
    fun `pushVault returns Conflict on 409`() = runTest {
        val transport = RecordingTransport(HttpResponse(409, ""))
        val client = ApiClient(transport, baseUrl = "http://x")
        val result = client.pushVault(EncryptedVaultBlobDto("b", 1))
        assertTrue(result is VaultPushResult.Conflict)
    }

    @Test
    fun `getVault returns null on 404`() = runTest {
        val transport = RecordingTransport(HttpResponse(404, ""))
        val client = ApiClient(transport, baseUrl = "http://x")
        assertEquals(null, client.getVault())
    }

    @Test(expected = ApiError::class)
    fun `non-2xx non-409 responses throw ApiError`() = runTest {
        val transport = RecordingTransport(HttpResponse(500, ""))
        val client = ApiClient(transport, baseUrl = "http://x")
        client.requestOtp(OtpRequestBody("abc"))
    }
}
