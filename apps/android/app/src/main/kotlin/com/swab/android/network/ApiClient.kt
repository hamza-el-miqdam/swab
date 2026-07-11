package com.swab.android.network

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Port of apps/mobile/src/api/client.ts.
 *
 * PRIVACY INVARIANT (ONB-05 / G1 / android rule 3): the ONLY user-data
 * shapes this class can send are `phoneHash`, `code`, `displayName`, and the
 * opaque encrypted vault `{ blob, version }`. There is deliberately NO type
 * here for rings, roles, état, ressenti, scope names, or filter reasons — if
 * you need to add one, stop: you are breaking the product's core promise.
 * [ApiClientRequestShapeTest] asserts this by construction (sealed request
 * bodies with exactly these fields).
 */
class ApiError(val status: Int, message: String) : Exception(message)

@Serializable
data class OtpRequestBody(val phoneHash: String)

@Serializable
data class OtpRequestResponse(val devCode: String? = null)

@Serializable
data class OtpVerifyBody(val phoneHash: String, val code: String, val displayName: String? = null)

@Serializable
data class OtpVerifyResponse(val accessToken: String, val refreshToken: String)

@Serializable
data class EncryptedVaultBlobDto(val blob: String, val version: Int)

sealed interface VaultPushResult {
    data class Ok(val version: Int) : VaultPushResult
    data object Conflict : VaultPushResult
}

class ApiClient(
    private val transport: HttpTransport,
    private val baseUrl: String = DEFAULT_BASE_URL,
    private val accessTokenProvider: suspend () -> String? = { null },
) {
    companion object {
        const val DEFAULT_BASE_URL: String = "http://localhost:3001"
    }

    private val json = Json { ignoreUnknownKeys = true }

    private suspend fun headers(): Map<String, String> {
        val token = accessTokenProvider()
        val base = mapOf("content-type" to "application/json")
        return if (token != null) base + ("authorization" to "Bearer $token") else base
    }

    suspend fun requestOtp(body: OtpRequestBody): OtpRequestResponse {
        val res = transport.request(
            "POST",
            "$baseUrl/auth/otp/request",
            headers(),
            json.encodeToString(OtpRequestBody.serializer(), body),
        )
        if (res.status !in 200..299) throw ApiError(res.status, "otp request failed")
        return json.decodeFromString(OtpRequestResponse.serializer(), res.body)
    }

    suspend fun verifyOtp(body: OtpVerifyBody): OtpVerifyResponse {
        val res = transport.request(
            "POST",
            "$baseUrl/auth/otp/verify",
            headers(),
            json.encodeToString(OtpVerifyBody.serializer(), body),
        )
        if (res.status !in 200..299) throw ApiError(res.status, "otp verify failed")
        return json.decodeFromString(OtpVerifyResponse.serializer(), res.body)
    }

    suspend fun pushVault(body: EncryptedVaultBlobDto): VaultPushResult {
        val res = transport.request(
            "POST",
            "$baseUrl/vault",
            headers(),
            json.encodeToString(EncryptedVaultBlobDto.serializer(), body),
        )
        if (res.status == 409) return VaultPushResult.Conflict
        if (res.status !in 200..299) throw ApiError(res.status, "vault push failed")
        return VaultPushResult.Ok(json.decodeFromString(EncryptedVaultBlobDto.serializer(), res.body).version)
    }

    suspend fun getVault(): EncryptedVaultBlobDto? {
        val res = transport.request("GET", "$baseUrl/vault", headers(), null)
        if (res.status == 404) return null
        if (res.status !in 200..299) throw ApiError(res.status, "vault fetch failed")
        return json.decodeFromString(EncryptedVaultBlobDto.serializer(), res.body)
    }
}
