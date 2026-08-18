-- SUG-DB-005 — Envie.verb was NOT NULL, which blocks the 30-day retention
-- null-out (data-steward rule 3: "expired envies are status-flipped
-- (auditable), but their verb content is nulled by the retention sweep after
-- 30 days"). Expired desires were stored in plaintext forever with no way to
-- comply. `category` (the matching key) is untouched and stays required.
--
-- Pure `DROP NOT NULL` — non-destructive, instant, no table rewrite, no data
-- migration (expand-phase safe). The sweep itself is separate area:sre/area:api
-- work: `UPDATE envies SET verb = NULL WHERE status = 'EXPIRED' AND expires_at
-- < now() - interval '30 days';`.

-- AlterTable
ALTER TABLE "envies" ALTER COLUMN "verb" DROP NOT NULL;
