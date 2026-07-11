package com.swab.android.carte

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.swab.android.vault.Vault
import com.swab.android.vault.VaultContact
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * FS-02 « Ma carte » — MAP-01/05: state for the map/list screen, sourced
 * ENTIRELY from the on-device [Vault]. Port of apps/mobile/app/(main)/carte.tsx.
 *
 * MAP-05 (offline by construction): this file must never import
 * com.swab.android.network — enforced structurally by
 * CarteOfflineStructuralTest, which scans this package's source for
 * forbidden imports the same way the RN reference's carte-offline.map05
 * test scans the map and (main) source trees.
 */
class CarteViewModel(private val vault: Vault) : ViewModel() {

    private val _contacts = MutableStateFlow<List<VaultContact>>(emptyList())
    val contacts: StateFlow<List<VaultContact>> = _contacts.asStateFlow()

    private val _listMode = MutableStateFlow(false)
    val listMode: StateFlow<Boolean> = _listMode.asStateFlow()

    private val _legendOpen = MutableStateFlow(false)
    val legendOpen: StateFlow<Boolean> = _legendOpen.asStateFlow()

    private val _selected = MutableStateFlow<VaultContact?>(null)
    val selected: StateFlow<VaultContact?> = _selected.asStateFlow()

    init {
        refresh()
    }

    /**
     * Reload from the vault. Called on init, and should be called again
     * whenever the carte regains focus/resumes (RN's useFocusEffect
     * equivalent) so an FS-03 re-tag shows the contact on its new ring with
     * an animated move on return (MAP-04 acceptance criterion) — the FS-03
     * screen itself doesn't exist yet, but this refresh seam is ready.
     */
    fun refresh() {
        viewModelScope.launch { _contacts.value = vault.getContacts() }
    }

    fun setListMode(value: Boolean) {
        _listMode.value = value
    }

    fun toggleLegend() {
        _legendOpen.value = !_legendOpen.value
    }

    fun selectContact(contact: VaultContact) {
        _selected.value = contact
    }

    fun clearSelection() {
        _selected.value = null
    }
}
