package com.swab.android.onboarding

import com.swab.android.MainDispatcherRule
import com.swab.android.storage.InMemoryKeyValueStore
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/** ONB-08: root resume gate over the persisted onboarding step. */
class OnboardingViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `ONB-08 loads the persisted step on init`() = runTest {
        val kv = InMemoryKeyValueStore()
        kv.set("onboarding.step.v1", "calibrate")
        val vm = OnboardingViewModel(OnboardingStateStore(kv))
        advanceUntilIdle()

        assertEquals(OnboardingStep.CALIBRATE, vm.step.value)
    }

    @Test
    fun `advanceTo persists the new step and updates the exposed state`() = runTest {
        val kv = InMemoryKeyValueStore()
        val vm = OnboardingViewModel(OnboardingStateStore(kv))
        advanceUntilIdle()

        vm.advanceTo(OnboardingStep.DONE)
        advanceUntilIdle()

        assertEquals(OnboardingStep.DONE, vm.step.value)
        assertEquals(OnboardingStep.DONE, OnboardingStateStore(kv).getStep())
    }

    /**
     * SUG-AND-003 #3 regression guard: before this fix, CONTACTS/CALIBRATE/
     * DONE step writes bypassed `advanceTo` and wrote the store directly
     * (MainActivity's `scope.launch { ... setStep(...) }`), leaving `step`
     * stuck at PHONE for the rest of the session even though the persisted
     * store kept moving. Every transition must now flow through `advanceTo`,
     * so the exposed `step` and a freshly-read store value never diverge.
     */
    @Test
    fun test_ONB08_advanceTo_keepsStepFlowInSyncWithStore() = runTest {
        val kv = InMemoryKeyValueStore()
        val vm = OnboardingViewModel(OnboardingStateStore(kv))
        advanceUntilIdle()

        val transitions = listOf(
            OnboardingStep.PHONE,
            OnboardingStep.CONTACTS,
            OnboardingStep.CALIBRATE,
            OnboardingStep.DONE,
            OnboardingStep.COMPLETE,
        )
        for (target in transitions) {
            vm.advanceTo(target)
            advanceUntilIdle()

            assertEquals(target, vm.step.value)
            // Fresh store instance over the same kv: proves the write
            // actually reached persistence, not just the StateFlow.
            assertEquals(target, OnboardingStateStore(kv).getStep())
        }
    }
}
