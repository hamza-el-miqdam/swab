# docs/migration — what is still binding, and what is history

The Expo/React-Native app was retired 2026-07-19; its knowledge lives here. **Two of these files are
still binding contracts and two are history.** This index exists so you can tell which is which
without reading ~40 KB of prose to find out.

| File | Status | Why |
|---|---|---|
| `rn-native-handoff.md` | **BINDING — read before any `apps/ios` / `apps/android` task** | Named as binding by both mobile agent files. §2 holds the live phone-hash contract `sha256("SALT:E164")` (IDT-01), API shapes and sync semantics. §5 lists known platform divergences you must not silently "fix". |
| `vault-test-vectors.json` | **PARTLY LIVE — do not delete** | `phoneHash` vectors are still asserted by passing tests (`PhoneHashVectorTest` on Android, `VaultCryptoTests` on iOS; copied into each platform's test resources). The **vault blob** vectors are historical — see below. |
| `generate-vault-test-vectors.mjs` | History | Generator for the file above, from the RN implementation. Kept so the vectors are reproducible, not because it is run. |
| `rn-audit-map.md` | **Archived** → [`docs/archive/migration/rn-audit-map.md`](../archive/migration/rn-audit-map.md) | Per-wave parity checklists for a migration that completed. Moved 2026-08-16, not deleted. |

## The vault format is historical (ADR-001)

As of [ADR-001](../decisions/ADR-001-server-side-classification-data.md) (2026-08-16), end-to-end
encryption is retired and classification data lives server-side. So:

- The vault wire format `base64(IV(12) ‖ TAG(16) ‖ CIPHERTEXT)` and the `vault` entries in
  `vault-test-vectors.json` describe a design that is **being replaced**. Do not build new work
  against them, and do not extend that vector file.
- The existing crypto tests stay green until the client-stage migration lands — they correctly
  describe what currently ships. Do not pre-emptively delete them.
- `phoneHash` is unaffected and remains live under IDT-01.
