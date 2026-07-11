package com.swab.android.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.swab.android.identity.PhoneHash
import com.swab.android.vault.Vault
import com.swab.android.vault.VaultContact
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ONB-03: « Qui compte pour toi ? » — manual entry (device contact import is
 * a platform-permission concern wired at the Activity layer; this view model
 * owns the vault-write side only). Port of
 * apps/mobile/app/onboarding/contacts.tsx.
 */
class ContactsViewModel(private val vault: Vault) : ViewModel() {

    private val _contacts = MutableStateFlow<List<VaultContact>>(emptyList())
    val contacts: StateFlow<List<VaultContact>> = _contacts.asStateFlow()

    init {
        refresh()
    }

    private fun refresh() {
        viewModelScope.launch { _contacts.value = vault.getContacts() }
    }

    fun addManual(name: String) {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return
        viewModelScope.launch {
            vault.addContact(displayName = trimmed)
            refresh()
        }
    }

    /** [rawPhone] is hashed on-device (IDT-01) before ever touching the vault. */
    fun addFromDevice(name: String, rawPhone: String?) {
        viewModelScope.launch {
            val phoneHash = rawPhone?.let { PhoneHash.hashPhoneNumber(it) }
            vault.addContact(displayName = name, phoneHash = phoneHash)
            refresh()
        }
    }
}
