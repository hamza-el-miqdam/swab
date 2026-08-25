package com.swab.android.e2e

import android.util.Base64
import androidx.test.platform.app.InstrumentationRegistry

/**
 * Issue #128 root cause: `apps/api`'s `/auth/otp/request` and
 * `/auth/otp/verify` share IDT-03's per-IP rate limit (10 requests / 60 s,
 * `otpRateLimit` in `apps/api/src/routes/auth.ts`). Every [signUpThroughOtp]
 * call makes 3 requests against that SAME bucket (1 request + 2 verifies —
 * the deliberate no-displayName-then-displayName retry is the real ONB-02
 * flow, not test overhead). `RelationshipMapE2ETest` and
 * `FicheTouchTargetsTest` drive it once per test method; ~4 back-to-back
 * onboardings is enough to exceed 10 requests inside the rolling window.
 *
 * When the server returns 429, `SignupViewModel.verifyOtp` sets
 * `otpError = true` and `needsName` never becomes true — so
 * `waitUntilContentDescriptionExists(Fr.OTP_NAME_PROMPT)` (E2EFlows.kt) polls
 * for the full 20 s before throwing `ComposeTimeoutException`. That is the
 * exact, verified failure — confirmed independently of the emulator/Compose
 * harness via direct `curl` reproduction against the local dev API (11th
 * request in under a minute returns 429 with `retry-after`), and confirmed
 * live via `Swab: otp.verify.failed status=429` in logcat lining up exactly
 * with a `ComposeTimeoutException` at E2EFlows.kt's OTP_NAME_PROMPT wait.
 *
 * This is NOT a Compose/animation timing bug, so padding
 * `waitUntilContentDescriptionExists`'s timeout would hide it, not fix it —
 * a longer timeout still only ever fails once the shared bucket is
 * exhausted, just later. The actual fix is pacing: keep this test suite's
 * own OTP-route call rate under the server's real, fixed limit so the
 * 429 is never triggered in the first place. `apps/api`'s rate-limit
 * threshold itself is out of apps/android's file scope (G4) — widening it
 * for local/E2E environments is a separate, apps/api-owned follow-up.
 *
 * IMPORTANT — three dead ends ruled out empirically before this version,
 * all worth recording so nobody re-tries them:
 *
 * 1. Plain in-memory `ArrayDeque` on this `object`: `testOptions.execution =
 *    ANDROIDX_TEST_ORCHESTRATOR` (build.gradle.kts) runs every `@Test` method
 *    in its OWN fresh process, so any in-memory state resets to empty at the
 *    start of every test method. It only ever paced calls WITHIN one
 *    [signUpThroughOtp] (3 calls, already under the cap on its own) and gave
 *    zero protection across test-method boundaries — confirmed by
 *    `test_MAP06_skipContactsOnboarding_emptyMapIsCalm` hitting a real 429
 *    mid-suite (verified via logcat, not assumed).
 *
 * 2. A raw `java.io.File` under either package's own storage
 *    (`InstrumentationRegistry...context.filesDir`, the TEST package's dir,
 *    or a bare `Environment.getExternalStorageDirectory()` path): both threw
 *    `FileNotFoundException: ... open failed: ENOENT` on every single call.
 *    Root cause, confirmed via `adb logcat` process-start lines: instrumented
 *    tests run INSIDE THE TARGET APP'S PROCESS
 *    (`Start proc N:com.swab.android/u0a230`), so
 *    `InstrumentationRegistry.getInstrumentation().context.filesDir` computes
 *    a path for `com.swab.android.test` (a DIFFERENT package/UID, `u0_a231`,
 *    confirmed via `run-as com.swab.android.test id`) that the
 *    actually-running process cannot create directories under — a genuine
 *    cross-package permission mismatch, not a missing-`mkdirs()` bug. A bare
 *    external-storage path failed the same way under scoped storage
 *    (target SDK 35).
 *
 * 3. `androidx.test.platform.io.PlatformTestStorageRegistry`
 *    (openInputFile/openOutputFile): compiled and even *looked* like it
 *    passed a fast isolated test, but that test was a false positive — it
 *    only ever accumulated a single entry against a cap of 9, so a wrongly
 *    empty read produced the same `wait=null` decision a correct read would
 *    have. Diagnostic logging (`otpRateGate.awaitSlot ... readCount=...`)
 *    proved `readCount=0` on *every* call, including calls 2 and 3 within
 *    the very same process/method that had just written data seconds
 *    earlier. Root cause: `openInputFile`/`openOutputFile` are NOT a shared
 *    read/write store — they are asymmetric channels (input = test data
 *    staged before the run, output = artifacts collected after it). Using
 *    them for read-your-own-write round-tripping was an API misuse, not an
 *    implementation bug, and explains why the real full-suite 429s/timeouts
 *    were untouched by this version.
 *
 * Fix: shell-mediated I/O via
 * `InstrumentationRegistry.getInstrumentation().uiAutomation
 * .executeShellCommand(...)`, writing/reading a plain file at
 * `/sdcard/swab_e2e/otp_rate_gate_calls.txt`. This runs as the `shell`
 * identity (not the app's own UID), so it is unaffected by per-app scoped
 * storage restrictions, and the path is outside every app's own
 * package-scoped directory (`/sdcard/Android/{data,media}/<pkg>/...`), so
 * orchestrator's per-test `pm clear com.swab.android` — which only wipes
 * that one package's own data — never touches it. Content is base64-encoded
 * over the shell command to avoid newline/quoting hazards. No manual
 * cross-process file locking is needed either — orchestrator runs test
 * methods strictly one at a time, never concurrently, so `@Synchronized`
 * (in-process only) is sufficient.
 *
 * [nextWaitMillis] is the pure decision (unit-tested in
 * [OtpRateGateTest]); [awaitSlot] is the only side-effecting caller,
 * blocking the instrumentation test thread (never the Compose main thread)
 * until a slot is safely available.
 */
