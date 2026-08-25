package com.swab.android.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ONB-08: root resume gate + step navigation, backed by [OnboardingStateStore].
 * Port of apps/mobile/app/index.tsx (gate) + onboarding step transitions
 * scattered across the RN screens.
 */
class OnboardingViewModel(
    private val store: OnboardingStateStore,
    /**
     * VLT-10 post-onboarding replay trigger, invoked by [complete] only AFTER
     * the step is persisted (SUG-AND-001 / ONB-08 — see [complete]).
     */
    private val onCompleted: suspend () -> Unit = {},
) : ViewModel() {

    private val _step = MutableStateFlow<OnboardingStep?>(null)
    val step: StateFlow<OnboardingStep?> = _step.asStateFlow()

    init {
        viewModelScope.launch {
            _step.value = store.getStep()
        }
    }

    fun advanceTo(step: OnboardingStep) {
        viewModelScope.launch { persist(step) }
    }

    /**
     * ONB-07 « Voir ma carte ». The ORDER here is the requirement, not a
     * detail: the step is persisted first, and only then does the
     * post-onboarding sync fire (SUG-AND-001 defect 2). It used to be the
     * other way round, inside one coroutine, so for as long as the push took
     * — up to ~20s, `HttpUrlConnectionTransport`'s connect + read timeouts —
     * the stored step was still DONE and killing the app resumed on the
     * completion screen instead of the map, breaking ONB-08.
     */
    fun complete() {
        viewModelScope.launch {
            persist(OnboardingStep.COMPLETE)
            onCompleted()
        }
    }

    private suspend fun persist(step: OnboardingStep) {
        store.setStep(step)
        _step.value = step
    }
}
