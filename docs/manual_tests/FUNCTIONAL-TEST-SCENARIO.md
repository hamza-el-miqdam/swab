# Swab Functional Test Scenario

> **Manual, step-by-step walkthrough** to verify Wave 1 (FS-01 Onboarding) and Wave 2 (FS-02 Relationship Map) end-to-end on both platforms.
> For automated testing, see `scripts/test-android-functional.sh` and `scripts/test-ios-functional.sh`.

**Last updated:** 2026-07-10  
**Scope:** Wave 1 + Wave 2 (FS-07 vault, FS-01 onboarding, FS-02 relationship map)

---

## Prerequisites

### Backend Stack
```bash
docker compose up --build -d
```

Verify:
```bash
curl http://localhost:3001/health
# Expected: 200 OK with JSON response
```

Adminer (DB inspection): http://localhost:8080  
- System: PostgreSQL
- Server: db
- Username: postgres
- Password: postgres

### Test Contacts
Add these to your phone's contacts before running either app:
- **Sam** — `+33611223344`
- **Lina** — `+33687654321`

---

## Phase 1: Onboarding Flow (FS-01)

### Android (Emulator)

**Launch:**
```bash
cd apps/android && ./gradlew installDebug
# Tap the app icon in the emulator, or:
adb shell am start -n com.swab.android/.MainActivity
```

#### Step 1: Welcome Screen
- [ ] App launches
- [ ] Branding "Swab" visible
- [ ] "Commencer" button appears and is clickable
- [ ] No crashes in logcat

**Verify:**
```bash
adb logcat -d -t 100 | grep -E "(Exception|FATAL)" | grep -v "Google Play"
# Should return nothing (or only unrelated warnings)
```

---

#### Step 2: Phone Entry
- [ ] Tap "Commencer"
- [ ] "Quel est ton numéro?" screen appears
- [ ] Tap phone input field
- [ ] Enter: `+33611223344` (or use a real test number from your contacts)
- [ ] Tap "Continuer"

**Verify:**
- Screen does NOT show "Ça n'a pas marché" error
- Loading spinner appears briefly, then disappears
- Next screen (OTP) appears within 3 seconds

---

#### Step 3: OTP Verification
- [ ] "Rentre le code" screen appears
- [ ] In **debug mode only**: OTP code is logged or returned in response
  - Check: `adb logcat | grep -i "otp\|code"` or the agent's briefing notes
  - Common code for test: `508676` (varies by test vector)
- [ ] Enter the 6-digit code
- [ ] Tap "Vérifier"

**Verify:**
- No "Ça n'a pas marché" error
- Screen advances to name entry within 2 seconds

---

#### Step 4: Display Name
- [ ] "Quel est ton prénom?" screen appears
- [ ] Tap input field
- [ ] Enter: `Nadia`
- [ ] Tap "Continuer"
- [ ] Loading spinner appears (vault created on server)

**Verify:**
- In Adminer, check `users` table: new row with `display_name = "Nadia"`
- Check `vaults` table: new row with an `encrypted_blob`
- Screen advances to contacts import within 3 seconds

---

#### Step 5: Contacts Import
- [ ] "Importer vos contacts" screen appears
- [ ] "Sam" and "Lina" appear in the list (if contacts were added to the phone)
- [ ] Tap both names to select them (checkmarks should appear)
- [ ] Tap "Continuer"

**Verify:**
- No errors
- Next screen (calibration) appears

**If contacts are not detected:**
- [ ] Tap "Ignorer" to skip
- [ ] App still advances to calibration

---

#### Step 6: Calibration (Ring Placement)
- [ ] "Placer vos contacts" screen appears
- [ ] For **Sam**:
  - Tap "Sam — —"
  - Ring buttons appear: "Anneau 1 — Très proche", "Anneau 2 — Familier", etc.
  - **Note:** Anneau 3 & 4 may have a known layout bug (text wrapping vertically) — skip them
  - Tap "Anneau 1 — Très proche"
- [ ] For **Lina**:
  - Tap "Lina — —"
  - Tap "Anneau 2 — Familier"
- [ ] Tap "Continuer"

**Verify:**
- No UI crashes or layout overflow
- Screen advances to completion

---

#### Step 7: Done Screen
- [ ] "Voilà, c'est posé." confirmation message
- [ ] "Voir ma carte" button
- [ ] Tap "Voir ma carte"

**Verify:**
- Screen transitions smoothly to Relationship Map (no hang)

---

### iOS (Simulator)

**Launch:**
```bash
cd apps/ios && xcodebuild -scheme SwabApp -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' run
```

**Steps 1–7:** Repeat the Android flow above.

**Input caveat:** Automated scripted input is blocked by sandbox assistive-access limitations. Manually tap and type each field.

**Verify:** Same logcat/database checks as Android (use Console.app if needed; check Adminer for DB state).

---

## Phase 2: Relationship Map (FS-02)

### Android (Emulator)

#### Step 8: Carte (Radial Map)
- [ ] Radial map screen appears
- [ ] "moi" (center node) is visible
- [ ] Sam node is visible on ring 1 (top-right area)
- [ ] Lina node is visible on ring 2 (further out)
- [ ] Nodes are positioned without overlap

