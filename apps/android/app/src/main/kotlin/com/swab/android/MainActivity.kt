package com.swab.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
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
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.swab.android.carte.CarteViewModel
import com.swab.android.fiche.FicheViewModel
import com.swab.android.onboarding.CalibrateViewModel
import com.swab.android.onboarding.ContactsViewModel
import com.swab.android.onboarding.OnboardingStep
import com.swab.android.onboarding.OnboardingViewModel
import com.swab.android.onboarding.SignupViewModel
import com.swab.android.ui.carte.CarteScreen
import com.swab.android.ui.envie.EnvieScreen
import com.swab.android.ui.fiche.FicheScreen
import com.swab.android.ui.nav.MainDestination
import com.swab.android.ui.nav.SwabBottomNav
import com.swab.android.ui.onboarding.CalibrateScreen
import com.swab.android.ui.onboarding.ContactsScreen
import com.swab.android.ui.onboarding.DoneScreen
import com.swab.android.ui.onboarding.OtpScreen
import com.swab.android.ui.onboarding.PhoneScreen
import com.swab.android.ui.onboarding.WelcomeScreen
import com.swab.android.ui.sousgroupes.SousGroupesScreen
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
    const val ENVIE = "envie"
    const val SOUS_GROUPES = "sous-groupes"
    const val FICHE_ARG = "contactId"
    const val FICHE_PATTERN = "fiche/{$FICHE_ARG}"

    /** FS-03 — FCH-07: navigating here pushes onto the backstack, it never replaces Carte, so popping back restores its map position untouched. */
    fun fiche(contactId: String): String = "fiche/$contactId"

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
 * Root activity + resume gate (ONB-08), port of apps/mobile/app/index.tsx.
 * Carte/Envie/Sous-groupes (MAP-02, FS-02 Wave 2) are wired below the
 * onboarding flow, sharing one bottom nav bar via [MainScaffold].
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

    // Same hoisting rule (MAP-02): Carte/Envie/Sous-groupes are sibling
    // NavHost destinations behind one bottom nav bar, so CarteViewModel must
    // live above the individual `composable {}` blocks too, or switching
    // Carte -> Envie -> Carte would tear it down and re-fetch from a blank
    // state instead of just refreshing (CarteScreen still calls refresh()
    // on every composition, matching the RN reference's useFocusEffect).
    val carteViewModel = remember { CarteViewModel(container.vault) }

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
            MainScaffold(navController) {
                CarteScreen(carteViewModel, onOpenFiche = { id -> navController.navigate(Routes.fiche(id)) })
            }
        }
        composable(Routes.ENVIE) {
            MainScaffold(navController) { EnvieScreen() }
        }
        composable(Routes.SOUS_GROUPES) {
            MainScaffold(navController) { SousGroupesScreen() }
        }
        composable(
            route = Routes.FICHE_PATTERN,
            arguments = listOf(navArgument(Routes.FICHE_ARG) { type = NavType.StringType }),
        ) { backStackEntry ->
            val contactId = backStackEntry.arguments?.getString(Routes.FICHE_ARG)
            if (contactId != null) {
                // Leaf destination, not shared with siblings, so a plain
                // per-entry `remember` is correct here (unlike carteViewModel
                // above) — Compose Navigation keeps Carte's own composition
                // (and its remembered map pan/zoom) alive underneath while
                // Fiche is pushed on top, satisfying FCH-07 for free.
                val ficheViewModel = remember(contactId) { FicheViewModel(container.vault, contactId) }
                FicheScreen(ficheViewModel, onBack = { navController.popBackStack() })
            }
        }
    }
}

/**
 * MAP-02 — the shared shell behind Carte/Envie/Sous-groupes: a bottom nav
 * bar with exactly 3 label-only items (no badges possible by construction,
 * see ui/nav/BottomNav.kt) plus the destination's own content.
 */
@Composable
private fun MainScaffold(navController: NavHostController, content: @Composable () -> Unit) {
    val backStackEntry by navController.currentBackStackEntryAsState()
    val current = when (backStackEntry?.destination?.route) {
        Routes.ENVIE -> MainDestination.ENVIE
        Routes.SOUS_GROUPES -> MainDestination.SOUS_GROUPES
        else -> MainDestination.CARTE
    }

    Scaffold(
        bottomBar = {
            SwabBottomNav(current = current) { destination ->
                val route = when (destination) {
                    MainDestination.CARTE -> Routes.CARTE
                    MainDestination.ENVIE -> Routes.ENVIE
                    MainDestination.SOUS_GROUPES -> Routes.SOUS_GROUPES
                }
                navController.navigate(route) {
                    launchSingleTop = true
                    restoreState = true
                    popUpTo(Routes.CARTE) { saveState = true }
                }
            }
        },
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            content()
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
