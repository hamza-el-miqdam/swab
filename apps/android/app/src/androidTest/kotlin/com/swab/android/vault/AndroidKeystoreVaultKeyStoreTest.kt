package com.swab.android.vault

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.swab.android.storage.DataStoreKeyValueStore
import com.swab.android.storage.KeyValueStore
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented regression test for a real bug found during a manual
 * on-device Wave-1 walkthrough (2026-07-10): the Android Keystore refuses a
 * caller-supplied IV on ENCRYPT_MODE for a GCM key generated with the
 * (default) randomized-encryption-required flag —
 * `InvalidAlgorithmParameterException: Caller-provided IV not permitted`.
 * This only surfaces against the real Keystore provider, so it cannot be a
 * JVM unit test (see the exclude list in app/build.gradle.kts).
 */
@RunWith(AndroidJUnit4::class)
class AndroidKeystoreVaultKeyStoreTest {

    /** Remaps [VaultKeyStore.STORE_ID] to a unique per-test key — KeyValueStore
     * has no delete, so reusing the real store id would read a previous
     * test run's wrapped blob instead of exercising the ENCRYPT_MODE path. */
    private class NamespacedKv(private val delegate: KeyValueStore, private val ns: String) : KeyValueStore {
        private fun remap(key: String) = if (key == VaultKeyStore.STORE_ID) "$key.$ns" else key
        override suspend fun get(key: String): String? = delegate.get(remap(key))
        override suspend fun set(key: String, value: String) = delegate.set(remap(key), value)
    }

    private fun freshKv(): KeyValueStore {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        return NamespacedKv(DataStoreKeyValueStore(context), System.nanoTime().toString())
    }

    @Test
    fun test_VLT01_getOrCreateVaultKey_generatesAndPersistsWithoutThrowing() = runBlocking {
        val store = AndroidKeystoreVaultKeyStore(freshKv())

        val key = store.getOrCreateVaultKey()

        assertEquals(VaultKeyStore.KEY_LENGTH_BYTES, key.size)
    }

    @Test
    fun test_VLT01_getOrCreateVaultKey_isStableAcrossCalls() = runBlocking {
        val store = AndroidKeystoreVaultKeyStore(freshKv())

        val first = store.getOrCreateVaultKey()
        val second = store.getOrCreateVaultKey()

        assertArrayEquals(first, second)
    }
}
