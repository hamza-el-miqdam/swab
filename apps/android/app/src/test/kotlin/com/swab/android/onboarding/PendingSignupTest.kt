package com.swab.android.onboarding

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * ONB-02: pending phone hash / dev code are memory-only. A restart between
 * phone and OTP loses this state on purpose (see OnboardingStateStoreTest —
 * step stays PHONE, not further).
 */
class PendingSignupTest {

    @Test
    fun `setPendingPhoneHash then getPendingPhoneHash round-trips`() {
        val signup = PendingSignup()
        signup.setPendingPhoneHash("abc123")
        assertEquals("abc123", signup.pendingPhoneHash)
    }

    @Test
    fun `clear wipes both pending phone hash and dev code`() {
        val signup = PendingSignup()
        signup.setPendingPhoneHash("abc123")
        signup.setDevCode("000000")
        signup.clear()
        assertNull(signup.pendingPhoneHash)
        assertNull(signup.devCode)
    }
}
