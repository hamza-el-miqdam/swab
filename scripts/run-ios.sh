#!/bin/bash

# Quick script to run Swab on iOS Simulator

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Running Swab on iOS Simulator${NC}"
echo ""

# Verify Xcode is installed
if ! xcode-select -p &> /dev/null; then
  echo "❌ Xcode command-line tools not installed"
  echo "Install with: xcode-select --install"
  exit 1
fi

echo -e "${GREEN}✅ Xcode found${NC}"
echo ""

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "📱 Configuring Swab..."
# iOS Simulator can reach localhost directly
echo "EXPO_PUBLIC_API_URL=http://localhost:3001" > "$REPO_ROOT/apps/mobile/.env"
echo "✓ API URL configured for iOS (http://localhost:3001)"

echo ""
echo -e "${BLUE}Instructions for running Swab:${NC}"
echo ""
echo "1. In one terminal, start the backend:"
echo "   cd $REPO_ROOT && docker compose up --build"
echo ""
echo "2. In another terminal, run Swab on iOS:"
echo "   cd $REPO_ROOT/apps/mobile && npx expo run:ios"
echo ""
echo "   (On first run, Expo will build the dev client — this takes 2-3 minutes)"
echo ""
echo -e "${GREEN}✅ Environment ready!${NC}"
echo ""
