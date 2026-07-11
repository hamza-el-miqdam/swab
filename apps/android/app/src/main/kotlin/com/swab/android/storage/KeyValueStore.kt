package com.swab.android.storage

/**
 * Thin key-value seam — port of apps/mobile/src/lib/db.ts. Only ever stores:
 *  - the onboarding step (plain — not classification data)
 *  - the ENCRYPTED vault blob + its version (ciphertext only; see vault/)
 * Classification data never touches this store unencrypted.
 *
 * Kept as a pure-Kotlin interface (no Android imports) so domain code using
 * it is JVM-testable; [InMemoryKeyValueStore] is the JVM test fake.
 * DataStore-backed production implementation lives in the app's Android
 * source alongside platform code that needs a Context.
 */
interface KeyValueStore {
    suspend fun get(key: String): String?
    suspend fun set(key: String, value: String)
}

/** Test/dev seam — in-memory, not persisted across process restarts. */
class InMemoryKeyValueStore : KeyValueStore {
    private val map = mutableMapOf<String, String>()

    override suspend fun get(key: String): String? = map[key]

    override suspend fun set(key: String, value: String) {
        map[key] = value
    }
}
