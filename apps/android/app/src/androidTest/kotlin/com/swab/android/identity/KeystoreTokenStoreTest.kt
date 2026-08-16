package com.swab.android.identity

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.swab.android.storage.DataStoreKeyValueStore
import com.swab.android.storage.KeyValueStore
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

/**
 * SUG-AND-006 / IDT-02: session tokens must be envelope-encrypted with an
 * Android Keystore key at rest, not written as plaintext into DataStore.
 *
 * Instrumented rather than JVM, for the same reason as
 * [com.swab.android.vault.AndroidKeystoreVaultKeyStoreTest]: a real Keystore
 * provider is required (see the domainCoverageExcludes list in
 * app/build.gradle.kts).
 */
@RunWith(AndroidJUnit4::class)
class KeystoreTokenStoreTest {

    /**
     * [KeyValueStore] has no delete, so every test namespaces its keys —
     * otherwise a previous run's stored ciphertext is read instead of
     * exercising the write path. Mirrors the vault test's NamespacedKv.
     */
    private class NamespacedKv(private val delegate: KeyValueStore, private val ns: String) : KeyValueStore {
        override suspend fun get(key: String): String? = delegate.get("$key.$ns")
        override suspend fun set(key: String, value: String) = delegate.set("$key.$ns", value)
    }

    private fun freshKv(): KeyValueStore {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        return NamespacedKv(DataStoreKeyValueStore(context), System.nanoTime().toString())
    }

    private val sample = SessionTokens(
        accessToken = "header.eyJzdWIiOiJ1c2VyLTEifQ.access-signature",
        refreshToken = "header.eyJzdWIiOiJ1c2VyLTEifQ.refresh-signature",
    )

    @Test
    fun test_IDT02_savedTokens_roundTripThroughKeystoreEnvelope() = runBlocking {
        val store = KeystoreTokenStore(freshKv())

        store.saveTokens(sample)

        assertEquals(sample.accessToken, store.getAccessToken())
        assertEquals(sample.refreshToken, store.getRefreshToken())
    }

    @Test
    fun test_IDT02_tokensAtRest_areNotPlaintext() = runBlocking {
        val kv = freshKv()
        val store = KeystoreTokenStore(kv)

        store.saveTokens(sample)

        val storedAccess = kv.get(KeystoreTokenStore.ACCESS_KEY)
        val storedRefresh = kv.get(KeystoreTokenStore.REFRESH_KEY)
        assertNotNull("access token must be persisted", storedAccess)
        assertNotNull("refresh token must be persisted", storedRefresh)

        // The whole point of SUG-AND-006: neither raw token may appear at rest.
        assertFalse(
            "access token stored in plaintext",
            storedAccess!!.contains(sample.accessToken),
        )
        assertFalse(
            "refresh token stored in plaintext",
            storedRefresh!!.contains(sample.refreshToken),
        )
        // The signature segment alone must not leak either.
        assertFalse(storedAccess.contains("access-signature"))
        assertFalse(storedRefresh.contains("refresh-signature"))
    }

    @Test
    fun test_IDT02_accessAndRefresh_useDistinctCiphertexts() = runBlocking {
        val kv = freshKv()
        val store = KeystoreTokenStore(kv)

        store.saveTokens(SessionTokens(accessToken = "same-value", refreshToken = "same-value"))

        // Identical plaintexts must not produce identical blobs — each encrypt
        // call takes a fresh Keystore-chosen IV. Equal blobs would mean a
        // reused IV, which is catastrophic for AES-GCM.
        assertFalse(kv.get(KeystoreTokenStore.ACCESS_KEY) == kv.get(KeystoreTokenStore.REFRESH_KEY))
    }

    @Test
    fun test_IDT02_undecryptableStoredToken_readsAsNull_notCrash() = runBlocking {
        val kv = freshKv()
        kv.set(KeystoreTokenStore.ACCESS_KEY, "not-a-valid-envelope-blob")
        val store = KeystoreTokenStore(kv)

        // A pre-SUG-AND-006 plaintext token, a corrupted blob, or a cleared
        // Keystore key must all read as "logged out", never crash the app.
        assertNull(store.getAccessToken())
    }

    @Test
    fun test_IDT02_absentTokens_readAsNull() = runBlocking {
        val store = KeystoreTokenStore(freshKv())

        assertNull(store.getAccessToken())
        assertNull(store.getRefreshToken())
    }

    @Test
    fun test_IDT02_saveTokens_overwritesPreviousTokens() = runBlocking {
        val store = KeystoreTokenStore(freshKv())
        store.saveTokens(sample)

        val rotated = SessionTokens(accessToken = "rotated-access", refreshToken = "rotated-refresh")
        store.saveTokens(rotated)

        assertEquals(rotated.accessToken, store.getAccessToken())
        assertEquals(rotated.refreshToken, store.getRefreshToken())
    }
}
