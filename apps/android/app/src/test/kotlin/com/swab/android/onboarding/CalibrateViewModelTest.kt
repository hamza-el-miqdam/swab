package com.swab.android.onboarding

import com.swab.android.MainDispatcherRule
import com.swab.android.storage.InMemoryKeyValueStore
import com.swab.android.vault.InMemoryVaultKeyStore
import com.swab.android.vault.Vault
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test

/** ONB-04/05/06: radial calibration writes ring/état/ressenti to the vault only. */
class CalibrateViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `ONB-04 selecting a contact then placing a ring persists it`() = runTest {
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())
        val contact = vault.addContact("Nadia")
        val vm = CalibrateViewModel(vault)
        advanceUntilIdle()

        vm.select(contact.id)
        vm.placeSelectedOnRing(3)
        advanceUntilIdle()

        assertEquals(3, vm.contacts.value.first().ring)
    }

    @Test
    fun `placeSelectedOnRing without a selection is a no-op`() = runTest {
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())
        vault.addContact("Nadia")
        val vm = CalibrateViewModel(vault)
        advanceUntilIdle()

        vm.placeSelectedOnRing(2)
        advanceUntilIdle()

        assertNull(vm.contacts.value.first().ring)
    }

    @Test
    fun `ONB-06 etat and ressenti setters only affect the selected contact`() = runTest {
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())
        val contact = vault.addContact("Nadia")
        val vm = CalibrateViewModel(vault)
        advanceUntilIdle()

        vm.select(contact.id)
        vm.setEtatForSelected("disponible")
        vm.setRessentiForSelected("douceur")
        advanceUntilIdle()

        val updated = vm.contacts.value.first()
        assertEquals("disponible", updated.etat)
        assertEquals("douceur", updated.ressenti)
    }
}
