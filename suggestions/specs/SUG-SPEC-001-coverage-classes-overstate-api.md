# SUG-SPEC-001 — `api-integration` coverage classifications claim apps/api tests that do not exist

- **Area:** specs
- **Topic:** coverage
- **Impact:** high
- **Effort:** S
- **Implementing agent:** spec-specialist (.claude/agents/spec-specialist.md)
- **Related requirement IDs:** IDT-02, IDT-03, IDT-04, IDT-06, IDT-07

## Problem / Opportunity

The manifest's own class definition (`docs/qa/e2e-scenarios.md:15`) says `api-integration` means "Server-side requirement, **verified by `apps/api` integration tests**". Several entries use that class (or a note claiming apps/api tests) for behavior that has **no endpoint and no test** today:

- **IDT-02** — `docs/qa/e2e-coverage.json:189-192` classifies it `api-integration` ("Server-session behavior — apps/api integration suite"). The requirement (`docs/specs/FS-07-identity-vault.md:14`) demands "rotating refresh token per device. Refresh reuse detection revokes the family." Reality: `apps/api/src/routes/auth.ts` contains only `POST /auth/otp/request` (line 37) and `POST /auth/otp/verify` (line 61) — **there is no refresh endpoint at all**, hence no rotation and no reuse detection. The only related test is `apps/api/tests/vault.test.ts:84` (refresh-typed token rejected as access token), which does not verify rotation or family revocation.
- **IDT-03** — `docs/qa/e2e-coverage.json:193-199`. `apps/api/tests/auth.test.ts:55,87` covers single-use codes and per-phoneHash throttling, but the requirement (`FS-07:15`) also demands "per IP" throttling — no IP-based logic or test exists (grep of `apps/api/src/routes/auth.ts` finds none). The note does not disclose the per-IP gap.
- **IDT-04** — `docs/qa/e2e-coverage.json:205` note says "cascade erasure is an apps/api integration test." No deletion route exists (`apps/api/src/routes/` = auth.ts, health.ts, vault.ts only) and no such test exists (`apps/api/tests/` = auth, env, vault, health).
- **IDT-06** — `docs/qa/e2e-coverage.json:219` note: "response-shape guarantees are apps/api tests." There is no discovery endpoint — `docs/STATUS.md:15` itself admits "**Missing:** contact discovery endpoint."
- **IDT-07** — `docs/qa/e2e-coverage.json:224-226` classifies `api-integration`; no contact-link endpoints or web landing exist (`docs/STATUS.md:29`: "apps/web … not created yet").

G2 requires "honest classification, never silently dropped" (`agents/_global-directives.md`, E2E gate bullet). These entries read as verified when the verification target does not exist yet — exactly the dishonesty G2 forbids.

## Implementation plan

1. Edit `docs/qa/e2e-coverage.json` (spec-specialist owns `docs/qa/` manifest text; this is a classification-honesty fix, no test changes):
   - **IDT-02**: change both platform statuses to `"not-e2e-verifiable"`; replace notes with: `"Refresh rotation + reuse detection not yet implemented server-side (no /auth/refresh endpoint) — no test exists yet. Reclass to api-integration when the FS-07 backend session work lands. Only the refresh-token-rejected-as-access case is covered (apps/api vault.test.ts)."`
   - **IDT-03**: keep `api-integration` (real tests exist for phoneHash throttle + single-use) but append to notes: `"Per-phoneHash throttle and single-use are tested (apps/api auth.test.ts); the per-IP half of IDT-03 is not implemented or tested yet."`
   - **IDT-04**: keep `not-e2e-verifiable`; fix the note's false claim — replace "cascade erasure is an apps/api integration test" with "cascade erasure has no endpoint or test yet (FS-07 in progress); add the apps/api integration test with the deletion endpoint."
   - **IDT-06**: keep `unit-covered` for the client-side hashing half; fix notes: "response-shape guarantees will be apps/api tests — the discovery endpoint does not exist yet (STATUS: missing)."
   - **IDT-07**: change to `"not-e2e-verifiable"`, notes: "No contact-link endpoints or web landing exist yet; reclass when FS-07 discovery/invite work lands. Mobile half is FCH-08 (automated)."
2. Mirror the same honesty fixes in the FS-07 section of `docs/qa/e2e-scenarios.md` (lines 180-208): IDT-02, IDT-03, IDT-04, IDT-06, IDT-07 verification notes.
3. Check `scripts/e2e-report.mjs` treats the changed statuses as valid enum values (only `automated` should drive the drift guard); no script change expected.
4. Root `CHANGELOG.md` entry (`area:specs`) per G5.

## Tests & acceptance criteria

- `node scripts/e2e-report.mjs` (or the e2e scripts' report step) still succeeds and the report joins cleanly with zero drift failures.
- `grep -n "api-integration" docs/qa/e2e-coverage.json` no longer includes IDT-02/IDT-07; every remaining `api-integration` entry names behavior that has a real test in `apps/api/tests/` (VLT-02, VLT-03, IDT-03-partial are legitimately covered).
- No note in the manifest asserts a test that cannot be found by grepping `apps/api/tests/`.

## Risks & gotchas

- Do not touch `automated` entries — the drift guard depends on their test-name lists.
- When the backend implements refresh/discovery/deletion (FS-07 completion), these entries must be reclassed back in that same PR — say so in each note so the future agent sees it.
- No Notion impact (QA manifest is not mirrored).
