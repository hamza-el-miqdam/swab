-- Clean up any orphaned envie_recipient rows (G1 / DAT rule 2: right-to-erasure).
-- This should be a no-op on fresh/dev branches; on production, identifies stale data.
DELETE FROM "envie_recipients" WHERE "recipient_id" NOT IN (SELECT "id" FROM "users");

-- AddForeignKey: envie_recipients.recipient_id → users.id (CASCADE on delete)
-- Enforces referential integrity: no recipient id can be orphaned.
-- Cascade behavior: when a user is deleted, their recipient rows are removed, shrinking
-- other users' recipient lists (the desired GDPR erasure semantics per DAT rule 2).
ALTER TABLE "envie_recipients" ADD CONSTRAINT "envie_recipients_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
