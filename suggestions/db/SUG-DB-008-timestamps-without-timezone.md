# SUG-DB-008 — All DateTime columns are `timestamp` without time zone — switch to `timestamptz` before the baseline migration

- **Area:** db
- **Topic:** portability
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** data-steward (.claude/agents/data-steward.md)
- **Related requirement IDs:** ENV-07/ENV-08 (expiry comparisons), n/a otherwise

## Problem / Opportunity

Prisma maps `DateTime` to Postgres `timestamp(3)` **without time zone** by default. Every temporal column in the schema uses the bare type — no `@db.Timestamptz` anywhere in `packages/db/prisma/schema.prisma` (verified: `User.createdAt`:18, `Vault.updatedAt`:39, `Device.createdAt`:50, `ContactLink.createdAt`:63, `Envie.expiresAt`/`createdAt`:79–80, `EnvieRecipient.createdAt`:95, `Match.notifiedAt`/`createdAt`:114–115, `Proposal.timeslot`/`createdAt`:131,133).

Why it matters here specifically:

- `Envie.expiresAt` drives matching ("both unexpired", ENV-08, `docs/specs/FS-05-envie-match.md:31`) and the expiry sweep (swab-domain-spec.md:160). Comparisons like `expires_at > now()` mix a timezone-naive column with `timestamptz now()` — correct only while every writer and the server share UTC assumptions; a single misconfigured session/container `TimeZone` silently shifts expiries by hours.
- AWS portability is a hard requirement (CLAUDE.md hard boundaries; data-specialist.md:24): RDS/Aurora default `TimeZone` settings differ across setups; `timestamptz` normalizes to UTC at storage and is the standard defensive choice.
- `Proposal.timeslot` (schema.prisma:131) is a user-facing meeting time — the one column where timezone bugs are directly visible to users.

Cost of fixing is near-zero now (no production data, no baseline migration yet per SUG-DB-002) and a painful table-rewrite later.

## Implementation plan

1. Add `@db.Timestamptz(3)` to every `DateTime` field listed above, e.g.:
   ```prisma
   expiresAt DateTime @map("expires_at") @db.Timestamptz(3)
   ```
   (Keep `@default(now())` / `@updatedAt` attributes unchanged — they compose.)
2. Land BEFORE or WITHIN the baseline init migration (SUG-DB-002) so the baseline SQL is born with `timestamptz` — ideal ordering: this PR first, then generate the baseline.
3. If a dev database already exists from `db push`, the diff produces `ALTER COLUMN ... TYPE timestamptz(3)` — safe (Postgres reinterprets using the session timezone; on all-UTC dev data this is lossless). Note it in the changelog.
4. Regenerate client — no TS type change (`Date` either way); seed unaffected (all seed times are explicit UTC ISO strings, `packages/db/prisma/seed.ts:27`).
5. Changelog entry.

## Tests & acceptance criteria

- SUG-DB-004 harness: assert `information_schema.columns.data_type = 'timestamp with time zone'` for `envies.expires_at` and `proposals.timeslot`.
- Round-trip test: write an envie with a fixed instant, `SET TIME ZONE 'America/New_York'`, read back via raw SQL — instant unchanged.
- `prisma validate` + full turbo gate green.

## Risks & gotchas

- Apply to ALL DateTime columns in one migration — a mixed schema (some naive, some tz-aware) is worse than either convention.
- If any environment was populated with non-UTC session timezones before conversion, the reinterpretation shifts those values — with only seed data in play today, this is a non-issue; do it before real data exists.
- Prisma always sends/reads UTC, so app behavior is unchanged; the win is at the SQL/ops layer (cron sweeps, ad-hoc queries, RDS migration).
