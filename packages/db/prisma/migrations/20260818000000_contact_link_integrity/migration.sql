-- SUG-DB-009 — ContactLink integrity: reject self-links, reject a fully
-- orphaned row (no target and no discovery handle), and enforce one LIVE
-- pending invite per (owner, phone hash).

-- `target`'s FK now cascades instead of SetNull. A SetNull deletion path
-- would leave targetId=NULL rows behind whose invitedPhoneHash may already
-- be null (post-resolution, per the IDT-07 contract below) — exactly the
-- both-null row shape the CHECK further down forbids. Cascade removes the
-- row instead, which also matches the data-steward rule that account
-- deletion cascades everywhere (IDT-08: links are directional and private,
-- a dangling "linked to nobody, no handle" row has no product meaning).
-- DropForeignKey
ALTER TABLE "contact_links" DROP CONSTRAINT "contact_links_target_id_fkey";

-- AddForeignKey
ALTER TABLE "contact_links" ADD CONSTRAINT "contact_links_target_id_fkey"
    FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- Hand-written below: constraints Prisma's schema language cannot express
-- (same pattern as the live-edge partial unique index added in
-- 20260817000000_adr_001_classification_columns).
-- ----------------------------------------------------------------------------

-- No self-links: a row where the owner is also the target has no product
-- meaning and would pollute future recipient/matching resolution.
ALTER TABLE "contact_links" ADD CONSTRAINT "contact_links_no_self_link"
    CHECK ("owner_id" IS DISTINCT FROM "target_id");

-- No fully-orphaned row: every row is either resolved (target_id set) or a
-- pending invite (invited_phone_hash set). Only reachable by application bug
-- now that the target FK cascades instead of SetNull-ing.
ALTER TABLE "contact_links" ADD CONSTRAINT "contact_links_resolved_or_pending"
    CHECK ("target_id" IS NOT NULL OR "invited_phone_hash" IS NOT NULL);

-- One LIVE pending invite per (owner, phone hash). Postgres unique indexes
-- treat NULLs as distinct, so this only ever arbitrates rows that still carry
-- a hash — a resolved link (invited_phone_hash cleared per the IDT-07
-- contract) never collides with a later invite to the same person. Partial on
-- deleted_at so a tombstoned invite can be re-sent (same reasoning as the
-- live-edge index above).
CREATE UNIQUE INDEX "contact_links_owner_id_invited_phone_hash_live_key"
    ON "contact_links"("owner_id", "invited_phone_hash")
    WHERE "deleted_at" IS NULL;
