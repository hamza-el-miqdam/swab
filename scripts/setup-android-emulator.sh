#!/bin/bash

# Setup Android Emulator for Swab
# This script configures the Android SDK environment and lists/creates AVDs for local testing
# Usage: ./scripts/setup-android-emulator.sh [--create] [--avd-name NAME]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
CREATE_AVD=false
AVD_NAME="Pixel_8_Pro"
while [[ $# -gt 0 ]]; do
  case $1 in
    --create) CREATE_AVD=true; shift ;;
    --avd-name) AVD_NAME="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo -e "${BLUE}🤖 Android Emulator Setup for Swab${NC}"
echo ""

# Check if Android SDK is installed
if [ ! -d "$HOME/Library/Android/sdk" ]; then
  echo -e "${RED}❌ Android SDK not found.${NC}"
  echo "Install Android Studio with:"
  echo "  brew install --cask android-studio"
  exit 1
fi

export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
export PATH="$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"

# Verify emulator command exists
if ! command -v emulator &> /dev/null; then
  echo -e "${RED}❌ emulator command not found.${NC}"
  echo "Try adding to your shell:"
  echo "  export ANDROID_SDK_ROOT=\"\$HOME/Library/Android/sdk\""
  echo "  export PATH=\"\$ANDROID_SDK_ROOT/emulator:\$ANDROID_SDK_ROOT/platform-tools:\$PATH\""
  exit 1
fi

echo -e "${GREEN}✅ Android SDK found at: $ANDROID_SDK_ROOT${NC}"
echo ""

# List existing AVDs
echo -e "${BLUE}📱 Available Android Virtual Devices:${NC}"
AVDS=$(emulator -list-avds)
if [ -z "$AVDS" ]; then
  echo "  (none found)"
else
  echo "$AVDS" | sed 's/^/  ✓ /'
fi
echo ""

if [ "$CREATE_AVD" = true ]; then
  echo -e "${YELLOW}Creating new AVD: $AVD_NAME${NC}"

  SYSTEM_IMAGE="system-images;android-35;google_apis;arm64-v8a"

  echo "📦 Installing system image..."
  yes | sdkmanager "$SYSTEM_IMAGE" --channel=0 2>/dev/null || true

  echo "📱 Creating Android Virtual Device..."

  # Remove existing AVD if it exists
  rm -rf "$ANDROID_SDK_ROOT/avd/$AVD_NAME.avd" 2>/dev/null || true

  # Create new AVD
  echo "no" | avdmanager create avd \
    -n "$AVD_NAME" \
    -k "$SYSTEM_IMAGE" \
    -d "Pixel 8 Pro" \
    --force 2>/dev/null || {
    echo -e "${RED}❌ Failed to create AVD.${NC}"
    exit 1
  }

  echo -e "${GREEN}✅ AVD created: $AVD_NAME${NC}"
  echo ""
fi

# Print setup instructions
echo -e "${BLUE}🚀 Next Steps:${NC}"
echo ""
echo "1. Add Android tools to your current shell session:"
echo -e "   ${YELLOW}export ANDROID_SDK_ROOT=\"\$HOME/Library/Android/sdk\"${NC}"
echo -e "   ${YELLOW}export PATH=\"\$ANDROID_SDK_ROOT/emulator:\$ANDROID_SDK_ROOT/platform-tools:\$PATH\"${NC}"
echo ""
echo "2. Start the emulator:"
echo -e "   ${YELLOW}emulator -avd ${AVD_NAME} -no-snapshot-load &${NC}"
echo ""
echo "3. Configure Swab API URL:"
echo -e "   ${YELLOW}echo \"EXPO_PUBLIC_API_URL=http://10.0.2.2:3001\" > apps/mobile/.env${NC}"
echo ""
echo "4. Start the backend (in another terminal):"
echo -e "   ${YELLOW}docker compose up --build${NC}"
echo ""
echo "5. Run Swab on the emulator:"
echo -e "   ${YELLOW}cd apps/mobile && npx expo run:android${NC}"
echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "ℹ️  To add Android tools permanently, update your shell config (.zshrc/.bashrc):"
echo "   See ANDROID_SETUP.md for details"
echo ""
