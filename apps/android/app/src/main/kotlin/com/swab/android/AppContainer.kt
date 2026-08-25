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
import com.swab.android.onboarding.OnboardingStep
import com.swab.android.storage.DataStoreKeyValueStore
import com.swab.android.storage.KeyValueStore
import com.swab.android.sync.SyncScheduler
import com.swab.android.vault.AndroidKeystoreVaultKeyStore
import com.swab.android.vault.Vault
import com.swab.android.vault.VaultKeyStore
import com.swab.android.vault.VaultSync
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

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
    // SUG-AND-001 / VLT-10: every persisted write notifies the scheduler.
    // Deliberate forward reference — the three collaborators form a cycle
    // (vault notifies scheduler -> scheduler flushes vaultSync -> vaultSync
    // reads vault), and the lambda only ever runs on a write, long after this
    // constructor returns. Doing it with a callback instead of an injected
    // collaborator is what keeps `Vault` itself free of any network or sync
    // import (SyncTriggerWiringStructuralTest). Its neighbour `VaultSync` is
    // in the same package and does import both — the guard is on the class
    // that holds the classification data, not on the package.
    // (Explicit types: the cycle below is unresolvable for type inference.)
    val vault: Vault = Vault(keyValueStore, vaultKeyStore, onPersist = { syncScheduler.onWrite() })
    val apiClient: ApiClient = ApiClient(
        transport = HttpUrlConnectionTransport(),
        baseUrl = BuildConfig.API_BASE_URL,
        accessTokenProvider = { tokenStore.getAccessToken() },
    )
    val vaultSync: VaultSync = VaultSync(vault, apiClient, logger)

    /**
     * Container-owned, NOT viewModelScope: a debounce started by a fiche edit
     * has to outlive leaving the fiche, and the app-background flush has to
     * outlive the Activity.
     */
    private val syncScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val syncScheduler: SyncScheduler = SyncScheduler(
        pending = vaultSync,
        scope = syncScope,
        // ONB-05: nothing leaves the device until onboarding is finished.
        // Onboarding writes queue behind this gate and go out with the
        // post-onboarding trigger (OnboardingViewModel.complete).
        isEnabled = { onboardingStateStore.getStep() == OnboardingStep.COMPLETE },
        logger = logger,
    )

    init {
        // FS-01 acceptance 1: onboarding completed in airplane mode must sync
        // when connectivity returns — possibly in a LATER process. Nothing
        // about that failed push survives a restart (the queue counters are
        // in memory), and both cross-session triggers guard on
        // `hasPendingWork`, so without arming here the placements would wait
        // for the user's next edit. One process = at most one redundant
        // push, and backoff bounds the repeats. Mirrors iOS `SwabApp`.
        syncScope.launch {
            if (onboardingStateStore.getStep() == OnboardingStep.COMPLETE) {
                syncScheduler.assumePendingFromPreviousSession()
                syncScheduler.onAppForeground()
            }
        }
    }
}
