#!/bin/bash

# Quick script to set up environment and run Swab on Android emulator
# Usage: ./scripts/run-android.sh [avd-name]

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default AVD name
AVD_NAME="${1:-Pixel_8_Pro}"

echo -e "${BLUE}🚀 Running Swab on Android Emulator${NC}"
echo ""

# Set up Android environment
export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export PATH="$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"

# Verify emulator exists
if ! emulator -list-avds | grep -q "^$AVD_NAME$"; then
  echo "❌ AVD not found: $AVD_NAME"
  echo "Available AVDs:"
  emulator -list-avds | sed 's/^/  /'
  exit 1
fi

echo -e "${GREEN}✅ Using AVD: $AVD_NAME${NC}"
echo ""

# Check if emulator is already running
if adb devices | grep -q "device$"; then
  echo "✓ Emulator already running"
else
  echo "Starting emulator..."
  emulator -avd "$AVD_NAME" -no-snapshot-load &

  echo "⏳ Waiting for emulator to boot (this may take 30-60 seconds)..."
  for i in {1..60}; do
    if adb devices | grep -q "device$"; then
      echo "✓ Emulator ready"
      break
    fi
    sleep 1
  done
fi

echo ""
echo "📱 Configuring Swab..."

# Set API URL for emulator
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "EXPO_PUBLIC_API_URL=http://10.0.2.2:3001" > "$REPO_ROOT/apps/mobile/.env"
echo "✓ API URL configured"

echo ""
echo -e "${BLUE}Instructions for running Swab:${NC}"
echo ""
echo "1. In one terminal, start the backend:"
echo "   cd $REPO_ROOT && docker compose up --build"
echo ""
echo "2. In another terminal, run Swab:"
echo "   cd $REPO_ROOT/apps/mobile && npx expo run:android"
echo ""
echo -e "${GREEN}✅ Environment ready!${NC}"
echo ""
