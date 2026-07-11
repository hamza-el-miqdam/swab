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
}
