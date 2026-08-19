-- SUG-DB-012 — Vault: DB-level 1 MB quota CHECK (defense in depth behind the
-- route's 413) and a missing createdAt column.
--
-- Quota is currently app-layer only (apps/api/src/routes/vault.ts
-- MAX_VAULT_BYTES = 1_048_576, checked before the write). Any other write
-- path — an admin script, a second service, a route bug — could blow the
-- storage budget on vaults.blob with nothing at the DB layer to stop it.
-- octet_length is the one explicitly permitted operation on the opaque blob
-- (VLT-03: "beyond byte length for quota"), so this CHECK never inspects
-- content.
--
-- createdAt backfills to now() via the default on existing rows — acceptable,
-- no true creation record exists for vaults written before this migration.

-- AlterTable
ALTER TABLE "vaults" ADD COLUMN "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now();

-- ----------------------------------------------------------------------------
-- Hand-written below: a CHECK Prisma's schema language cannot express (same
-- pattern as the canonical-pair-order and ContactLink integrity CHECKs).
-- ----------------------------------------------------------------------------
ALTER TABLE "vaults"
  ADD CONSTRAINT "vaults_blob_quota" CHECK (octet_length("blob") <= 1048576);