internal object OtpRateGate {
    /** One request under the server's real cap (IDT-03: 10/60s) — the margin
     * absorbs clock skew between this process's clock and the server's rate
     * limiter window boundary. */
    const val MAX_CALLS_PER_WINDOW: Int = 9
    const val WINDOW_MILLIS: Long = 60_000L

    /** Extra pad added on top of the computed wait so a call issued right at
     * the window boundary doesn't land a few milliseconds too early. */
    const val SAFETY_MARGIN_MILLIS: Long = 1_500L

    private const val STATE_FILE_PATH = "/sdcard/swab_e2e/otp_rate_gate_calls.txt"

    /**
     * Blocks (if needed) until issuing one more OTP-route call is safe, then
     * records that call. Call this immediately before EVERY UI action that
     * triggers an `/auth/otp/request` or `/auth/otp/verify` call.
     */
    @Synchronized
    fun awaitSlot(nowMillis: () -> Long = System::currentTimeMillis) {
        while (true) {
            val now = nowMillis()
            val inWindow = readTimestamps().filter { now - it < WINDOW_MILLIS }
            val wait = nextWaitMillis(inWindow, now)
            if (wait == null) {
                writeTimestamps(inWindow + now)
                return
            }
            Thread.sleep(wait)
        }
    }

    /** Test-only: drop all recorded call history between test classes/runs. */
    @Synchronized
    fun reset() {
        writeTimestamps(emptyList())
    }

    /** `internal` (not `private`) so [OtpRateGateTest] can assert the
     * read/write round-trip directly — the exact thing that silently broke
     * under the PlatformTestStorageRegistry version (see dead-end #3 above)
     * while every test that only went through [awaitSlot] still passed,
     * because a wrongly-empty read and a correct one produced the same
     * `wait=null` decision below the cap. */
    internal fun readTimestamps(): List<Long> {
        val output = runShell("cat $STATE_FILE_PATH")
        return output
            .lineSequence()
            .mapNotNull { it.trim().toLongOrNull() }
            .toList()
    }

    internal fun writeTimestamps(timestamps: List<Long>) {
        val content = timestamps.joinToString("\n")
        val encoded = Base64.encodeToString(content.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
        runShell("mkdir -p /sdcard/swab_e2e && echo $encoded | base64 -d > $STATE_FILE_PATH")
    }

    /** Runs [command] as the `shell` identity via the UiAutomation shell
     * bridge and returns its full stdout, blocking until the command exits.
     * Errors (e.g. `cat` on a not-yet-created file) land on stderr, which
     * this deliberately does not read — an absent file is indistinguishable
     * from an empty one for our purposes (no recorded calls yet). */
    private fun runShell(command: String): String {
        // `executeShellCommand(String)` execs the command directly — it does
        // NOT go through `sh -c`, so shell metacharacters (`&&`, `|`, `>`) in
        // a bare command string are never interpreted; the compound
        // mkdir/base64/redirect pipeline silently no-ops. Explicitly
        // invoking `sh -c` is what plain `adb shell` does implicitly.
        val pfd = InstrumentationRegistry.getInstrumentation().uiAutomation
            .executeShellCommand("sh -c '$command'")
        return android.os.ParcelFileDescriptor.AutoCloseInputStream(pfd).use { input ->
            input.bufferedReader(Charsets.UTF_8).readText()
        }
    }
}

/**
 * Pure: given the calls already recorded as happening at or after
 * `now - WINDOW_MILLIS`, how long (if at all) must the caller wait before
 * issuing one more? Returns null when a slot is free right now.
 */
internal fun nextWaitMillis(
    recentCallTimestamps: Collection<Long>,
    now: Long,
    max: Int = OtpRateGate.MAX_CALLS_PER_WINDOW,
    windowMillis: Long = OtpRateGate.WINDOW_MILLIS,
    safetyMarginMillis: Long = OtpRateGate.SAFETY_MARGIN_MILLIS,
): Long? {
    val inWindow = recentCallTimestamps.filter { now - it < windowMillis }
    if (inWindow.size < max) return null
    val oldest = inWindow.min()
    return (oldest + windowMillis + safetyMarginMillis - now).coerceAtLeast(0)
}
