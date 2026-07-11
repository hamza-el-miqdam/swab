package com.swab.android.onboarding

/**
 * Pending signup state — memory only, on purpose. The raw phone number is
 * hashed before it ever leaves the input handler; only the hash is held here
 * between the phone and OTP screens. If the process dies in between,
 * onboarding resumes at the phone step (OnboardingStateStore). Port of
 * apps/mobile/src/onboarding/signup.ts.
 */
class PendingSignup {
    var pendingPhoneHash: String? = null
        private set

    /** POC only: OTP code echoed by the API in non-production (OQ-IDT-1). */
    var devCode: String? = null
        private set

    fun setPendingPhoneHash(hash: String) {
        pendingPhoneHash = hash
    }

    fun setDevCode(code: String?) {
        devCode = code
    }

    fun clear() {
        pendingPhoneHash = null
        devCode = null
    }
}
