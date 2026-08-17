-- SUG-DB-003 — canonical-order arbiter for the reciprocal match pair (ENV-09).
--
-- `matches_envie_a_id_envie_b_id_key` only blocks re-inserting the exact same
-- ordered pair. The reversed pair (envieBId, envieAId) satisfies it too, so
-- two concurrent transactions that each detect the same reciprocal envies —
-- one inserting (E1, E2), the other (E2, E1) — both succeed and ENV-09
-- ("exactly one match per envie pair, ever") breaks.
--
-- Canonical order removes the second ordering entirely: every match's
-- envieAId must be lexicographically smaller than its envieBId, so both
-- transactions above are forced onto the *same* row and the existing unique
-- constraint arbitrates the race as originally intended. Backend must sort
-- the pair (and map users/vault authors accordingly) before insert.
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_pair_canonical_order" CHECK ("envie_a_id" < "envie_b_id");
