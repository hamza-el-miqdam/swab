package com.swab.android.onboarding

import com.swab.android.storage.KeyValueStore

/**
 * ONB-08 — resumable onboarding. The current step is persisted locally
 * (plain: a step name is not classification data). Killing the app mid-flow
 * resumes at the same step. Port of apps/mobile/src/onboarding/state.ts.
 *
 * Note: the step stays [OnboardingStep.PHONE] until OTP verification
 * succeeds — the pending phone hash is memory-only (see PendingSignup), so a
 * restart during OTP re-asks the number.
 */
enum class OnboardingStep(val wireName: String) {
    WELCOME("welcome"),
    PHONE("phone"),
    CONTACTS("contacts"),
    CALIBRATE("calibrate"),
    DONE("done"),
    COMPLETE("complete"),
    ;

    companion object {
        fun fromWireName(value: String?): OnboardingStep =
            entries.firstOrNull { it.wireName == value } ?: WELCOME
    }
}

class OnboardingStateStore(private val kv: KeyValueStore) {
    companion object {
        private const val STEP_KEY = "onboarding.step.v1"
    }

    private var cached: OnboardingStep? = null

    suspend fun getStep(): OnboardingStep {
        val existing = cached
        if (existing != null) return existing
        val raw = kv.get(STEP_KEY)
        val step = OnboardingStep.fromWireName(raw)
        cached = step
        return step
    }

    suspend fun setStep(step: OnboardingStep) {
        cached = step
        kv.set(STEP_KEY, step.wireName)
    }
}
