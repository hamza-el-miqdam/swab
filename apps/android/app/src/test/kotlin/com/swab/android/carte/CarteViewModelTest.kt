package com.swab.android.carte

import com.swab.android.MainDispatcherRule
import com.swab.android.storage.InMemoryKeyValueStore
import com.swab.android.vault.InMemoryVaultKeyStore
import com.swab.android.vault.Vault
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * FS-02 « Ma carte » — MAP-01/05: state loads entirely from the vault, no
 * network. MAP-04: selecting a contact opens the peek sheet, clearing it
 * closes it.
 */
class CarteViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    @Test
    fun `MAP-01 loads placed and unplaced contacts from the vault on init`() = runTest {
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())
        val lea = vault.addContact("Léa")
        vault.setRing(lea.id, 1)
        vault.addContact("Nadia") // unplaced

        val vm = CarteViewModel(vault)
        advanceUntilIdle()

        assertEquals(2, vm.contacts.value.size)
        assertEquals(1, vm.contacts.value.first { it.id == lea.id }.ring)
        assertNull(vm.contacts.value.first { it.displayName == "Nadia" }.ring)
    }

    @Test
    fun `MAP-04 refresh reloads after an external mutation - re-tag reflects on return`() = runTest {
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())
        val lea = vault.addContact("Léa")
        vault.setRing(lea.id, 1)

        val vm = CarteViewModel(vault)
        advanceUntilIdle()
        assertEquals(1, vm.contacts.value.first().ring)

        vault.setRing(lea.id, 3) // simulate an FS-03 re-tag
        vm.refresh()
        advanceUntilIdle()

        assertEquals(3, vm.contacts.value.first().ring)
    }

    @Test
    fun `MAP-08 listMode toggles independently of contact state`() = runTest {
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())
        val vm = CarteViewModel(vault)
        advanceUntilIdle()

        assertFalse(vm.listMode.value)
        vm.setListMode(true)
        assertTrue(vm.listMode.value)
    }

    @Test
    fun `legend starts closed and toggles`() = runTest {
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())
        val vm = CarteViewModel(vault)
        advanceUntilIdle()

        assertFalse(vm.legendOpen.value)
        vm.toggleLegend()
        assertTrue(vm.legendOpen.value)
        vm.toggleLegend()
        assertFalse(vm.legendOpen.value)
    }

    @Test
    fun `MAP-04 selecting then clearing a contact opens then closes the peek sheet`() = runTest {
        val vault = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())
        val lea = vault.addContact("Léa")
        val vm = CarteViewModel(vault)
        advanceUntilIdle()

        assertNull(vm.selected.value)
        vm.selectContact(vm.contacts.value.first { it.id == lea.id })
        assertEquals(lea.id, vm.selected.value?.id)
        vm.clearSelection()
        assertNull(vm.selected.value)
    }
}
