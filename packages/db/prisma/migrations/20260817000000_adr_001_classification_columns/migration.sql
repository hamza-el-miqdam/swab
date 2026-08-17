-- ADR-001 stage 2 — classification data moves server-side.
--
-- Adds the four axes to contact_links, the multi-select roles table, and the
-- VLT-07 idempotency ledger. `vaults` is deliberately NOT dropped here: the API
-- still serves GET/POST /vault and both clients still call it. It goes at
-- stage 3/4 together with the one-off data migration.

-- CreateEnum
-- Values are the FCH-09 identifiers verbatim (FS-03 § Stored value vocabulary),
-- so a stored byte is the same string on device and in Postgres.
CREATE TYPE "etat" AS ENUM ('available', 'busy', 'away', 'paused');

-- CreateEnum
CREATE TYPE "ressenti" AS ENUM ('positive', 'ambivalent', 'negative');

-- CreateEnum
CREATE TYPE "role_contexte" AS ENUM ('family', 'partner', 'colleague', 'cohort', 'community', 'neighbor');

-- DropIndex
-- Replaced below by a PARTIAL unique index. A plain unique over (owner, target)
-- plus tombstones would make "delete a contact, then re-add the same person"
-- fail forever against the tombstoned row.
DROP INDEX "contact_links_owner_id_target_id_key";

-- AlterTable
ALTER TABLE "contact_links" ADD COLUMN     "deleted_at" TIMESTAMPTZ(3),
ADD COLUMN     "display_name" VARCHAR(50),
ADD COLUMN     "display_name_updated_at" TIMESTAMPTZ(3),
ADD COLUMN     "etat" "etat",
ADD COLUMN     "etat_updated_at" TIMESTAMPTZ(3),
ADD COLUMN     "last_axis_change_at" TIMESTAMPTZ(3),
ADD COLUMN     "ressenti" "ressenti",
ADD COLUMN     "ressenti_updated_at" TIMESTAMPTZ(3),
ADD COLUMN     "ring" INTEGER,
ADD COLUMN     "ring_updated_at" TIMESTAMPTZ(3),
ADD COLUMN     "staleness_snoozed_until" TIMESTAMPTZ(3);

-- AlterTable
-- `updated_at` is NOT NULL with no schema-level default, so it needs a
-- transient default to backfill existing rows; dropping it again leaves the
-- table matching schema.prisma exactly (no Prisma drift on the next diff).
ALTER TABLE "contact_links" ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "contact_links" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "contact_roles" (
    "contact_link_id" TEXT NOT NULL,
    "role" "role_contexte" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "contact_roles_pkey" PRIMARY KEY ("contact_link_id","role")
);

-- CreateTable
CREATE TABLE "client_mutations" (
    "user_id" TEXT NOT NULL,
    "id" VARCHAR(64) NOT NULL,
    "applied_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_mutations_pkey" PRIMARY KEY ("user_id","id")
);

-- CreateIndex
CREATE INDEX "contact_roles_contact_link_id_updated_at_idx" ON "contact_roles"("contact_link_id", "updated_at");

-- CreateIndex
CREATE INDEX "client_mutations_applied_at_idx" ON "client_mutations"("applied_at");

-- CreateIndex
CREATE INDEX "contact_links_owner_id_updated_at_idx" ON "contact_links"("owner_id", "updated_at");

-- AddForeignKey
ALTER TABLE "contact_roles" ADD CONSTRAINT "contact_roles_contact_link_id_fkey" FOREIGN KEY ("contact_link_id") REFERENCES "contact_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_mutations" ADD CONSTRAINT "client_mutations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- Hand-written below: constraints Prisma's schema language cannot express.
-- Both are load-bearing, not hygiene — see the comments on schema.prisma.
-- ----------------------------------------------------------------------------

-- One LIVE edge per (owner, target); tombstoned rows are exempt so a contact
-- can be deleted and re-added. Vanilla Postgres partial index — no Neon-only
-- syntax (AWS portability is a hard requirement).
CREATE UNIQUE INDEX "contact_links_owner_id_target_id_live_key"
    ON "contact_links"("owner_id", "target_id")
    WHERE "deleted_at" IS NULL;

-- Intimité is 1..4 (ONB-04). Out of range breaks the clients' ring layout
-- maths, which fails silently as a mis-placed node rather than loudly.
ALTER TABLE "contact_links" ADD CONSTRAINT "contact_links_ring_range_check"
    CHECK ("ring" IS NULL OR ("ring" >= 1 AND "ring" <= 4));
