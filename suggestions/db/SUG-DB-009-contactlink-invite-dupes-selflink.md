# SUG-DB-009 — ContactLink allows duplicate pending invites, self-links, and stale invitedPhoneHash after resolution

- **Area:** db
- **Topic:** integrity
- **Impact:** medium
- **Effort:** S
- **Implementing agent:** data-steward (.claude/agents/data-steward.md)
- **Related requirement IDs:** IDT-07, IDT-08

## Problem / Opportunity

Three related gaps in `ContactLink` (`packages/db/prisma/schema.prisma:56–70`):

1. **Duplicate pending invites.** `@@unique([ownerId, targetId])` (schema.prisma:66) is the only uniqueness arbiter, but Postgres unique indexes treat NULLs as distinct — every pending invite has `targetId = NULL` (schema.prisma:60, "null until the invited person joins"), so one owner can hold unlimited duplicate rows for the same `invitedPhoneHash`. When the invitee joins and IDT-07 resolution sets `targetId` on all of them, the second update then violates `(ownerId, targetId)` — resolution code inherits a landmine.
2. **Self-links.** Nothing prevents `ownerId = targetId` (or inviting your own phoneHash). A self-edge pollutes discovery and, worse, the future matching path (a user could "match with themselves" if recipient resolution ever includes a self-link).
3. **Stale discovery handle.** `invitedPhoneHash` is documented as a "discovery handle while target is null" (schema.prisma:62), but nothing enforces clearing it once `targetId` is set — the hash then lingers as a redundant, retention-unfriendly copy of the joined user's identity handle (the same class of data `User.phoneHash` confines to one unique column, schema.prisma:16).

## Implementation plan

1. In `schema.prisma`, model `ContactLink`, add:
   ```prisma
   @@unique([ownerId, invitedPhoneHash]) // one pending invite per (owner, phone) — IDT-07 resolution updates exactly one row
   ```
   (NULL `invitedPhoneHash` rows — resolved links — are exempt because NULLs are distinct, which is exactly right here.)
2. Add CHECK constraints via a customized migration (`prisma migrate dev --create-only --name contact_link_integrity`, then append):
   ```sql
   ALTER TABLE "contact_links"
     ADD CONSTRAINT "contact_links_no_self" CHECK ("owner_id" IS DISTINCT FROM "target_id"),
     ADD CONSTRAINT "contact_links_resolved_or_pending"
       CHECK ("target_id" IS NOT NULL OR "invited_phone_hash" IS NOT NULL);
   ```
   The second CHECK also kills the fully-orphaned row shape (both NULL) that `onDelete: SetNull` on `target` (schema.prisma:61) can currently produce with no way to ever re-resolve it.
3. Document the resolution contract in a `///` comment: setting `targetId` MUST clear `invitedPhoneHash` in the same update (single `UPDATE ... SET target_id = $1, invited_phone_hash = NULL`). A full DB-level enforcement (`CHECK (target_id IS NULL OR invited_phone_hash IS NULL)`) conflicts with the SetNull path in step 2 — choose the pair of CHECKs above and enforce clearing in the API layer; note it for Backend in the PR.
4. Seed already conforms (`packages/db/prisma/seed.ts:74–93`: distinct-user edges, one pending invite with a hash) — no change.
5. Changelog entry citing IDT-07/IDT-08; note the drift-check caveat for CHECKs (same as SUG-DB-003).

## Tests & acceptance criteria

- Constraint tests (SUG-DB-004 harness): duplicate `(ownerId, invitedPhoneHash)` insert rejects; `ownerId = targetId` insert rejects; insert with both `targetId` and `invitedPhoneHash` NULL rejects; two pending invites to *different* hashes from one owner still succeed.
- Regression shape for the SetNull path: delete a target user; assert their inbound links are deleted or still satisfy the CHECK (they will violate `resolved_or_pending` if `invitedPhoneHash` was cleared at resolution — see gotcha below).
- `prisma validate` + turbo gate green.

## Risks & gotchas

- **Design decision needed on user deletion:** with `invitedPhoneHash` cleared at resolution, `onDelete: SetNull` on `target` produces exactly the both-NULL rows the CHECK forbids — the deletion would fail. Recommend changing `target` to `onDelete: Cascade` in the same PR (the counterpart's edge dies with the account; IDT-08 links are directional and private, and a dangling "linked to nobody, no handle" row has no product meaning). If product wants to preserve the owner's roster slot, drop the second CHECK instead — decide explicitly, don't ship the conflict.
- CHECK constraints live only in migration SQL (Prisma can't model them) — same CI drift-check verification as SUG-DB-003.
- Apply after SUG-DB-002's baseline to keep one concern per migration.
