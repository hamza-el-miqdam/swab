package com.swab.android.onboarding

import com.swab.android.MainDispatcherRule
import com.swab.android.network.ApiClient
import com.swab.android.network.HttpResponse
import com.swab.android.network.HttpTransport
import com.swab.android.storage.InMemoryKeyValueStore
import com.swab.android.sync.SyncScheduler
import com.swab.android.vault.InMemoryVaultKeyStore
import com.swab.android.vault.Vault
import com.swab.android.vault.VaultSync
import java.io.IOException
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * ONB-08 regression guard (SUG-AND-001, defect 2).
 *
 * « Voir ma carte » used to run `syncVault()` FIRST and persist
 * `OnboardingStep.COMPLETE` only after it returned, inside the same
 * coroutine. `HttpUrlConnectionTransport` allows 10s to connect + 10s to
 * read, so for up to ~20s after the tap — exactly the window where a user on
 * a bad connection gives up and swipes the app away — the persisted step was
 * still DONE, and the next launch resumed on the completion screen instead of
 * the map. ONB-08 says the app resumes "at the same step from local state";
 * the user's last completed step was the completion of onboarding.
 *
 * The assertion is deliberately made at the wire: whatever the transport sees
 * must happen with `complete` ALREADY on disk, so a process kill at any point
 * during the sync resumes on the map. Reading the step through a FRESH
 * [OnboardingStateStore] over the same store proves the write reached
 * persistence and is not just an in-memory cache hit.
 */
class OnboardingCompletionOrderingTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    /** Reports the step as durably stored at the instant of each request. */
    private class StepWitnessTransport(
        private val kv: InMemoryKeyValueStore,
        private val fail: Boolean = false,
    ) : HttpTransport {
        val stepsAtRequestTime = mutableListOf<OnboardingStep>()

        override suspend fun request(method: String, url: String, headers: Map<String, String>, body: String?): HttpResponse {
            stepsAtRequestTime += OnboardingStateStore(kv).getStep()
            if (fail) throw IOException("network unreachable")
            return HttpResponse(200, """{"blob":"x","version":2}""")
        }
    }

    private fun wire(
        kv: InMemoryKeyValueStore,
        transport: HttpTransport,
        scopeOwner: kotlinx.coroutines.CoroutineScope,
    ): OnboardingViewModel {
        val store = OnboardingStateStore(kv)
        val vault = Vault(kv, InMemoryVaultKeyStore())
        val scheduler = SyncScheduler(
            pending = VaultSync(vault, ApiClient(transport, baseUrl = "http://test")),
            scope = scopeOwner,
            isEnabled = { store.getStep() == OnboardingStep.COMPLETE },
        )
        return OnboardingViewModel(store, onCompleted = { scheduler.syncNow() })
    }

    @Test
    fun test_ONB08_completingOnboarding_persistsCompleteBeforeAnyNetworkCall() = runTest {
        val kv = InMemoryKeyValueStore()
        val transport = StepWitnessTransport(kv)
        val vm = wire(kv, transport, backgroundScope)
        runCurrent()

        vm.complete()
        // runCurrent(), not advanceUntilIdle(): the sync runs in a background
        // scope, and advanceUntilIdle() returns without dispatching it (see
        // SyncSchedulerTest's header) — which would leave this regression test
        // with no network call to order against, i.e. vacuously green.
        runCurrent()

        assertTrue("the post-onboarding sync must still happen", transport.stepsAtRequestTime.isNotEmpty())
        assertEquals(
            "every request must be made with COMPLETE already durable — a kill mid-sync resumes on the map",
            listOf(OnboardingStep.COMPLETE),
            transport.stepsAtRequestTime.distinct(),
        )
        assertEquals(OnboardingStep.COMPLETE, OnboardingStateStore(kv).getStep())
    }

    @Test
    fun test_ONB08_completingOnboardingOffline_stillResumesOnTheMap() = runTest {
        val kv = InMemoryKeyValueStore()
        val transport = StepWitnessTransport(kv, fail = true)
        val vm = wire(kv, transport, backgroundScope)
        runCurrent()

        vm.complete()
        runCurrent()

        // Airplane mode after OTP (FS-01 acceptance): the push fails, quietly,
        // and the user is still done with onboarding.
        assertEquals(OnboardingStep.COMPLETE, OnboardingStateStore(kv).getStep())
        assertEquals(OnboardingStep.COMPLETE, vm.step.value)
    }
}
