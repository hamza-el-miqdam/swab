package com.swab.android.e2e

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import com.swab.android.l10n.Fr

/**
 * Shared driving code for the E2E suite in this package. Every flow here
 * exercises the REAL Compose UI (taps/typing via `ComposeTestRule`, no
 * ViewModel mocking) against the REAL local API stack
 * (`docker compose up`, reachable from the emulator via
 * `BuildConfig.API_BASE_URL` = `http://10.0.2.2:3001` — see
 * app/build.gradle.kts and the Wave-1 networking bug this guards against,
 * documented in apps/android/CHANGELOG.md).
 *
 * Onboarding lookups prefer copy-based (`onNodeWithText`/
 * `onNodeWithContentDescription` using the real `Fr.*` French strings) over
 * `testTag`, per the brief: this doubles as a copy/accessibility regression
 * check. No `testTag`s were needed anywhere in this suite — every element
 * exercised already carries an unambiguous content description or visible
 * text.
 */
private const val DEFAULT_TIMEOUT_MS = 20_000L

/** A fresh, never-before-used phone number per test run — the API throttles
 * OTP requests per phoneHash (max 3 per 5-minute window, apps/api's
 * otp-store.ts), and a re-used number would also hit the "existing user, no
 * displayName needed" branch instead of the "new user, needsName" branch
 * this suite exercises. */
fun uniquePhoneNumber(): String {
    val suffix = (System.nanoTime() % 100_000_000L).toString().padStart(8, '0')
    return "+336$suffix"
}

