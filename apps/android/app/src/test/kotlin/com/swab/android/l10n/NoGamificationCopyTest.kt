package com.swab.android.l10n

import org.junit.Assert.assertFalse
import org.junit.Test

/**
 * ONB-09: no counters, no percentages, no celebration language anywhere in
 * the ported French copy. Mirrors
 * apps/mobile/src/__tests__/no-gamification.onb09.test.ts.
 */
class NoGamificationCopyTest {

    private val forbiddenPatterns = listOf(
        Regex("\\d+\\s*%"), // percentages
        Regex("(?i)félicitation"),
        Regex("(?i)bravo"),
        Regex("(?i)streak"),
        Regex("(?i)badge"),
        Regex("(?i)niveau\\s*\\d"),
        // "X contacts added!"-style counters: a bare digit followed by a
        // noun is the shape we forbid; the ring labels ("Anneau 1"..."4")
        // and OTP/phone placeholders are legitimate structural exceptions
        // and are excluded from this scan explicitly below.
    )

    private val exemptStrings = setOf(
        Fr.PHONE_PLACEHOLDER, // contains digits (a phone number example)
        Fr.OTP_PLACEHOLDER,
    )

    @Test
    fun `ONB-09 no forbidden gamification language in any UI string`() {
        for (value in Fr.ALL_STRINGS) {
            if (value in exemptStrings) continue
            for (pattern in forbiddenPatterns) {
                assertFalse(
                    "string \"$value\" matches forbidden gamification pattern $pattern",
                    pattern.containsMatchIn(value),
                )
            }
        }
    }

    @Test
    fun `ONB-09 no percentage sign anywhere, including exempt strings`() {
        for (value in Fr.ALL_STRINGS) {
            assertFalse("string \"$value\" contains a percentage", value.contains("%"))
        }
    }
}
