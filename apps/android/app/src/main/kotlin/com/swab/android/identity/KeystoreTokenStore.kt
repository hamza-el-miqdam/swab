package com.swab.android.identity

import com.swab.android.security.KeystoreEnvelope
import com.swab.android.storage.KeyValueStore

/**
 * Production [SecureTokenStore]. Both session tokens (IDT-02) are
 * envelope-encrypted with a non-exportable Android Keystore key under alias
 * `swab.session.wrap.v1` before being persisted via [kv], so the DataStore
 * file on disk holds ciphertext only.
 *
 * Why this matters (SUG-AND-006): the refresh token is a long-lived
 * credential. Until 2026-08-16 this class wrote both tokens as plaintext
 * despite its name, so a rooted device or a bad extraction path yielded
 * account takeover. `android:allowBackup="false"` helps but is not
 * encryption. Since ADR-001 moved classification data server-side, the
 * session token is the only thing standing between an attacker and a user's
 * entire relationship map — which is why this is no longer a "nice to have".
 *
 * A separate alias from the vault's `swab.vault.wrap.v1` is deliberate:
 * clearing or invalidating one must not affect the other.
 *
 * **Reads fail closed.** Any value that does not decrypt — a corrupted blob,
 * a Keystore key lost to an OS upgrade, or a plaintext token left by a build
 * older than 2026-08-16 — reads as `null`, i.e. "logged out". The user
 * re-authenticates via OTP. We deliberately do not sniff for JWT shape to
 * detect legacy plaintext: silently re-encrypting an attacker-planted value
 * would be worse than a re-login.
 *
 * NOTE: requires a real Android Keystore provider, so it is not exercised by
 * JVM unit tests (see [InMemorySecureTokenStore] for that seam) —
 * `KeystoreTokenStoreTest` in androidTest covers it.
 */
class KeystoreTokenStore(private val kv: KeyValueStore) : SecureTokenStore {
    companion object {
        internal const val ACCESS_KEY = "swab.session.access.v1"
        internal const val REFRESH_KEY = "swab.session.refresh.v1"
        private const val SESSION_KEY_ALIAS = "swab.session.wrap.v1"
    }

    private val envelope = KeystoreEnvelope(SESSION_KEY_ALIAS)

    override suspend fun saveTokens(tokens: SessionTokens) {
        kv.set(ACCESS_KEY, envelope.encrypt(tokens.accessToken.encodeToByteArray()))
        kv.set(REFRESH_KEY, envelope.encrypt(tokens.refreshToken.encodeToByteArray()))
    }

    override suspend fun getAccessToken(): String? = read(ACCESS_KEY)

    override suspend fun getRefreshToken(): String? = read(REFRESH_KEY)

    private suspend fun read(key: String): String? =
        kv.get(key)?.let { envelope.decryptOrNull(it)?.decodeToString() }
}
