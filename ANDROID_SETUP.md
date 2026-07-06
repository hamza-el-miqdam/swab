# Android Emulator Setup Guide

Android Studio is now installed. Follow these steps to create an Android Virtual Device (AVD) and test Swab on the Android emulator.

## Step 1: Launch Android Studio

Open Android Studio (it may take a moment to start):

```bash
open -a "Android Studio"
```

## Step 2: Complete the Welcome Wizard

On first launch, Android Studio will show a setup wizard:
1. It will download SDK components (this may take 5-10 minutes)
2. Accept the licenses when prompted
3. Let it complete fully before proceeding

## Step 3: Create an Android Virtual Device (AVD)

Once Android Studio is open:

1. Click **More Actions** → **Virtual Device Manager**
2. Click **Create Device**
3. **Select a device**: Choose "Pixel 6 Pro" (or another Pixel model)
4. **Select a system image**: 
   - Click the **Recommended** tab
   - Select **Android 14** (API level 34) or newer
   - Click **Next**
5. **Configure AVD**:
   - Name: `Pixel_6_Pro_API_35` (or leave as default)
   - RAM: 4GB (default is fine)
   - Click **Finish**

Android Studio will now create the AVD.

## Step 4: Start the Emulator

> **First:** the `emulator` and `adb` commands are not on your PATH by default (`zsh: command not found: emulator`). Add this to `~/.zshrc`, then open a new terminal:
>
> ```bash
> export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
> export PATH="$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"
> ```

Once the AVD is created, you can start it from Android Studio's AVD Manager, or from the terminal:

```bash
# List your AVDs
emulator -list-avds

# Start the emulator (replace name if different)
emulator -avd Pixel_6_Pro_API_35 -no-snapshot-load &
```

Wait for it to fully boot (you'll see the Android home screen).

## Step 5: Configure Swab for Android

Set the API URL so the emulator can reach your local backend:

```bash
# From the Swab repo root
echo "EXPO_PUBLIC_API_URL=http://10.0.2.2:3001" > apps/mobile/.env
```

> **Why `10.0.2.2`?** The Android emulator is in its own network namespace. The alias `10.0.2.2` refers to your host machine's `localhost`.

## Step 6: Run Swab on Android

Start the backend (if not already running):

```bash
docker compose up --build
```

In another terminal, run Swab on the emulator:

```bash
cd apps/mobile
npx expo run:android
```

This will:
1. Build the Expo dev client (first time only, ~2-3 minutes)
2. Deploy to the running emulator
3. Open the app automatically

## Step 7: Test the App

Once Swab opens:
1. Sign up with any phone number (e.g., +33612345678)
2. Copy the OTP code displayed as "Code (dev): 123456"
3. Complete onboarding (contacts, calibration)
4. Create an envie and verify the privacy model ✅

## Troubleshooting

| Problem | Solution |
|---|---|
| Emulator won't start | Restart Android Studio and try again from AVD Manager |
| "Port 5555 in use" | Another emulator is running; `adb kill-server` then restart |
| App can't reach API | Verify `.env` has `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001` |
| "Vault encryption errors" | Make sure you're using `expo run:android` (dev client), not Expo Go |
| Slow boot time | Normal on first boot; subsequent boots are faster. Try `-no-snapshot-load` flag |

## Running Both iOS & Android

You can run both simulators at the same time:

**Terminal 1:**
```bash
docker compose up
```

**Terminal 2 (iOS):**
```bash
cd apps/mobile
npx expo run:ios
```

**Terminal 3 (Android):**
```bash
cd apps/mobile
npx expo run:android
```

Both connect to the same backend on `localhost:3001` / `10.0.2.2:3001`.

## Next Steps

- Read [DEVELOPMENT.md](./DEVELOPMENT.md) for quick commands
- Read [README.md](./README.md) for full setup details
- See [docs/product-overview.md](./docs/product-overview.md) for the product vision
