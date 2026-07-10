package com.swab.android.identity

/**
 * Session tokens (IDT-02). Production storage is Keystore-backed (never
 * plain SharedPreferences); this interface is the JVM-testable seam. Port of
 * apps/mobile/src/lib/session.ts.
 */
data class SessionTokens(val accessToken: String, val refreshToken: String)

interface SecureTokenStore {
    suspend fun saveTokens(tokens: SessionTokens)
    suspend fun getAccessToken(): String?
}

/** JVM test fake — in-memory only. */
class InMemorySecureTokenStore : SecureTokenStore {
    private var tokens: SessionTokens? = null

    override suspend fun saveTokens(tokens: SessionTokens) {
        this.tokens = tokens
    }

    override suspend fun getAccessToken(): String? = tokens?.accessToken
}
