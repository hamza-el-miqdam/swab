package com.swab.android.vault

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withContext
import org.junit.Assert.assertArrayEquals
import org.junit.Test

/**
 * SUG-AND-010 — [VaultKeyStore.getOrCreateVaultKey] is check-then-act: two
 * concurrent first calls (SignupViewModel's own coroutine scope racing
 * Vault.hydrate()/persist(), which call the key store independently) must
 * never mint two different keys, or whichever one loses the persist race
 * makes its own data permanently undecryptable (SUG-AND-004's crash loop).
 * [Dispatchers.Default] gives real thread parallelism so the race is
 * genuinely exercised, unlike the single-threaded `runTest` scheduler.
 */
class VaultKeyStoreConcurrencyTest {

    @Test
    fun `VLT-01 concurrent first calls to InMemoryVaultKeyStore return the same key`() = runTest {
        val store = InMemoryVaultKeyStore()

        val keys = withContext(Dispatchers.Default) {
            (1..50).map { async { store.getOrCreateVaultKey() } }.awaitAll()
        }

        val first = keys.first()
        keys.forEach { assertArrayEquals(first, it) }
    }
}
