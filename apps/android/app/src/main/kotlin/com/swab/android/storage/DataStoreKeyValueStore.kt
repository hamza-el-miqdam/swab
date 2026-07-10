package com.swab.android.storage

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.dataStore by preferencesDataStore(name = "swab_kv")

/**
 * Production [KeyValueStore]: Jetpack DataStore (plain storage — acceptable
 * per rn-audit-map.md since the vault blob it stores is already ciphertext,
 * and the onboarding step is not classification data).
 */
class DataStoreKeyValueStore(private val context: Context) : KeyValueStore {
    override suspend fun get(key: String): String? {
        val prefs = context.dataStore.data.first()
        return prefs[stringPreferencesKey(key)]
    }

    override suspend fun set(key: String, value: String) {
        context.dataStore.edit { prefs -> prefs[stringPreferencesKey(key)] = value }
    }
}
