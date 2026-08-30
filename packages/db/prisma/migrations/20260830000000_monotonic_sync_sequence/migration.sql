-- #168 (VLT-08, VLT-04) — monotonic bigserial sync sequence.
--
-- The delta-pull cursor for `contact_links`/`contact_roles` (VLT-08) has been
-- keyed on `updated_at`, an inclusive-millisecond + afterId tie-break
-- workaround (see `apps/api/src/contacts/cursor.ts`) because two writes in the
-- same millisecond are indistinguishable by timestamp alone. This migration
-- adds a strictly-increasing `sync_seq` column to both tables — a plain
-- Postgres `bigserial` (vanilla, AWS-portable, no trigger) — so a future
-- keyset cursor can be `sync_seq > cursor` with no tie-break at all.
--
-- `updated_at` is UNCHANGED on both tables: it keeps its display + VLT-09 CAS
-- role. Only the cursor ordering key moves.
--
-- Retrofit: existing rows are backfilled preserving their current relative
-- order — (updated_at, id) for contact_links, (updated_at, contact_link_id,
-- role) for contact_roles (no standalone id there; its composite PK is the
-- tie-break, and `role` sorts by the role_contexte enum's DECLARED order,
-- not lexicographically). A naive `ADD COLUMN ... BIGSERIAL` would instead
-- number rows in physical/insert order, which does not match either ordering
-- — hence the manual nullable-column + ROW_NUMBER() + sequence dance below.
--
-- Out of scope for this migration (tracked separately, not implemented here):
--   * apps/api/src/contacts/cursor.ts rewritten to a strict `syncSeq > cursor`
--     keyset (area:api / backend-specialist follow-up).
--   * docs/specs/FS-07-identity-vault.md VLT-08 cursor-mechanics wording
--     (area:specs follow-up).
--
-- Rollback note (forward-only migrations; no down-migration is executed —
-- this documents the manual revert path if ever needed):
--   DROP INDEX IF EXISTS "contact_links_owner_id_sync_seq_idx";
--   CREATE INDEX "contact_links_owner_id_updated_at_idx" ON "contact_links"("owner_id", "updated_at");
--   ALTER TABLE "contact_links" DROP COLUMN "sync_seq";
--   DROP SEQUENCE IF EXISTS "contact_links_sync_seq_seq";
--   DROP INDEX IF EXISTS "contact_roles_contact_link_id_sync_seq_idx";
--   CREATE INDEX "contact_roles_contact_link_id_updated_at_idx" ON "contact_roles"("contact_link_id", "updated_at");
--   ALTER TABLE "contact_roles" DROP COLUMN "sync_seq";
--   DROP SEQUENCE IF EXISTS "contact_roles_sync_seq_seq";

-- ============================================================================
-- contact_links
-- ============================================================================

-- 1. Add the column nullable, no default yet — a straight BIGSERIAL would
--    number existing rows in physical/insert order, not (updated_at, id).
ALTER TABLE "contact_links" ADD COLUMN "sync_seq" BIGINT;

-- 2. Backfill preserving the current (updated_at, id) relative order — the
--    same ordering `listContactsSince` already sorts by.
WITH ordered AS (
    SELECT "id", ROW_NUMBER() OVER (ORDER BY "updated_at" ASC, "id" ASC) AS rn
    FROM "contact_links"
)
UPDATE "contact_links" AS cl
SET "sync_seq" = ordered.rn
FROM ordered
WHERE cl."id" = ordered."id";

-- 3. Create the backing sequence and hand it off to the column so future
--    inserts continue past the highest backfilled value automatically.
CREATE SEQUENCE "contact_links_sync_seq_seq" OWNED BY "contact_links"."sync_seq";
SELECT setval('"contact_links_sync_seq_seq"', COALESCE((SELECT MAX("sync_seq") FROM "contact_links"), 0) + 1, false);
ALTER TABLE "contact_links" ALTER COLUMN "sync_seq" SET DEFAULT nextval('"contact_links_sync_seq_seq"');
ALTER TABLE "contact_links" ALTER COLUMN "sync_seq" SET NOT NULL;

-- 4. Swap the cursor index: syncSeq is now the strict keyset key (#168);
--    updated_at keeps display/CAS duty but is no longer the index lead.
DROP INDEX "contact_links_owner_id_updated_at_idx";
CREATE INDEX "contact_links_owner_id_sync_seq_idx" ON "contact_links"("owner_id", "sync_seq");

-- ============================================================================
-- contact_roles
-- ============================================================================

-- 1. Same treatment as contact_links.sync_seq above.
ALTER TABLE "contact_roles" ADD COLUMN "sync_seq" BIGINT;

-- 2. Backfill preserving (updated_at, contact_link_id, role) — this model has
--    no standalone id, so its composite PK is the tie-break. `role` orders by
--    the role_contexte enum's declared label order (family, partner,
--    colleague, cohort, community, neighbor), not lexicographically.
WITH ordered AS (
    SELECT "contact_link_id", "role",
           ROW_NUMBER() OVER (ORDER BY "updated_at" ASC, "contact_link_id" ASC, "role" ASC) AS rn
    FROM "contact_roles"
)
UPDATE "contact_roles" AS cr
SET "sync_seq" = ordered.rn
FROM ordered
WHERE cr."contact_link_id" = ordered."contact_link_id" AND cr."role" = ordered."role";

-- 3. Backing sequence, same pattern as contact_links.
CREATE SEQUENCE "contact_roles_sync_seq_seq" OWNED BY "contact_roles"."sync_seq";
SELECT setval('"contact_roles_sync_seq_seq"', COALESCE((SELECT MAX("sync_seq") FROM "contact_roles"), 0) + 1, false);
ALTER TABLE "contact_roles" ALTER COLUMN "sync_seq" SET DEFAULT nextval('"contact_roles_sync_seq_seq"');
ALTER TABLE "contact_roles" ALTER COLUMN "sync_seq" SET NOT NULL;

-- 4. Swap the cursor index, same rationale as contact_links above.
DROP INDEX "contact_roles_contact_link_id_updated_at_idx";
CREATE INDEX "contact_roles_contact_link_id_sync_seq_idx" ON "contact_roles"("contact_link_id", "sync_seq");
