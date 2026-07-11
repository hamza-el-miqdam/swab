package com.swab.android.fiche

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.swab.android.carte.Labels
import com.swab.android.l10n.Fr
import com.swab.android.vault.Vault
import com.swab.android.vault.VaultContact
import com.swab.android.vault.VaultHistoryEvent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

private const val AXIS_INTIMITE = "intimite"
private const val AXIS_ROLES = "roles"
private const val AXIS_ETAT = "etat"
private const val AXIS_RESSENTI = "ressenti"
private const val TWELVE_MONTHS_MILLIS = 365L * 24 * 60 * 60 * 1000

/**
 * FS-03 « Fiche contact » — per-relation detail/editing (FCH-01..08). Sourced
 * ENTIRELY from the on-device [Vault], same offline-first shape as
 * CarteViewModel/CalibrateViewModel: this class must never import
 * com.swab.android.network — enforced structurally by
 * FicheOfflineStructuralTest (mirrors CarteOfflineStructuralTest / MAP-05).
 *
 * FCH-03 deviation: no numeric OR qualitative "reciprocity signal" is
 * rendered by this screen at all. The spec makes one optional ("if shown"),
 * and FCH-02 requires that nothing here ever imply the other person's
 * classification is visible/symmetric — omitting it entirely is the reading
 * with zero risk of that leak, versus inventing soft copy that could be
 * misread as "they feel this way about you too."
 */
class FicheViewModel(
    private val vault: Vault,
    private val contactId: String,
    private val nowProvider: () -> Long = System::currentTimeMillis,
) : ViewModel() {

    private val _contact = MutableStateFlow<VaultContact?>(null)
    val contact: StateFlow<VaultContact?> = _contact.asStateFlow()

    private val _history = MutableStateFlow<List<VaultHistoryEvent>>(emptyList())
    val history: StateFlow<List<VaultHistoryEvent>> = _history.asStateFlow()

    private val _staleNudgeVisible = MutableStateFlow(false)
    val staleNudgeVisible: StateFlow<Boolean> = _staleNudgeVisible.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val c = vault.getContacts().firstOrNull { it.id == contactId }
            _contact.value = c
            val now = nowProvider()
            _history.value = vault.getHistory(contactId).filter { now - it.at <= TWELVE_MONTHS_MILLIS }
            _staleNudgeVisible.value = c != null &&
                FicheStaleness.isStale(c.lastAxisChangeAt, c.staleSnoozedUntil, now)
        }
    }

    fun setIntimite(ring: Int) {
        viewModelScope.launch {
            vault.setRing(contactId, ring)
            val label = Labels.RING_LABEL[ring] ?: ring.toString()
            recordEdit(AXIS_INTIMITE, "${Fr.FICHE_AXIS_INTIMITE} → $label")
        }
    }

    fun setRoles(roles: List<String>) {
        viewModelScope.launch {
            vault.setRoles(contactId, roles)
            val label = roles.takeIf { it.isNotEmpty() }?.joinToString(" · ") ?: "—"
            recordEdit(AXIS_ROLES, "${Fr.FICHE_AXIS_ROLES} → $label")
        }
    }

    fun setEtat(etat: String?) {
        viewModelScope.launch {
            vault.setEtat(contactId, etat)
            recordEdit(AXIS_ETAT, "${Fr.FICHE_AXIS_ETAT} → ${etat ?: "—"}")
        }
    }

    fun setRessenti(ressenti: String?) {
        viewModelScope.launch {
            vault.setRessenti(contactId, ressenti)
            recordEdit(AXIS_RESSENTI, "${Fr.FICHE_AXIS_RESSENTI} → ${ressenti ?: "—"}")
        }
    }

    /** FCH-05 « C'est toujours ça » — re-confirms, resets the staleness timer. */
    fun confirmStillAccurate() {
        viewModelScope.launch {
            vault.confirmStillAccurate(contactId, nowProvider())
            refresh()
        }
    }

    /** FCH-05 « À revoir plus tard » — dismisses quietly, re-eligible after 30 days, nothing logged server-side. */
    fun dismissStaleNudge() {
        viewModelScope.launch {
            vault.snoozeStaleness(contactId, nowProvider())
            refresh()
        }
    }

    private suspend fun recordEdit(axis: String, summary: String) {
        vault.recordAxisEdit(contactId, axis, summary, nowProvider())
        refresh()
    }
}
