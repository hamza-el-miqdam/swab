-- CreateEnum
CREATE TYPE "filter_axis" AS ENUM ('ETAT', 'RESSENTI');

-- CreateEnum
CREATE TYPE "filter_level" AS ENUM ('VETO', 'EXCLUDED_DEFAULT', 'LOW_PRIORITY');

-- CreateTable
CREATE TABLE "filter_rules" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "axis" "filter_axis",
    "value" VARCHAR(32),
    "contact_link_id" TEXT,
    "level" "filter_level" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "sync_seq" BIGSERIAL NOT NULL,

    CONSTRAINT "filter_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "filter_rules_owner_id_sync_seq_idx" ON "filter_rules"("owner_id", "sync_seq");

-- CreateIndex
CREATE INDEX "filter_rules_contact_link_id_idx" ON "filter_rules"("contact_link_id");

-- AddForeignKey
ALTER TABLE "filter_rules" ADD CONSTRAINT "filter_rules_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filter_rules" ADD CONSTRAINT "filter_rules_contact_link_id_fkey" FOREIGN KEY ("contact_link_id") REFERENCES "contact_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- Hand-written below: constraints Prisma's schema language cannot express.
-- ----------------------------------------------------------------------------

-- A row is exactly one of "this case, at this level" or "this contact, at
-- this level" — never both, never neither. Same either/or discipline as
-- ContactLink's targetId/invitedPhoneHash pair.
ALTER TABLE "filter_rules" ADD CONSTRAINT "filter_rules_case_xor_override"
    CHECK (
        (("axis" IS NOT NULL AND "value" IS NOT NULL) AND "contact_link_id" IS NULL)
        OR
        (("axis" IS NULL AND "value" IS NULL) AND "contact_link_id" IS NOT NULL)
    );

-- One LIVE case rule per (owner, axis, value). Partial on deleted_at so a
-- tombstoned rule can be re-created; partial on contact_link_id IS NULL so
-- this index only ever arbitrates the case-rule half of the table.
CREATE UNIQUE INDEX "filter_rules_owner_axis_value_live_key"
    ON "filter_rules"("owner_id", "axis", "value")
    WHERE "deleted_at" IS NULL AND "contact_link_id" IS NULL;

-- One LIVE override per (owner, contact_link_id). Same tombstone-exempt
-- partial-unique treatment as above, mirrored to the override half.
CREATE UNIQUE INDEX "filter_rules_owner_contact_link_live_key"
    ON "filter_rules"("owner_id", "contact_link_id")
    WHERE "deleted_at" IS NULL AND "contact_link_id" IS NOT NULL;