**Verify:**
```bash
adb logcat -d -t 100 | grep -i "exception"
# Should be empty or only unrelated warnings
```

Check layout programmatically:
```bash
adb shell uiautomator dump | grep -E "resource-id.*carte|bounds" | head -20
```

---

#### Step 9: Peek Sheet
- [ ] Tap **Sam** node (top-right area of map)
- [ ] Peek sheet slides up from bottom
- [ ] Shows:
  - Contact name: "Sam"
  - Intimité: "Très proche"
  - État: "—"
  - Rôles: "—"
  - Button "Ouvrir la fiche" (disabled, gray — FS-03 pending)
- [ ] Tap outside the peek sheet (on the map)
- [ ] Peek sheet closes

**Verify:**
- Tapping other nodes updates the peek sheet (try Lina)
- State persists correctly (no data loss)
- No crashes

---

#### Step 10: List Mode Toggle
- [ ] Look for "Affichage en liste" button or toggle icon (bottom bar or top action)
- [ ] Tap it
- [ ] Map collapses → List view appears
- [ ] List is grouped by intimacy level:
  - Section: "Très proche" (header)
    - "Sam" listed below
    - "Lina" listed below
- [ ] Tap the toggle again (or "Affichage en carte")
- [ ] Map re-appears

**Verify:**
- Both views render without data loss
- Toggling is smooth and responsive

---

#### Step 11: Bottom Navigation
- [ ] Bottom nav bar shows 3 tabs:
  - "Carte" (currently active, highlighted)
  - "Envie" (gray/disabled)
  - "Sous-groupes" (gray/disabled)
- [ ] Other tabs are not clickable (or clicking them shows a placeholder)

**Verify:**
- Navigation structure is in place (FS-05/04 will add functionality later)

---

### iOS (Simulator)

**Steps 8–11:** Repeat Android tests above.

**Screenshot verification:** If interactive testing is limited, take a screenshot and verify:
- Radial map renders with both contact nodes
- Node positions correspond to ring numbers
- No "NaN" or off-screen placement

---

## Database Verification (Both Platforms)

### After Completing Onboarding

Open Adminer: http://localhost:8080

#### Users Table
```sql
SELECT * FROM users;
```

**Expected row:**
| phone_hash | display_name | vault_version | created_at |
|---|---|---|---|
| `sha256(swab-poc-phone-salt-v1:<E164>)` | Nadia | 1 | 2026-07-10 ... |

#### Vaults Table
```sql
SELECT user_id, version, LENGTH(encrypted_blob) as blob_size FROM vaults;
```

**Expected row:**
| user_id | version | blob_size |
|---|---|---|
| 1 | 1 | ~500–800 (encrypted vault JSON) |

#### Envies Table
```sql
SELECT COUNT(*) FROM envies;
```

**Expected:** 0 (FS-05 not yet implemented)

---

## Logcat Verification (Android)

After completing Steps 1–11:

```bash
adb logcat -d -t 2000 | grep -iE "(swab.*exception|app crash|fatal)" | grep -v "Google Play"
```

**Expected:** Empty output (no app-specific errors).

---

## Test Pass Criteria

### All Platforms
- ✅ App launches without crashing
- ✅ Onboarding flow completes (Steps 1–7)
- ✅ Database shows user + vault records
- ✅ No "Ça n'a pas marché" errors during phone/OTP/vault creation
- ✅ Relationship Map renders (Step 8)
- ✅ Both contacts (Sam, Lina) appear on their assigned rings
- ✅ Peek sheet opens/closes correctly (Step 9)
- ✅ List mode toggle works (Step 10)
- ✅ Bottom nav structure in place (Step 11)
- ✅ No crashes in logcat/console

### Result: Wave 1 + Wave 2 Functional Scope ✅

---

## Troubleshooting

| Issue | Diagnosis | Fix |
|---|---|---|
| "Ça n'a pas marché" on Phone screen | Network timeout or API unreachable | Verify `docker compose up` is running; check `curl http://localhost:3001/health` |
| OTP verification fails | Wrong code or dev-mode code not in response | For emulator, check agent logs or use `adb logcat` to find the 6-digit code |
| Contacts not detected | Android permissions or empty contact list | Add Sam + Lina manually to phone contacts; grant contacts permission when prompted |
| Map renders at wrong size or density | Android emulator density mismatch | This was a Wave 2 bug (now fixed); if map is ~1/3 size, rebuild with latest commit |
| "Anneau 3/4" buttons show vertical text | Pre-existing layout bug in RN-ported `CalibrateScreen` | Known issue, not blocking Wave 1/2; use rings 1 & 2 instead |
| iOS: Input fields unresponsive | Assistive-access sandbox limitation | Manual workaround for now; automated input testing deferred to Wave 3 |

---

## Next Steps (Wave 3+)

- FS-03: Contact Card ("Ouvrir la fiche" seam)
- FS-04: Subgroups (Sous-groupes screen functionality)
- FS-05: Envie & Match
- FS-06: Filtering rules
