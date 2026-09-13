-- PR #171 review finding — restore the (ownerId, updatedAt) / (contactLinkId,
-- updatedAt) indexes that `20260830000000_monotonic_sync_sequence` dropped.
--
-- That migration replaced these indexes with (ownerId/contactLinkId, syncSeq)
-- on the assumption the cursor pull already reads syncSeq. It doesn't yet:
-- `apps/api/src/prisma-contacts-repo.ts`'s `listContactsSince` (the LIVE
-- `GET /contacts` handler) still sorts `ORDER BY updated_at ASC, id ASC` —
-- `cursor.ts`'s rewrite onto syncSeq keyset is a separate area:api follow-up
-- (#168) that has not shipped. Without this index, that live query's plan
-- regresses to a filter + sort/seqscan today.
--
-- Both index pairs now coexist: syncSeq indexes stay in place (they are the
-- future keyset key), and the updatedAt indexes come back for the current
-- live handler. `updatedAt` itself was never removed from either model — it
-- keeps its display + VLT-09 CAS role regardless.
--
-- This migration is additive only: no column change, no backfill. The
-- updatedAt indexes get dropped for real once the cursor.ts rewrite ships
-- and the live handler no longer needs them — that follow-up PR's job, not
-- this one's.

CREATE INDEX "contact_links_owner_id_updated_at_idx" ON "contact_links"("owner_id", "updated_at");

CREATE INDEX "contact_roles_contact_link_id_updated_at_idx" ON "contact_roles"("contact_link_id", "updated_at");
