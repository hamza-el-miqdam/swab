-- SUG-DB-015 — Envie, Match, Proposal and Device carry mutable state (status
-- flips, lifecycle transitions, push-token rotation) with no record of when
-- it last changed. Only Vault and ContactLink/ContactRole had updatedAt.
--
-- Backfills to now() via the DEFAULT — an honest "unknown before this date"
-- for pre-existing rows, same pattern as SUG-DB-012's Vault.createdAt.
--
-- HAZARD (flagged to area:api in the PR): Match.updatedAt ticks when a pass
-- marker is written (passed_by_a_at/passed_by_b_at, SUG-DB-006) — the
-- counterpart-facing serializer must never include updatedAt, or it becomes
-- a covert pass-signal and breaks the ENV-15 bit-identity guarantee.

-- AlterTable
ALTER TABLE "envies" ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now();

-- AlterTable
ALTER TABLE "matches" ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now();

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now();

-- AlterTable
ALTER TABLE "devices" ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now();
