#!/usr/bin/env bash
# Android E2E gate: preflight → connected instrumented suite → FS-requirement report.
# Usage: scripts/e2e-android.sh          (assumes a booted emulator/device + local API)
#        CLEAN=1 scripts/e2e-android.sh  (full clean build first — use for wave sign-off)
# Exit code: 0 only if all tests pass AND the coverage manifest shows no drift.
set -euo pipefail
cd "$(dirname "$0")/.."

ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"

echo "==> Preflight: local API"
curl -sf http://localhost:3001/health >/dev/null || {
  echo "ERROR: API not reachable at http://localhost:3001 — run: docker compose up --build -d" >&2; exit 1; }

echo "==> Preflight: device"
"$ADB" get-state >/dev/null 2>&1 || { echo "ERROR: no Android device/emulator connected (adb)" >&2; exit 1; }

RESULTS_DIR="apps/android/app/build/outputs/androidTest-results/connected"
rm -rf "$RESULTS_DIR"   # stale XML must never feed the report

echo "==> Running connected E2E suite"
pushd apps/android >/dev/null
if [[ "${CLEAN:-0}" == "1" ]]; then ./gradlew :app:clean; fi
./gradlew :app:connectedDebugAndroidTest
popd >/dev/null

echo "==> Generating report"
node scripts/e2e-report.mjs --android "$RESULTS_DIR"
