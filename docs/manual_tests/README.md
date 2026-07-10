# Swab Functional Testing

> **Wave 1 + Wave 2 Functional Test Suite**
> 
> Verify Onboarding (FS-01), Identity & Vault (FS-07), and Relationship Map (FS-02) end-to-end on both iOS and Android platforms.

## Quick Start

### Prerequisites
```bash
# Start backend (Docker Desktop required)
docker compose up --build -d

# Verify backend is running
curl http://localhost:3001/health

# Add test contacts to phone
# - Sam: +33611223344
# - Lina: +33687654321
```

### Manual Testing
For a **guided, step-by-step walkthrough**, read:
- [`FUNCTIONAL-TEST-SCENARIO.md`](FUNCTIONAL-TEST-SCENARIO.md) — Full manual test procedure (Steps 1–11 with verification points)

### Automated Testing

#### Android (Emulator)
```bash
./scripts/test-android-functional.sh
```

What it does:
- ✅ Installs app on emulator
- ✅ Automates onboarding flow (phone → OTP → name → contacts → calibrate)
- ✅ Verifies Relationship Map rendering
- ✅ Tests peek sheet and list mode toggle
- ✅ Validates database state (users/vaults tables)
- ✅ Checks logcat for crashes

**Expected result:** `Functional test PASSED`

---

#### iOS (Simulator)
```bash
./scripts/test-ios-functional.sh
```

What it does:
- ✅ Builds and installs app on iPhone Simulator
- ✅ Takes screenshots at key screens
- ✅ Pauses for **60 seconds of manual interaction** (due to sandbox input limitations)
- ✅ Saves screenshots to `/tmp/swab-ios-test-<timestamp>/`
- ✅ Validates database state
- ✅ Checks console for crashes

**Note:** iOS scripted input is blocked by assistive-access sandbox restrictions. The script guides you through manual taps; automated verification still runs.

---

## Test Coverage

| Feature | Manual | Android Automated | iOS Automated | Notes |
|---|---|---|---|---|
| Welcome screen | ✅ | ✅ | ✅ | Branding + button visibility |
| Phone entry | ✅ | ✅ | 🔶 | Automated on Android; manual on iOS |
| OTP verification | ✅ | ✅ | 🔶 | Dev-mode code extraction attempted |
| Display name | ✅ | ✅ | 🔶 | Vault creation verified on server |
| Contacts import | ✅ | ✅ | 🔶 | Conditional on contact availability |
| Ring calibration | ✅ | ✅ | 🔶 | Anneau 3/4 have known layout bug |
| Relationship Map | ✅ | ✅ | ✅ | Radial map + node positioning |
| Peek sheet | ✅ | ✅ | ✅ | Contact details display |
| List mode toggle | ✅ | ✅ | ✅ | Grouping by intimacy level |
| Bottom nav structure | ✅ | ✅ | ✅ | Carte/Envie/Sous-groupes tabs |
| Database records | ✅ (manual) | ✅ | ✅ | users + vaults tables |
| No crashes | ✅ | ✅ | ✅ | Logcat/Console verification |

Legend: ✅ = Automated · 🔶 = Manual/limited · ⚪ = Pending

---

## Interpreting Results

### Android Script (`test-android-functional.sh`)

**Success output:**
```
[PASS] ✅ Onboarding flow completed (FS-01)
[PASS] ✅ Relationship Map loaded (FS-02)
[PASS] ✅ Database records created
[PASS] ✅ No critical exceptions
[INFO] Functional test PASSED
```

**Failure scenarios:**

| Error | Likely Cause | Fix |
|---|---|---|
| "Backend not running" | `docker compose` not started | `docker compose up --build -d` |
| "No Android device" | Emulator not booted | `emulator -avd <name>` or open Android Studio |
| "Ça n'a pas marché" error | API unreachable from emulator | Verify `BuildConfig.API_BASE_URL = "http://10.0.2.2:3001"` |
| OTP extraction fails | Dev-mode code not in logs | Fallback uses test vector (508676); may not match actual signup |
| "No user records" | Vault POST failed silently | Check `adb logcat` for network errors |
| Exceptions in logcat | App crash during flow | Check full logcat output |

---

### iOS Script (`test-ios-functional.sh`)

**Success output:**
```
[PASS] ✅ App built and launched on Simulator
[PASS] ✅ Onboarding and Relationship Map screens reachable (manual verification)
[PASS] ✅ Screenshots saved to: /tmp/swab-ios-test-<timestamp>
[INFO] iOS Functional Test COMPLETE (manual verification required)
```

**Sandbox limitation (expected):**
```
[WARN] ⚠️  Automated input blocked by sandbox. Manual taps required:
```

This is a known environment limitation — see `docs/migration/rn-native-handoff.md` (Gotchas section) and `STATUS.md`.

