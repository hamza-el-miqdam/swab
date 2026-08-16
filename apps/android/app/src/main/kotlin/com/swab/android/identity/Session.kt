package com.swab.android.identity

/**
 * Session tokens (IDT-02): a short-lived access JWT plus a long-lived
 * refresh token. Production storage ([KeystoreTokenStore]) envelope-encrypts
 * both with an Android Keystore key before persisting them — never plain
 * SharedPreferences, and never plaintext in DataStore (SUG-AND-006). This
 * interface is the JVM-testable seam. Port of apps/mobile/src/lib/session.ts.
 */
data class SessionTokens(val accessToken: String, val refreshToken: String)

interface SecureTokenStore {
    suspend fun saveTokens(tokens: SessionTokens)

    suspend fun getAccessToken(): String?

    /**
     * The refresh token, or `null` if absent/unreadable. Needed by the
     * refresh-and-retry path (IDT-02, SUG-AND-007) — an access token alone
     * cannot re-establish a session.
     */
    suspend fun getRefreshToken(): String?
}

/** JVM test fake — in-memory only. */
class InMemorySecureTokenStore : SecureTokenStore {
    private var tokens: SessionTokens? = null

    override suspend fun saveTokens(tokens: SessionTokens) {
        this.tokens = tokens
    }

    override suspend fun getAccessToken(): String? = tokens?.accessToken

    override suspend fun getRefreshToken(): String? = tokens?.refreshToken
}
