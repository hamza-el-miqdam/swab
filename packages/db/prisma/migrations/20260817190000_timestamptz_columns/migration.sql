-- SUG-DB-008 — convert every pre-existing DateTime column from `timestamp`
-- (no time zone) to `timestamptz(3)`. ADR-001's new sync/classification
-- columns already shipped as timestamptz; this closes the gap its own
-- changelog entry flagged. `Envie.expiresAt` drives matching (ENV-08) and the
-- expiry sweep — comparing a naive column against `now()` is only correct
-- while every writer/session agrees on UTC, and AWS portability (RDS/Aurora
-- default TimeZone varies) is a hard requirement.
--
-- Pure type change, no data loss: Postgres reinterprets each naive value using
-- the session time zone at ALTER time. Only seed data exists today and it is
-- explicit UTC, so this is lossless in every environment that matters before
-- real data exists (do this before real data exists, not after).

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "vaults" ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "devices" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "contact_links" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "envies" ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ(3),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "envie_recipients" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "matches" ALTER COLUMN "notified_at" TYPE TIMESTAMPTZ(3),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "proposals" ALTER COLUMN "timeslot" TYPE TIMESTAMPTZ(3),
ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3);
