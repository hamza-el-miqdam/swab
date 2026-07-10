package com.swab.android.identity

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class InMemorySecureTokenStoreTest {

    @Test
    fun `IDT-02 getAccessToken is null before any tokens are saved`() = runTest {
        val store = InMemorySecureTokenStore()
        assertNull(store.getAccessToken())
    }

    @Test
    fun `IDT-02 saveTokens then getAccessToken returns the saved access token`() = runTest {
        val store = InMemorySecureTokenStore()
        store.saveTokens(SessionTokens(accessToken = "a", refreshToken = "r"))
        assertEquals("a", store.getAccessToken())
    }
}
