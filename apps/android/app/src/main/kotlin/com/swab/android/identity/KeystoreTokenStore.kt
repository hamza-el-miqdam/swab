package com.swab.android.identity

import com.swab.android.storage.KeyValueStore

/**
 * Production [SecureTokenStore]. Session tokens are short-lived JWTs (IDT-02)
 * kept behind the same envelope-encrypted [KeyValueStore] wiring as the
 * vault blob is out of scope here (tokens are not classification data), but
 * we still avoid plain SharedPreferences per project convention — backed by
 * DataStoreKeyValueStore, which is app-private storage.
 */
class KeystoreTokenStore(private val kv: KeyValueStore) : SecureTokenStore {
    companion object {
        private const val ACCESS_KEY = "swab.session.access.v1"
        private const val REFRESH_KEY = "swab.session.refresh.v1"
    }

    override suspend fun saveTokens(tokens: SessionTokens) {
        kv.set(ACCESS_KEY, tokens.accessToken)
        kv.set(REFRESH_KEY, tokens.refreshToken)
    }

    override suspend fun getAccessToken(): String? = kv.get(ACCESS_KEY)
}
