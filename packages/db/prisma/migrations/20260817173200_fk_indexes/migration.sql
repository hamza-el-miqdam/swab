-- SUG-DB-007 — index every unindexed FK column. Postgres does not auto-index
-- FK-referencing columns, and Prisma only creates what's declared — these six
-- columns were behind real query patterns and every one of them also backs a
-- deletion cascade (account deletion touches 7 tables and must never
-- sequential-scan). Pure additive index creation: non-destructive, no data
-- migration, safe to apply to a live database.

-- Device.userId — push-notification fanout (IDT-05) + deletion cascade.
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

-- Envie.authorId — "my active envies" listing with withdraw (ENV-06); the
-- existing (category, status, expires_at) index does not cover author lookups.
CREATE INDEX "envies_author_id_status_idx" ON "envies"("author_id", "status");

-- Match.userAId / userBId — GET /matches is WHERE user_a_id = ? OR user_b_id = ?;
-- both sides need their own index, and both back a deletion cascade.
CREATE INDEX "matches_user_a_id_idx" ON "matches"("user_a_id");
CREATE INDEX "matches_user_b_id_idx" ON "matches"("user_b_id");

-- Match.envieBId — the (envie_a_id, envie_b_id) unique only leads with
-- envieAId; envie deletion via the envieB relation still scans without this.
CREATE INDEX "matches_envie_b_id_idx" ON "matches"("envie_b_id");

-- Proposal.matchId / proposerId — proposals-for-match reads (ENV-14) + both
-- deletion cascades. Proposal had zero indexes beyond its primary key.
CREATE INDEX "proposals_match_id_idx" ON "proposals"("match_id");
CREATE INDEX "proposals_proposer_id_idx" ON "proposals"("proposer_id");

-- ContactLink.targetId — the onDelete: SetNull scan on user deletion, and
-- "who links to me" resolution when a pending invite attaches (IDT-07). The
-- partial unique on (owner_id, target_id) only leads with ownerId.
CREATE INDEX "contact_links_target_id_idx" ON "contact_links"("target_id");
