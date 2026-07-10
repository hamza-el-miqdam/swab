package com.swab.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.swab.android.onboarding.CalibrateViewModel
import com.swab.android.onboarding.ContactsViewModel
import com.swab.android.onboarding.OnboardingStep
import com.swab.android.onboarding.OnboardingViewModel
import com.swab.android.onboarding.SignupViewModel
import com.swab.android.ui.onboarding.CalibrateScreen
import com.swab.android.ui.onboarding.ContactsScreen
import com.swab.android.ui.onboarding.DoneScreen
import com.swab.android.ui.onboarding.OtpScreen
import com.swab.android.ui.onboarding.PhoneScreen
import com.swab.android.ui.onboarding.WelcomeScreen
import com.swab.android.ui.theme.SwabTheme
import kotlinx.coroutines.launch

private object Routes {
    const val WELCOME = "onboarding/welcome"
    const val PHONE = "onboarding/phone"
    const val OTP = "onboarding/otp"
    const val CONTACTS = "onboarding/contacts"
    const val CALIBRATE = "onboarding/calibrate"
    const val DONE = "onboarding/done"
    const val CARTE = "carte"

    fun forStep(step: OnboardingStep): String = when (step) {
        OnboardingStep.WELCOME -> WELCOME
        OnboardingStep.PHONE -> PHONE
        OnboardingStep.CONTACTS -> CONTACTS
        OnboardingStep.CALIBRATE -> CALIBRATE
        OnboardingStep.DONE -> DONE
        OnboardingStep.COMPLETE -> CARTE
    }
}

/**
 * Root activity + resume gate (ONB-08), port of apps/mobile/app/index.tsx +
 * the app/(main)/_layout.tsx shell seam (carte tab lands here as a stub
 * until FS-02/Wave 2).
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val container = AppContainer(applicationContext)

        setContent {
            SwabTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    SwabNavHost(container)
                }
            }
        }
    }
}

@Composable
private fun SwabNavHost(container: AppContainer) {
    val navController: NavHostController = rememberNavController()
    val onboardingViewModel = remember { OnboardingViewModel(container.onboardingStateStore) }
    val step by onboardingViewModel.step.collectAsState()
    val scope = rememberCoroutineScope()

    // Hoisted above NavHost (not remembered per-`composable {}`): the phone
    // and OTP screens are separate NavBackStackEntry compositions, so a
    // ViewModel `remember`ed inside either one is torn down and recreated
    // fresh on navigation, dropping the memory-only PendingSignup phone hash
    // between screens. One shared instance for the whole signup sub-flow
    // fixes it (found via manual on-device signup walkthrough).
    val signupViewModel = rememberSignupViewModel(container)

    // ONB-08 gate: wait for the persisted step to resolve, then start there.
    if (step == null) return

    NavHost(navController = navController, startDestination = Routes.forStep(step!!)) {
        composable(Routes.WELCOME) {
            WelcomeScreen(onStart = {
                onboardingViewModel.advanceTo(OnboardingStep.PHONE)
                navController.navigate(Routes.PHONE)
            })
        }
        composable(Routes.PHONE) {
            PhoneScreen(signupViewModel, onOtpRequested = { navController.navigate(Routes.OTP) })
        }
        composable(Routes.OTP) {
            OtpScreen(
                signupViewModel,
                onBackToPhone = { navController.navigate(Routes.PHONE) },
                onVerified = { navController.navigate(Routes.CONTACTS) },
            )
        }
        composable(Routes.CONTACTS) {
            val contactsViewModel = ContactsViewModel(container.vault)
            ContactsScreen(
                contactsViewModel,
                onImportContacts = { /* device contact picker: wired at Activity/permission layer */ },
                onContinue = {
                    scope.launch { container.onboardingStateStore.setStep(OnboardingStep.CALIBRATE) }
                    navController.navigate(Routes.CALIBRATE)
                },
            )
        }
        composable(Routes.CALIBRATE) {
            val calibrateViewModel = CalibrateViewModel(container.vault)
            CalibrateScreen(
                calibrateViewModel,
                onContinue = {
                    scope.launch { container.onboardingStateStore.setStep(OnboardingStep.DONE) }
                    navController.navigate(Routes.DONE)
                },
            )
        }
        composable(Routes.DONE) {
            DoneScreen(onFinish = {
                scope.launch {
                    runCatching { container.vaultSync.syncVault() } // offline is fine (VLT-04)
                    container.onboardingStateStore.setStep(OnboardingStep.COMPLETE)
                }
                navController.navigate(Routes.CARTE)
            })
        }
        composable(Routes.CARTE) {
            // FS-02 seam — Wave 2. Placeholder keeps Wave-1 navigation complete.
        }
    }
}

@Composable
private fun rememberSignupViewModel(container: AppContainer): SignupViewModel = remember {
    SignupViewModel(
        apiClient = container.apiClient,
        tokenStore = container.tokenStore,
        vaultKeyStore = container.vaultKeyStore,
        onboardingStateStore = container.onboardingStateStore,
    )
}
