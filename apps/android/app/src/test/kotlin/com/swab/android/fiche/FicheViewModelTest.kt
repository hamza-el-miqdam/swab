package com.swab.android.fiche

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
 * FS-03 « Fiche contact » — FCH-01/04/05/08. All state comes from the vault
 * (no network layer exists in FicheViewModel — see FicheOfflineStructuralTest
 * for the structural enforcement of that).
 */
class FicheViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val day = 24L * 60 * 60 * 1000

    private fun newVault() = Vault(InMemoryKeyValueStore(), InMemoryVaultKeyStore())

    @Test
    fun `FCH-01 loads the contact by id from the vault`() = runTest {
        val vault = newVault()
        val lea = vault.addContact("Léa")

        val vm = FicheViewModel(vault, lea.id)
        advanceUntilIdle()

        assertEquals("Léa", vm.contact.value?.displayName)
    }

    @Test
    fun `FCH-01 setIntimite writes to the vault immediately and appends a history event`() = runTest {
        val vault = newVault()
        val lea = vault.addContact("Léa")
        var now = 1_000_000L
        val vm = FicheViewModel(vault, lea.id, nowProvider = { now })
        advanceUntilIdle()

        vm.setIntimite(2)
        advanceUntilIdle()

        assertEquals(2, vm.contact.value?.ring)
        assertEquals(2, vault.getContacts().first().ring) // optimistic write landed in the vault, not just view state
        assertEquals(1, vm.history.value.size)
        assertEquals("intimite", vm.history.value.first().axis)
        assertEquals(now, vm.contact.value?.lastAxisChangeAt)
    }

    @Test
    fun `FCH-01 setRoles, setEtat, setRessenti each write and append their own history event`() = runTest {
        val vault = newVault()
        val lea = vault.addContact("Léa")
        val vm = FicheViewModel(vault, lea.id, nowProvider = { 1_000_000L })
        advanceUntilIdle()

        vm.setRoles(listOf("Famille", "Travail"))
        advanceUntilIdle()
        vm.setEtat("disponible")
        advanceUntilIdle()
        vm.setRessenti("léger")
        advanceUntilIdle()

        assertEquals(listOf("Famille", "Travail"), vm.contact.value?.roles)
        assertEquals("disponible", vm.contact.value?.etat)
        assertEquals("léger", vm.contact.value?.ressenti)
        assertEquals(3, vm.history.value.size)
        assertEquals(setOf("roles", "etat", "ressenti"), vm.history.value.map { it.axis }.toSet())
    }

    @Test
    fun `FCH-04 history is newest first`() = runTest {
        val vault = newVault()
        val lea = vault.addContact("Léa")
        var now = 1_000_000L
        val vm = FicheViewModel(vault, lea.id, nowProvider = { now })
        advanceUntilIdle()

        vm.setEtat("disponible")
        advanceUntilIdle()
        now += 1000
        vm.setRessenti("léger")
        advanceUntilIdle()

        val axes = vm.history.value.map { it.axis }
        assertEquals(listOf("ressenti", "etat"), axes)
    }

    @Test
    fun `FCH-04 history only shows events within the last 12 months`() = runTest {
        val vault = newVault()
        val lea = vault.addContact("Léa")
        val twelveMonths = 365L * day
        var now = 0L
        val vm = FicheViewModel(vault, lea.id, nowProvider = { now })
        advanceUntilIdle()

        vm.setEtat("disponible") // recorded at t=0
        advanceUntilIdle()

        now = twelveMonths + day // now well past the 12-month window for that edit
        vm.refresh()
        advanceUntilIdle()

        assertTrue("stale history entry should be filtered out", vm.history.value.isEmpty())
    }

    @Test
    fun `FCH-05 no nudge before the staleness period elapses`() = runTest {
        val vault = newVault()
        val lea = vault.addContact("Léa")
        var now = 0L
        val vm = FicheViewModel(vault, lea.id, nowProvider = { now })
        advanceUntilIdle()

        vm.setEtat("disponible")
        advanceUntilIdle()

        now = FicheStaleness.DEFAULT_STALE_PERIOD_MILLIS - day
        vm.refresh()
        advanceUntilIdle()

        assertFalse(vm.staleNudgeVisible.value)
    }

    @Test
    fun `FCH-05 nudge appears once the staleness period elapses`() = runTest {
        val vault = newVault()
        val lea = vault.addContact("Léa")
        var now = 0L
        val vm = FicheViewModel(vault, lea.id, nowProvider = { now })
        advanceUntilIdle()

        vm.setEtat("disponible")
        advanceUntilIdle()

        now = FicheStaleness.DEFAULT_STALE_PERIOD_MILLIS + day
        vm.refresh()
        advanceUntilIdle()

        assertTrue(vm.staleNudgeVisible.value)
    }

    @Test
    fun `FCH-05 - C'est toujours ça - resets the timer and hides the nudge`() = runTest {
        val vault = newVault()
        val lea = vault.addContact("Léa")
        var now = 0L
        val vm = FicheViewModel(vault, lea.id, nowProvider = { now })
        advanceUntilIdle()
        vm.setEtat("disponible")
        advanceUntilIdle()

        now = FicheStaleness.DEFAULT_STALE_PERIOD_MILLIS + day
        vm.refresh()
        advanceUntilIdle()
        assertTrue(vm.staleNudgeVisible.value)

        vm.confirmStillAccurate()
        advanceUntilIdle()

        assertFalse(vm.staleNudgeVisible.value)
        assertEquals(now, vm.contact.value?.lastAxisChangeAt)
    }

    @Test
    fun `FCH-05 - A revoir plus tard - hides the nudge and stays hidden for 30 days`() = runTest {
        val vault = newVault()
        val lea = vault.addContact("Léa")
        var now = 0L
        val vm = FicheViewModel(vault, lea.id, nowProvider = { now })
        advanceUntilIdle()
        vm.setEtat("disponible")
        advanceUntilIdle()

        now = FicheStaleness.DEFAULT_STALE_PERIOD_MILLIS + day
        vm.refresh()
        advanceUntilIdle()
        assertTrue(vm.staleNudgeVisible.value)

        vm.dismissStaleNudge()
        advanceUntilIdle()
        assertFalse("dismissed immediately, nothing reappears right away", vm.staleNudgeVisible.value)

        now += 29 * day
        vm.refresh()
        advanceUntilIdle()
        assertFalse("still within the 30-day snooze window", vm.staleNudgeVisible.value)

        now += 2 * day // past 30 days total since the dismissal
        vm.refresh()
        advanceUntilIdle()
        assertTrue("re-eligible after 30 days", vm.staleNudgeVisible.value)
    }

    @Test
    fun `FCH-08 a pending contact (no targetId) is still fully loaded and editable`() = runTest {
        val vault = newVault()
        val pending = vault.addContact("Nadia") // targetId defaults to null: hasn't joined swab
        val vm = FicheViewModel(vault, pending.id, nowProvider = { 1_000L })
        advanceUntilIdle()

        assertNull(vm.contact.value?.targetId)

        vm.setEtat("disponible")
        advanceUntilIdle()

        assertEquals("disponible", vm.contact.value?.etat)
        assertNull("editing axes never changes join status", vm.contact.value?.targetId)
    }
}
