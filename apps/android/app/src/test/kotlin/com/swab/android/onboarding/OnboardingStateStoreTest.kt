package com.swab.android.onboarding

import com.swab.android.storage.InMemoryKeyValueStore
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

/** ONB-08: resumable onboarding, persisted step. */
class OnboardingStateStoreTest {

    @Test
    fun `ONB-08 defaults to welcome when nothing is persisted`() = runTest {
        val store = OnboardingStateStore(InMemoryKeyValueStore())
        assertEquals(OnboardingStep.WELCOME, store.getStep())
    }

    @Test
    fun `ONB-08 setStep persists and a fresh store instance resumes at it`() = runTest {
        val kv = InMemoryKeyValueStore()
        val first = OnboardingStateStore(kv)
        first.setStep(OnboardingStep.CALIBRATE)

        // Simulates process death: a brand-new store reads from the same kv.
        val resumed = OnboardingStateStore(kv)
        assertEquals(OnboardingStep.CALIBRATE, resumed.getStep())
    }

    @Test
    fun `ONB-08 an unrecognized persisted value falls back to welcome`() = runTest {
        val kv = InMemoryKeyValueStore()
        kv.set("onboarding.step.v1", "not-a-real-step")
        val store = OnboardingStateStore(kv)
        assertEquals(OnboardingStep.WELCOME, store.getStep())
    }

    @Test
    fun `every step round-trips through its wire name`() = runTest {
        for (step in OnboardingStep.entries) {
            val kv = InMemoryKeyValueStore()
            val store = OnboardingStateStore(kv)
            store.setStep(step)
            assertEquals(step, OnboardingStateStore(kv).getStep())
        }
    }
}
