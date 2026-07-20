# Changelog — packages/db (area:db)

> Newest first. One entry per schema/seed/migration change. **Only the Data Steward writes here** (same rule as `schema.prisma`).
> Format: `## YYYY-MM-DD — [REQ-IDs] title` then bullets: model diff summary, motivating query patterns, privacy-audit note.
> Agents: updating this file is part of your Definition of Done (G5). Keep entries ≤ ~15 lines.

## 2026-07-05 — Schema v0.1 (commit e2914a0)

- Initial models: `users` (id, phoneHash, displayName), `vaults` (opaque `blob` + `version` per user), `envies` (skeleton for FS-05).
- Privacy audit note: no table or column stores rings, tags, rules, subgroup names, or scope names — classification exists only inside `vaults.blob` ciphertext. Verifiable via Adminer (:8080) on the local stack.
- `seed.ts` for local development.
- No migrations yet — local dev uses `prisma db push` from the API container; real migrations land with the first production deploy.
