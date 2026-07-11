package com.swab.android.onboarding

import com.swab.android.MainDispatcherRule
import com.swab.android.storage.InMemoryKeyValueStore
import com.swab.android.vault.InMemoryVaultKeyStore
import com.swab.android.vault.Vault
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/** ONB-03: manual contact entry writes to the vault only. */
class ContactsViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private fun newVault() = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())

    @Test
    fun `ONB-03 addManual adds a trimmed name and refreshes the exposed contacts`() = runTest {
        val vault = newVault()
        val vm = ContactsViewModel(vault)
        advanceUntilIdle()

        vm.addManual("  Sami  ")
        advanceUntilIdle()

        assertEquals(1, vm.contacts.value.size)
        assertEquals("Sami", vm.contacts.value.first().displayName)
    }

    @Test
    fun `addManual ignores blank input`() = runTest {
        val vault = newVault()
        val vm = ContactsViewModel(vault)
        advanceUntilIdle()

        vm.addManual("   ")
        advanceUntilIdle()

        assertEquals(0, vm.contacts.value.size)
    }

    @Test
    fun `IDT-01 addFromDevice hashes the raw phone before it reaches the vault`() = runTest {
        val vault = newVault()
        val vm = ContactsViewModel(vault)
        advanceUntilIdle()

        vm.addFromDevice("Leïla", "+33 6 12 34 56 78")
        advanceUntilIdle()

        val stored = vm.contacts.value.first()
        assertEquals("Leïla", stored.displayName)
        assertEquals("07aff4a580d883b2c3fa060b36605b01b8a4ef47dd9c472aa7053a3a90a47712", stored.phoneHash)
    }
}
