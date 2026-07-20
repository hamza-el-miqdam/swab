# SUG-SPEC-002 — FS-07 `Status:` header says "Implemented" while STATUS.md says 🟡 and acceptance criteria cannot be green

- **Area:** specs
- **Topic:** consistency
- **Impact:** high
- **Effort:** S
- **Implementing agent:** spec-specialist (.claude/agents/spec-specialist.md) — name notion-liaison-specialist for the French mirror re-sync
- **Related requirement IDs:** IDT-02, IDT-04, IDT-06, IDT-07, IDT-09 (the unimplemented remainder of FS-07)

## Problem / Opportunity

The two "what is done" sources contradict each other:

- `docs/specs/FS-07-identity-vault.md:3` — `**Status:** Implemented (API + native vault clients, 2026-07-10 — Wave 1; multi-device/recovery-phrase items remain POC assumptions, see IDT-05/VLT-05)`.
- `docs/STATUS.md:15` — FS-07 is `🟡 In progress` with "**Missing:** contact discovery endpoint, web invite landing."

STATUS.md's own rule (`docs/STATUS.md:54`) says 🟢/"Implemented" is set "only when the spec's acceptance criteria have green tests; update the spec's `Status:` header to `Implemented` in the same PR" — the header and the table must move together, and here they diverge.

The header's "Implemented" claim is also substantively false beyond the parenthetical carve-outs:

- FS-07 acceptance criterion 1 (`FS-07:40`) requires the full lifecycle "signup → calibrate → envie → match → **delete account**" with cascade-erasure verification — no deletion endpoint exists (`apps/api/src/routes/` contains only auth.ts, health.ts, vault.ts).
- IDT-02 (`FS-07:14`) refresh rotation + reuse detection has no endpoint (`apps/api/src/routes/auth.ts:37,61` — only the two OTP routes) and no test.
- IDT-06/IDT-07 contact discovery and pending-link resolution have no server code (`docs/STATUS.md:15`), IDT-09 has no web app (`docs/STATUS.md:29`).

Per G5, "Code and docs never disagree on `main`" — an agent reading FS-07's header before implementing FS-05 (which depends on FS-07) would wrongly assume discovery/session infrastructure exists.

## Implementation plan

1. Edit `docs/specs/FS-07-identity-vault.md:3`, replacing the Status header value with:
   `**Status:** In progress (identity core + vault Implemented 2026-07-10 — Wave 1: OTP auth, JWT sessions, opaque vault store, native vault clients. Pending: refresh rotation/reuse detection (IDT-02), account deletion (IDT-04), contact discovery (IDT-06), invite links + web landing (IDT-07/09). Multi-device/recovery-phrase remain POC assumptions, see IDT-05/VLT-05)`
2. Verify `docs/STATUS.md:15` still matches (it already lists the missing items; extend the "Missing:" note with "refresh rotation (IDT-02), account deletion (IDT-04)" so both lists agree — same PR).
3. Root `CHANGELOG.md` entry (`area:specs`) per G5.
4. Ask notion-liaison-specialist to re-sync the FS-07 French mirror page (header change only) — `docs/specs/.notion-sync.json` tracks the snapshot and will otherwise flag a conflict on next liaison run.

## Tests & acceptance criteria

- `grep -n "Status:" docs/specs/FS-07-identity-vault.md` no longer contains the bare word "Implemented" as the leading state.
- STATUS.md FS-07 row and the FS-07 header enumerate the same pending items.
- Cross-check: every spec whose header says `Implemented` (FS-01, FS-02, FS-03) is 🟢 in STATUS.md, and vice versa — after this fix the mapping is a bijection.

## Risks & gotchas

- Do NOT flip STATUS.md FS-07 to 🟢 instead — the acceptance criteria demonstrably cannot be green (no deletion endpoint), so the header is what must move.
- The Notion mirror will show a diff on the next liaison invocation; flagging it proactively avoids a false "conflict" report.
- SUG-SPEC-001 (coverage manifest honesty) cites the same missing endpoints — land the two together or cross-reference the PRs.
