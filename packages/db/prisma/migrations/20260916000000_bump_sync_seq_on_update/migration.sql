-- #196 (VLT-08 follow-up, Phase 3a.0 unblocker) — sync_seq advances on UPDATE.
--
-- `20260830000000_monotonic_sync_sequence` gave `contact_links`/`contact_roles`
-- a `sync_seq BIGINT DEFAULT nextval(...)` column, and
-- `20260905055452_filter_rule_schema` gave `filter_rules` the same shape via
-- `BIGSERIAL`. In all three cases the default only fires on INSERT — Postgres
-- has no concept of "re-run the column default on UPDATE". Every real write
-- to these tables today is an UPDATE (contact patch/tombstone, role
-- revive/tombstone, parent bump on role writes, any filter-rule edit), so
-- `sync_seq` has been silently frozen at its insert-time value since #168
-- landed. This was flagged while scoping #189 (delta-pull cursor -> syncSeq),
-- which cannot switch the cursor predicate to `syncSeq > cursor` until this
-- lands: an UPDATE that doesn't bump `sync_seq` would be invisible to a
-- keyset pull keyed on it.
--
-- Fix: one reusable, vanilla-Postgres trigger function, `bump_sync_seq()`,
-- attached as `BEFORE UPDATE FOR EACH ROW` on each of the three tables. It
-- takes the table's backing sequence name as a trigger argument (`TG_ARGV[0]`)
-- so the same function body serves all three (and future tables adopting
-- `sync_seq` from their first migration, per #196's issue body: #185, #166,
-- #170, #183). No extension, no Neon-specific SQL — `CREATE FUNCTION` /
-- `CREATE TRIGGER` with plain `plpgsql`, portable to any Postgres (AWS
-- portability requirement).
--
-- Why a trigger argument instead of three separate functions: the three
-- tables' backing sequences have different names
-- (`contact_links_sync_seq_seq`, `contact_roles_sync_seq_seq`,
-- `filter_rules_sync_seq_seq` — the last one Postgres's own `BIGSERIAL`
-- default-named), and a trigger function has no generic way to derive "my
-- own column's sequence" from `NEW` alone. Passing the sequence name at
-- `CREATE TRIGGER` time keeps the function body table-agnostic.
--
-- What this does NOT change: INSERT behaviour (the existing
-- `DEFAULT nextval(...)` still fires there — this trigger only fires on
-- UPDATE, so it never double-bumps a freshly inserted row), `updated_at`
-- (unchanged, still display + VLT-09 CAS), or any column shape. Out of
-- scope, tracked separately: `apps/api/src/contacts/cursor.ts`'s rewrite to
-- a strict `syncSeq > cursor` keyset (#189, `area:api`); the residual
-- "commit order != allocation order" gap from `nextval` being taken
-- pre-commit (#189 already documents this as pre-existing and
-- non-regressing).
--
-- Rollback note (forward-only migrations; no down-migration is executed —
-- this documents the manual revert path if ever needed):
--   DROP TRIGGER IF EXISTS "contact_links_bump_sync_seq" ON "contact_links";
--   DROP TRIGGER IF EXISTS "contact_roles_bump_sync_seq" ON "contact_roles";
--   DROP TRIGGER IF EXISTS "filter_rules_bump_sync_seq" ON "filter_rules";
--   DROP FUNCTION IF EXISTS bump_sync_seq();

-- ============================================================================
-- Reusable trigger function
-- ============================================================================

CREATE FUNCTION bump_sync_seq() RETURNS trigger AS $$
BEGIN
    NEW.sync_seq := nextval(TG_ARGV[0]);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Attach per table
-- ============================================================================

CREATE TRIGGER "contact_links_bump_sync_seq"
    BEFORE UPDATE ON "contact_links"
    FOR EACH ROW
    EXECUTE FUNCTION bump_sync_seq('contact_links_sync_seq_seq');

CREATE TRIGGER "contact_roles_bump_sync_seq"
    BEFORE UPDATE ON "contact_roles"
    FOR EACH ROW
    EXECUTE FUNCTION bump_sync_seq('contact_roles_sync_seq_seq');

CREATE TRIGGER "filter_rules_bump_sync_seq"
    BEFORE UPDATE ON "filter_rules"
    FOR EACH ROW
    EXECUTE FUNCTION bump_sync_seq('filter_rules_sync_seq_seq');
