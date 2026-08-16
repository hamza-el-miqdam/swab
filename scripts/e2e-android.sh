#!/usr/bin/env bash
# Android E2E gate: preflight → connected instrumented suite → FS-requirement report.
# Usage: scripts/e2e-android.sh          (assumes a booted emulator/device + local API)
#        CLEAN=1 scripts/e2e-android.sh  (full clean build first — use for wave sign-off)
#        ALLOW_UNSUPPORTED_API=1 ...     (bypass the emulator API-level guard below)
#
# The local API needs NO database: `pnpm --filter @repo/api dev:local` boots it
# with the in-memory repository (see apps/api/tests/dev-local-server.ts).
# Use `docker compose up --build -d` instead when you want the real Postgres.
# Exit code: 0 only if all tests pass AND the coverage manifest shows no drift.
set -euo pipefail
cd "$(dirname "$0")/.."

ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"

echo "==> Preflight: local API"
curl -sf http://localhost:3001/health >/dev/null || {
  echo "ERROR: API not reachable at http://localhost:3001" >&2
  echo "  no database needed:  pnpm --filter @repo/api dev:local" >&2
  echo "  with real Postgres:  docker compose up --build -d" >&2
  exit 1; }

echo "==> Preflight: device"
"$ADB" get-state >/dev/null 2>&1 || { echo "ERROR: no Android device/emulator connected (adb)" >&2; exit 1; }

# The pinned Espresso reflectively calls android.hardware.input.InputManager
# .getInstance(), removed in newer platforms. On API >= 35 every Compose UI
# test dies inside Espresso.onIdle before any app code runs, so the suite
# fails wholesale for a reason that has nothing to do with the app. Fail
# loudly here instead of letting someone debug 20+ bogus failures.
# Fix tracked in issue #56 (Android toolchain uplift); drop this guard once
# androidx.test/Espresso are bumped and the suite is green on a current image.
echo "==> Preflight: emulator API level"
DEVICE_API="$("$ADB" shell getprop ro.build.version.sdk 2>/dev/null | tr -d '\r')"
if [[ -n "$DEVICE_API" && "$DEVICE_API" -ge 35 && "${ALLOW_UNSUPPORTED_API:-0}" != "1" ]]; then
  echo "ERROR: device/emulator is API $DEVICE_API; the pinned Espresso only works up to API 34." >&2
  echo "  Symptom if you continue: NoSuchMethodException InputManager.getInstance in Espresso.onIdle." >&2
  echo "  Use an API 34 image (e.g. the Pixel_6_Pro AVD), or set ALLOW_UNSUPPORTED_API=1 to override." >&2
  echo "  Tracking: https://github.com/hamza-el-miqdam/swab/issues/56" >&2
  exit 1
fi
echo "    API $DEVICE_API — supported"


RESULTS_DIR="apps/android/app/build/outputs/androidTest-results/connected"
rm -rf "$RESULTS_DIR"   # stale XML must never feed the report

echo "==> Running connected E2E suite"
pushd apps/android >/dev/null
if [[ "${CLEAN:-0}" == "1" ]]; then ./gradlew :app:clean; fi
./gradlew :app:connectedDebugAndroidTest
popd >/dev/null

echo "==> Generating report"
node scripts/e2e-report.mjs --android "$RESULTS_DIR"
