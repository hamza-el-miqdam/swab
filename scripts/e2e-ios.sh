#!/usr/bin/env bash
# iOS E2E gate: preflight → XCUITest suite → FS-requirement report.
# Usage: scripts/e2e-ios.sh                       (uses the first booted iPhone simulator)
#        SIMULATOR_UDID=<udid> scripts/e2e-ios.sh (explicit target)
# Exit code: 0 only if all tests pass AND the coverage manifest shows no drift.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Preflight: local API"
curl -sf http://localhost:3001/health >/dev/null || {
  echo "ERROR: API not reachable at http://localhost:3001 — run: docker compose up --build -d" >&2; exit 1; }

echo "==> Preflight: simulator"
UDID="${SIMULATOR_UDID:-$(xcrun simctl list devices booted | sed -n 's/.*(\([0-9A-F-]\{36\}\)) (Booted).*/\1/p' | head -1)}"
[[ -n "$UDID" ]] || { echo "ERROR: no booted simulator — boot one with: xcrun simctl boot <udid>" >&2; exit 1; }
echo "    using simulator $UDID"

RESULT_BUNDLE="test-results/e2e/ios-e2e.xcresult"
rm -rf "$RESULT_BUNDLE"   # xcodebuild refuses to overwrite; stale bundles must never feed the report
mkdir -p test-results/e2e

echo "==> Running XCUITest suite"
xcodebuild test \
  -project apps/ios/SwabApp.xcodeproj \
  -scheme SwabApp \
  -destination "id=$UDID" \
  -only-testing:SwabAppUITests \
  -resultBundlePath "$RESULT_BUNDLE"

echo "==> Generating report"
node scripts/e2e-report.mjs --ios "$RESULT_BUNDLE"
