package com.swab.android

import android.content.Context
import com.swab.android.BuildConfig
import com.swab.android.identity.KeystoreTokenStore
import com.swab.android.identity.SecureTokenStore
import com.swab.android.network.ApiClient
import com.swab.android.network.HttpUrlConnectionTransport
import com.swab.android.observability.LogcatLogger
import com.swab.android.observability.NoopLogger
import com.swab.android.observability.SwabLogger
import com.swab.android.onboarding.OnboardingStateStore
import com.swab.android.storage.DataStoreKeyValueStore
import com.swab.android.storage.KeyValueStore
import com.swab.android.vault.AndroidKeystoreVaultKeyStore
import com.swab.android.vault.Vault
import com.swab.android.vault.VaultKeyStore
import com.swab.android.vault.VaultSync

/**
 * Manual DI root (no Hilt/Dagger — G4: one more dependency not justified for
 * this small a graph at Wave 1). Wires the production implementations
 * (DataStore-backed KeyValueStore, Android-Keystore-backed VaultKeyStore) —
 * JVM unit tests use the InMemory* fakes directly instead of this container.
 */
class AppContainer(context: Context) {
    // SUG-AND-012 / G3: logcat only in debug builds — it's readable over adb
    // (and, pre-API 30, by any app holding READ_LOGS), so release stays silent
    // until a real reporter decision is made.
    val logger: SwabLogger = if (BuildConfig.DEBUG) LogcatLogger() else NoopLogger()
    val keyValueStore: KeyValueStore = DataStoreKeyValueStore(context)
    val vaultKeyStore: VaultKeyStore = AndroidKeystoreVaultKeyStore(keyValueStore)
    val tokenStore: SecureTokenStore = KeystoreTokenStore(keyValueStore)
    val onboardingStateStore = OnboardingStateStore(keyValueStore)
    val vault = Vault(keyValueStore, vaultKeyStore)
    val apiClient = ApiClient(
        transport = HttpUrlConnectionTransport(),
        baseUrl = BuildConfig.API_BASE_URL,
        accessTokenProvider = { tokenStore.getAccessToken() },
    )
    val vaultSync = VaultSync(vault, apiClient, logger)
}
