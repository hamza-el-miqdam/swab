-- SUG-DB-006 — per-side PASSED for Match (ENV-15).
--
-- A single shared `state` column cannot record who passed without leaking it
-- to the counterpart, and it destroys the pre-pass state. Replaces the shared
-- PASSED value with two private per-side timestamps: `passed_by_a_at` /
-- `passed_by_b_at`. A side's view state is
-- `passed_by_<side>_at IS NOT NULL ? PASSED : state`; the counterpart's
-- responses are computed from `state` alone and must never select the
-- passed_by_* columns (that is the privacy contract, not a DB constraint).
--
-- No production writer for Match exists yet (matching isn't implemented in
-- apps/api), so no row can hold state = 'PASSED' today — this is a clean
-- enum-value removal, not an expand/migrate/contract across releases.

-- AlterEnum: Postgres has no DROP VALUE, so recreate the type without PASSED.
ALTER TYPE "match_state" RENAME TO "match_state_old";
CREATE TYPE "match_state" AS ENUM ('OPEN', 'PROPOSED', 'SCHEDULED', 'EXPIRED');
ALTER TABLE "matches" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "matches" ALTER COLUMN "state" TYPE "match_state" USING ("state"::text::"match_state");
ALTER TABLE "matches" ALTER COLUMN "state" SET DEFAULT 'OPEN';
DROP TYPE "match_state_old";

-- AlterTable
ALTER TABLE "matches" ADD COLUMN "passed_by_a_at" TIMESTAMPTZ(3),
ADD COLUMN "passed_by_b_at" TIMESTAMPTZ(3);