fun ComposeTestRule.waitUntilTextExists(text: String, substring: Boolean = false, timeoutMillis: Long = DEFAULT_TIMEOUT_MS) {
    waitUntil(timeoutMillis) {
        onAllNodesWithText(text, substring = substring, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
    }
}

fun ComposeTestRule.waitUntilContentDescriptionExists(desc: String, timeoutMillis: Long = DEFAULT_TIMEOUT_MS) {
    waitUntil(timeoutMillis) {
        onAllNodesWithContentDescription(desc, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
    }
}

fun ComposeTestRule.waitUntilTextGone(text: String, substring: Boolean = false, timeoutMillis: Long = DEFAULT_TIMEOUT_MS) {
    waitUntil(timeoutMillis) {
        onAllNodesWithText(text, substring = substring, useUnmergedTree = true).fetchSemanticsNodes().isEmpty()
    }
}

/**
 * Polls a `FilterChip`'s `Selected` semantics until it flips to true. A
 * plain `waitUntilTextExists` on unrelated always-present copy (e.g. a
 * section title) does NOT wait for the vault write + recomposition a chip
 * tap triggers — it can pass before that recomposition lands, which reads
 * as flaky "assertIsSelected() sees false" failures a beat later.
 */
fun ComposeTestRule.waitUntilSelected(text: String, timeoutMillis: Long = DEFAULT_TIMEOUT_MS) {
    waitUntil(timeoutMillis) {
        // Deliberately the MERGED tree here (unlike the other wait helpers
        // above): `Selected` lives on the FilterChip's merged parent
        // semantics node, not on the raw child Text node `useUnmergedTree`
        // would return — matching a text-only child would never see it and
        // this would spin for the full timeout every time.
        onAllNodesWithText(text).fetchSemanticsNodes().any { node ->
            node.config.getOrElseNullable(SemanticsProperties.Selected) { null } == true
        }
    }
}

private fun <T> androidx.compose.ui.semantics.SemanticsConfiguration.getOrElseNullable(
    key: androidx.compose.ui.semantics.SemanticsPropertyKey<T>,
    defaultValue: () -> T?,
): T? = try {
    this[key]
} catch (e: IllegalStateException) {
    defaultValue()
}

/** Reads the rendered text of a plain `Text` node (no built-in helper for this in compose-ui-test). */
fun SemanticsNodeInteraction.readText(): String {
    val node = fetchSemanticsNode()
    return try {
        node.config[SemanticsProperties.Text].joinToString(separator = "") { it.text }
    } catch (e: IllegalStateException) {
        ""
    }
}

data class OnboardingResult(val phone: String, val displayName: String)

/**
 * ONB-09 / MAP-06 scanner: walks EVERY semantics node currently in the tree
 * (unmerged, so raw Text children are visible) and fails if any rendered or
 * editable text carries gamification framing: a percent sign ("42 %"
 * progress) or an X/Y counter ("2/5"). Positional step indication without
 * numbers is allowed by ONB-09 — and the current screens have none anyway.
 * Digits alone are NOT flagged here (the dev OTP code and typed phone number
 * are legitimate digits); the slash/percent shapes are what a progress
 * counter would need.
 */
fun ComposeTestRule.assertNoGamificationCopy(screen: String) {
    val counterPattern = Regex("""\d+\s*/\s*\d+""")
    for (text in allRenderedTexts()) {
        check(!text.contains('%')) {
            "ONB-09 violation on '$screen': found percent-sign copy: \"$text\""
        }
        check(!counterPattern.containsMatchIn(text)) {
            "ONB-09 violation on '$screen': found X/Y counter copy: \"$text\""
        }
    }
}

/**
 * MAP-02 badge scanner: a nav/unread badge renders as a standalone
 * digits-only text node — assert none exists anywhere on screen. (Product
 * law 5 / MAP-02: no numeric indicator of any kind, not just "not on the
 * nav bar".)
 */
fun ComposeTestRule.assertNoNumericBadgeText() {
    for (text in allRenderedTexts()) {
        check(!text.trim().matches(Regex("""\d+"""))) {
            "MAP-02 violation: found a standalone numeric text node (badge-shaped): \"$text\""
        }
    }
}

private fun ComposeTestRule.allRenderedTexts(): List<String> {
    val everyNode = SemanticsMatcher("every node") { true }
    return onAllNodes(everyNode, useUnmergedTree = true).fetchSemanticsNodes().flatMap { node ->
        val texts = node.config.getOrElseNullable(SemanticsProperties.Text) { null }
            ?.map { it.text }.orEmpty()
        val editable = node.config.getOrElseNullable(SemanticsProperties.EditableText) { null }
            ?.text?.let { listOf(it) }.orEmpty()
        texts + editable
    }
}

/**
 * ONB-01..08 happy path: Welcome -> phone -> OTP (dev code read straight off
 * the screen, never hardcoded/guessed) -> display name (second verify call,
 * exercising the API's 422 "displayName required" branch) -> manual contact
 * add (device contact import is a no-op in this build — MainActivity wires
 * `onImportContacts` to nothing; manual add is the only path exercisable
 * headlessly) -> calibration on rings 1 & 2 ONLY (rings 3/4 have a known,
 * separately-tracked layout bug in CalibrateScreen.kt — out of scope here,
 * same workaround the lead used during manual verification) -> Done -> Carte.
 *
 * Leaves the app on the Carte screen (Fr.CARTE_TITLE visible) when it returns.
 */
fun ComposeTestRule.completeOnboarding(
    displayName: String,
    contactRings: List<Pair<String, Int>>,
    onScreen: (String) -> Unit = {},
): OnboardingResult {
    val phone = signUpThroughOtp(displayName, onScreen)

    // --- Contacts (ONB-03) ---
    waitUntilTextExists(Fr.CONTACTS_TITLE)
    onScreen("contacts")
    for ((name, _) in contactRings) {
        onNodeWithContentDescription(Fr.CONTACTS_MANUAL_PLACEHOLDER).performTextInput(name)
        onNodeWithText(Fr.CONTACTS_ADD).performClick()
        waitUntilTextExists(name, substring = true)
    }
    onNodeWithText(Fr.CONTACTS_CONTINUE).performClick()

    // --- Calibrate (ONB-04/05/06) ---
    waitUntilTextExists(Fr.CALIBRATE_TITLE)
    onScreen("calibrate")
    val ringLabel = mapOf(1 to Fr.RING_1, 2 to Fr.RING_2)
    for ((name, ring) in contactRings) {
        require(ring == 1 || ring == 2) {
            "Rings 3/4 have a known CalibrateScreen layout bug (out of scope) — use ring 1 or 2 in tests."
        }
        onNodeWithText("$name — —").performClick()
        onNodeWithText("${Fr.CALIBRATE_RING_PREFIX} $ring — ${ringLabel.getValue(ring)}").performClick()
        waitUntilTextExists("$name — ${ringLabel.getValue(ring)}")
    }
    onNodeWithText(Fr.CALIBRATE_CONTINUE).performClick()

    // --- Done (ONB-07) ---
    waitUntilTextExists(Fr.DONE_TITLE)
    onScreen("done")
    onNodeWithText(Fr.DONE_CTA).performClick()

    // --- Carte (FS-02 landing) ---
    waitUntilTextExists(Fr.CARTE_TITLE)

    return OnboardingResult(phone, displayName)
}

/**
 * ONB-01/02 only: Welcome -> phone -> OTP -> display-name retry, stopping the
 * moment the Contacts screen (ONB-03) is reached. Extracted from
 * [completeOnboarding] (which now delegates here, byte-for-byte the same
 * driving steps) so the MAP-06 skip-contacts test can branch at « Passer »
 * instead of adding contacts. Returns the fresh phone number used.
 */
fun ComposeTestRule.signUpThroughOtp(
    displayName: String,
    onScreen: (String) -> Unit = {},
): String {
    val phone = uniquePhoneNumber()

    // --- Welcome (ONB-01) ---
    waitUntilTextExists(Fr.WELCOME_CTA)
    onScreen("welcome")
    onNodeWithText(Fr.WELCOME_CTA).performClick()

    // --- Phone (ONB-02, first half) ---
    waitUntilContentDescriptionExists(Fr.PHONE_PLACEHOLDER)
    onScreen("phone")
    onNodeWithContentDescription(Fr.PHONE_PLACEHOLDER).performTextInput(phone)
    onNodeWithText(Fr.PHONE_CTA).performClick()

    // --- OTP (ONB-02, second half) ---
    // Regression guard (Wave-1 nav state-loss bug): if SignupViewModel's
    // pendingPhoneHash got lost crossing the Phone->OTP NavBackStackEntry
    // boundary, this screen renders Fr.OTP_MISSING_PHONE instead of the dev
    // code / OTP input — waiting for the dev code line to appear fails loudly
    // in that case instead of silently mis-driving the rest of the flow.
    // (The explicit "did we land on OTP_MISSING_PHONE instead" assertion for
    // this exact regression lives in OnboardingE2ETest's dedicated test.)
    waitUntilTextExists("Code (dev)", substring = true)
    onScreen("otp")
    val devCodeNode = onNodeWithText("Code (dev)", substring = true)
    val code = Regex("\\d{6}").find(devCodeNode.readText())?.value
        ?: error("dev OTP code not found in on-screen text: ${devCodeNode.readText()}")

    onNodeWithContentDescription(Fr.OTP_PLACEHOLDER).performTextInput(code)
    onNodeWithText(Fr.OTP_CTA).performClick() // first attempt: no displayName yet -> API 422

    waitUntilContentDescriptionExists(Fr.OTP_NAME_PROMPT)
    onNodeWithContentDescription(Fr.OTP_NAME_PROMPT).performTextInput(displayName)
    onNodeWithText(Fr.OTP_CTA).performClick() // second attempt: includes displayName -> succeeds

    return phone
}

fun ComposeTestRule.assertOnCarte() {
    onNodeWithText(Fr.CARTE_TITLE).assertIsDisplayed()
}