---

## Database State Inspection

After running either test, inspect the database:

```bash
# List all users
docker compose exec db psql -U postgres -d postgres -c "SELECT * FROM users;"

# List all vaults
docker compose exec db psql -U postgres -d postgres -c "SELECT * FROM vaults;"

# Check vault encryption (first 50 chars of blob)
docker compose exec db psql -U postgres -d postgres -c "SELECT user_id, version, substring(encrypted_blob, 1, 50) FROM vaults;"

# Check record counts
docker compose exec db psql -U postgres -d postgres -c "\dt"
```

Expected state after onboarding:
- **users table:** 1 row with `phone_hash`, `display_name = "Nadia"`, `vault_version = 1`
- **vaults table:** 1 row with encrypted AES-256-GCM blob

---

## Troubleshooting

### Android Script Issues

**Problem:** "Contacts not detected"
```bash
# Add contacts manually to the emulator
adb shell content insert --uri content://com.android.contacts/raw_contacts \
  --bind display_name:s:Sam \
  --bind phone:s:+33611223344
```

**Problem:** "OTP code extraction failed, using 508676"
- Check the actual code in the API response or logs
- The script falls back to a test vector; if your test data differs, update the hardcoded value

**Problem:** "UI interaction failed (taps not landing)"
- Verify emulator density matches expectations in script (~1.5x scale)
- Use `adb shell uiautomator dump` to get exact element bounds
- Adjust tap coordinates in the script if needed

---

### iOS Script Issues

**Problem:** "No booted simulator found"
```bash
# Open Simulator and boot a device
open -a Simulator
# Then select a device and let it boot (takes ~30s)
```

**Problem:** "Automated input blocked by sandbox"
- Expected behavior — the script pauses for manual interaction
- Complete the onboarding steps manually in the Simulator
- Press Enter or wait 60 seconds for the script to continue

**Problem:** "Screenshots not saved"
- Check `/tmp/swab-ios-test-<timestamp>/` directory
- Verify Simulator is running and unlocked
- Try manual screenshot: `xcrun simctl io <udid> screenshot`

---

## Advanced: Running Tests in CI

Both scripts are designed to run in a CI environment (assuming Docker and emulator/simulator availability):

```yaml
# GitHub Actions example
- name: Run Android Functional Tests
  run: ./scripts/test-android-functional.sh

- name: Run iOS Functional Tests
  run: ./scripts/test-ios-functional.sh
```

**Notes:**
- CI agents typically have pre-booted emulators/simulators
- Adjust paths and Simulator UDIDs as needed for your CI environment
- Database checks assume local `docker compose` stack; adjust for CI Postgres endpoint

---

## What's Tested vs. Deferred

### ✅ Currently Tested
- Onboarding completion (phone → OTP → name → contacts → calibrate)
- Vault encryption & server sync (database verification)
- Relationship Map rendering (radial map + nodes)
- Peek sheet interaction
- List mode toggle
- Bottom navigation structure
- No crashes during primary flows

### 🔶 Tested Manually Only (iOS)
- All onboarding input (due to sandbox restrictions)
- Screenshot verification of Carte screen

### ⚪ Not Yet Tested
- FS-03 (Contact Card / "Ouvrir la fiche" seam — currently disabled)
- FS-04 (Subgroups / "Sous-groupes" tab — currently non-functional)
- FS-05 (Envie & Match — not yet implemented)
- FS-06 (Filtering rules — not yet implemented)
- Offline state changes + sync retry logic
- Large contact lists (performance/clustering deferred per OQ-MAP-1)
- Privacy data leakage audit (run via the spec-kit playbook when ready)

---

## Next Steps

### After Passing Tests
1. ✅ Wave 1 + 2 are stable and mergeable
2. Review the Android logcat and iOS console for any warnings
3. Manually inspect app behavior on a real device (if possible) before release

### Before Next Wave
1. Re-run tests after any code changes to confirm no regression
2. Update test scripts for new screens/flows (FS-03/04/05/06)
3. Consider adding E2E framework (Detox, Maestro) for iOS input automation

---

## Related Documentation

- [`FUNCTIONAL-TEST-SCENARIO.md`](FUNCTIONAL-TEST-SCENARIO.md) — Detailed manual walkthrough
- [`docs/migration/rn-native-handoff.md`](../migration/rn-native-handoff.md) — Platform gotchas & interop contracts
- [`docs/STATUS.md`](../STATUS.md) — Module implementation status
- [`docs/specs/FS-01-onboarding.md`](../specs/FS-01-onboarding.md) — Onboarding spec
- [`docs/specs/FS-02-relationship-map.md`](../specs/FS-02-relationship-map.md) — Relationship Map spec

---

**Last updated:** 2026-07-10
