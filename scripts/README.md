# Swab Scripts

Helper scripts for development and testing.

## Agent prompts

### `render-agents.mjs`

Generates all tool-specific agent files from the single source of truth in `agents/`:

```bash
node scripts/render-agents.mjs           # render Copilot (.github/) + Claude Code (.claude/agents/) copies
node scripts/render-agents.mjs --check   # exit 1 if renders are stale (for CI)
```

Never edit the rendered files by hand — edit `agents/*.md` and re-run.

## Android Development

### `setup-android-emulator.sh`

Configure Android SDK environment and manage Android Virtual Devices (AVDs).

**Usage:**
```bash
./scripts/setup-android-emulator.sh          # List existing AVDs and show setup instructions
./scripts/setup-android-emulator.sh --create --avd-name Pixel_9_Pro  # Create a new AVD
```

**What it does:**
- Verifies Android SDK is installed
- Lists available Android Virtual Devices
- Optionally creates a new AVD
- Prints step-by-step instructions for running Swab

**Prerequisites:**
- Android Studio installed: `brew install --cask android-studio`
- (First time only) Add Android tools to your shell:
  ```bash
  export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
  export PATH="$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/platform-tools:$PATH"
  ```
  Or add to `~/.zshrc` / `~/.bashrc` for persistence.

### `run-android.sh`

Quick start script to set up environment and configure Swab for Android emulator testing.

**Usage:**
```bash
./scripts/run-android.sh                    # Use default AVD (Pixel_8_Pro)
./scripts/run-android.sh Pixel_6_Pro        # Use a specific AVD
```

**What it does:**
- Sets up Android environment variables
- Checks if the specified AVD exists
- Starts the emulator if not already running
- Waits for emulator to boot
- Configures Swab API URL for emulator (`http://10.0.2.2:3001`)
- Prints instructions for running the backend and app

**Next steps (after running this script):**
```bash
# Terminal 1: Start backend
docker compose up --build

# Terminal 2: Run Swab
cd apps/mobile && npx expo run:android
```

## iOS Development

### `run-ios.sh`

Quick start script to configure Swab for iOS Simulator testing.

**Usage:**
```bash
./scripts/run-ios.sh
```

**What it does:**
- Verifies Xcode command-line tools are installed
- Configures Swab API URL for iOS Simulator (`http://localhost:3001`)
- Prints instructions for running the backend and app

**Prerequisites:**
- macOS with Xcode installed
- Xcode command-line tools: `xcode-select --install`

**Next steps (after running this script):**
```bash
# Terminal 1: Start backend
docker compose up --build

# Terminal 2: Run Swab
cd apps/mobile && npx expo run:ios
```

## All Scripts

| Script | Purpose | Platform |
|--------|---------|----------|
| `setup-android-emulator.sh` | Set up Android SDK environment | Android |
| `run-android.sh` | Quick start for Android testing | Android |
| `run-ios.sh` | Quick start for iOS testing | iOS |

## Environment Variables

These scripts set the following for you:

### Android
- `ANDROID_SDK_ROOT` = `$HOME/Library/Android/sdk`
- `EXPO_PUBLIC_API_URL` = `http://10.0.2.2:3001` (emulator's alias for host localhost)

### iOS
- `EXPO_PUBLIC_API_URL` = `http://localhost:3001` (direct localhost access)

## Troubleshooting

**"emulator: command not found"**
- Set up environment:
  ```bash
  export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"
  export PATH="$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/platform-tools:$PATH"
  ```
- Or run `source ~/.zshrc` to reload your shell config

**"AVD not found"**
- List available AVDs:
  ```bash
  emulator -list-avds
  ```
- Create a new one:
  ```bash
  ./scripts/setup-android-emulator.sh --create
  ```

**Emulator won't start**
- Try with more verbose output:
  ```bash
  emulator -avd Pixel_8_Pro -no-snapshot-load -verbose
  ```
- Or restart Android Studio's AVD Manager

**iOS Simulator not launching**
- Ensure Xcode is up to date: `xcode-select --install`
- Reset simulators: `xcrun simctl erase all`

## See Also

- [ANDROID_SETUP.md](../ANDROID_SETUP.md) — Detailed Android setup guide
- [DEVELOPMENT.md](../DEVELOPMENT.md) — Development workflow guide
- [README.md](../README.md) — Project overview
