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
class OnboardingViewModel(private val store: OnboardingStateStore) : ViewModel() {

    private val _step = MutableStateFlow<OnboardingStep?>(null)
    val step: StateFlow<OnboardingStep?> = _step.asStateFlow()

    init {
        viewModelScope.launch {
            _step.value = store.getStep()
        }
    }

    fun advanceTo(step: OnboardingStep) {
        viewModelScope.launch {
            store.setStep(step)
            _step.value = step
        }
    }
}
