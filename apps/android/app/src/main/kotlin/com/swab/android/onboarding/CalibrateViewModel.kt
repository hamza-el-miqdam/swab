package com.swab.android.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.swab.android.vault.Vault
import com.swab.android.vault.VaultContact
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ONB-04/05/06: radial calibration. Selecting a contact then a ring writes
 * ONLY to the vault (ONB-05) — no network call exists in this class, by
 * design. État/ressenti layer stays collapsed by default in the UI (ONB-06);
 * this view model exposes the setters but never auto-opens the layer. Port
 * of apps/mobile/app/onboarding/calibrate.tsx.
 */
class CalibrateViewModel(private val vault: Vault) : ViewModel() {

    private val _contacts = MutableStateFlow<List<VaultContact>>(emptyList())
    val contacts: StateFlow<List<VaultContact>> = _contacts.asStateFlow()

    private val _selectedId = MutableStateFlow<String?>(null)
    val selectedId: StateFlow<String?> = _selectedId.asStateFlow()

    init {
        refresh()
    }

    private fun refresh() {
        viewModelScope.launch { _contacts.value = vault.getContacts() }
    }

    fun select(id: String) {
        _selectedId.value = id
    }

    fun placeSelectedOnRing(ring: Int) {
        val id = _selectedId.value ?: return
        viewModelScope.launch {
            vault.setRing(id, ring)
            refresh()
        }
    }

    fun setEtatForSelected(etat: String?) {
        val id = _selectedId.value ?: return
        viewModelScope.launch {
            vault.setEtat(id, etat)
            refresh()
        }
    }

    fun setRessentiForSelected(ressenti: String?) {
        val id = _selectedId.value ?: return
        viewModelScope.launch {
            vault.setRessenti(id, ressenti)
            refresh()
        }
    }
}
