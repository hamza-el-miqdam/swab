-- SUG-DB-013 — cap every unbounded `text` column that the API contract already
-- bounds, as defense in depth (IDT-01). Values chosen to match/lead the API:
--
--   users.phone_hash    varchar(128) — API accepts 32-128 chars (auth.ts)
--   users.display_name  varchar(50)  — API caps at 50 (auth.ts), matches the
--                                      cap already on contact_links.display_name
--   envies.verb         varchar(200) — ENV-17 (FS-05-envie-match.md) states
--                                      `verb` <= 200 chars; the DB mirrors the
--                                      spec exactly. ENV-01 implies no other
--                                      limit. No envie route exists yet, so the
--                                      spec — not this migration — is the source.
--   envies.category      varchar(64) — matching-key index column; caps btree bloat
--   proposals.place      varchar(200) — free-form but bounded in reality
--   devices.push_token   varchar(4096) — APNs/FCM tokens are far under this
--
-- Narrowing (data-specialist.md:21): safe pre-launch — only synthetic seed
-- data exists today and every value is already well under these caps. Postgres
-- validates existing rows against the new length on ALTER COLUMN ... TYPE, so
-- this migration itself is the safety check.

ALTER TABLE "users" ALTER COLUMN "phone_hash" TYPE VARCHAR(128);
ALTER TABLE "users" ALTER COLUMN "display_name" TYPE VARCHAR(50);
ALTER TABLE "envies" ALTER COLUMN "verb" TYPE VARCHAR(200);
ALTER TABLE "envies" ALTER COLUMN "category" TYPE VARCHAR(64);
ALTER TABLE "proposals" ALTER COLUMN "place" TYPE VARCHAR(200);
ALTER TABLE "devices" ALTER COLUMN "push_token" TYPE VARCHAR(4096);
