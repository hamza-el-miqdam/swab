# Local Development & Testing Guide

Quick reference for running Swab locally on iOS and Android simulators.

## Prerequisites Checklist

- [ ] Docker Desktop running (`docker compose up --build` works)
- [ ] Node.js v20+ and pnpm installed
- [ ] Xcode with iOS Simulator (macOS only)
- [ ] Android Studio with at least one AVD configured
- [ ] Neon CLI and Vercel CLI authenticated

## Quick Start (5 minutes)

### 1. Start the backend
```bash
cd /Users/mikedown/Workspace/Swab
docker compose up --build
```

Verify it's ready:
```bash
curl http://localhost:3001/ready
```

### 2. Choose your platform

#### iOS Simulator (macOS)
```bash
cd apps/mobile
npx expo run:ios
```

The app will open in the iOS Simulator automatically. The API is reachable at `http://localhost:3001` by default.

#### Android Emulator
First, start your emulator:
```bash
# List available AVDs
emulator -list-avds

# Start one (e.g., Pixel_6_Pro_API_35)
emulator -avd Pixel_6_Pro_API_35 -no-snapshot-load &
```

Configure the app to reach the API from the emulator:
```bash
# Create .env in apps/mobile if it doesn't exist
echo "EXPO_PUBLIC_API_URL=http://10.0.2.2:3001" > apps/mobile/.env
```

Then run:
```bash
cd apps/mobile
npx expo run:android
```

## Testing Flows

### Authentication (Onboarding)
1. Tap "Sign up"
2. Enter any phone number (e.g., +33612345678)
3. Copy the OTP code from the "Code (dev):" label
4. Complete contact sync, relationship calibration
5. ✅ You're in; contacts and vault are local

### Envie & Match Flow
1. Open the "Envies" tab
2. Tap "+" to create an envie ("envie de café", "envie de cinéma", etc.)
3. Choose a scope (All, Close friends, Family, Custom)
4. Review the filtered recipients (shown transparently)
5. Tap "Send"
6. ⏳ Wait for a match from another device/simulator

### Privacy Verification
- Open Adminer at http://localhost:8080 (username: swab, password: swab_local_dev)
- Browse the `vaults` table
- The `blob` column is unreadable ciphertext — this is correct! ✅

## Troubleshooting

| Issue | Solution |
|---|---|
| `expo run:android` "Cannot connect to API" | Confirm `apps/mobile/.env` has `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001` |
| "Port 3001 already in use" | Kill existing process: `lsof -ti :3001 \| xargs kill -9` |
| Android emulator won't start | Try: `emulator -avd MyAVD -no-snapshot-load -wipe-data` |
| iOS Simulator stuck | `xcrun simctl erase all` to reset all simulators |
| "Vault encryption errors" | Ensure you're using `expo run:android` (dev client), not Expo Go |
| Simulator/emulator doesn't show changes | Tap "R" twice in the terminal (full reload) or restart the dev client |

## Switching Between Simulators

**Same session:**
```bash
# Stop the current dev server (Ctrl+C)
# Update .env if needed
# Run the other command
npx expo run:ios    # or run:android
```

**Different sessions:**
Open two terminal windows side by side:
```
Terminal 1: docker compose up --build
Terminal 2 (iOS): cd apps/mobile && npx expo run:ios
Terminal 3 (Android): cd apps/mobile && npx expo run:android
```

Both will connect to the same backend.

## Database Reset

If you need a fresh database:
```bash
docker compose down -v
docker compose up --build
```

This wipes the named volume and restarts with empty schema.

## Environment Variables

| Variable | Platform | Default | Purpose |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | Mobile | `http://localhost:3001` | API endpoint (change for Android) |
| `DATABASE_URL` | Backend | From `.env.local` | Neon database URL |

## Further Reading

- [README.md](./README.md) — Full setup guide
- [docs/product-overview.md](./docs/product-overview.md) — Product vision
- [docs/agent-playbook.md](./docs/agent-playbook.md) — Development workflow
