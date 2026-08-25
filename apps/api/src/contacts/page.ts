import type { ContactPage, ContactRecord } from "../repo.js";
import type { SyncCursor } from "./cursor.js";

/**
 * The paging tail of a delta pull, shared by BOTH `ContactsRepository`
 * implementations so they cannot disagree about when an id-bearing cursor is
 * emitted. Pure — no Prisma import, so the in-memory double stays usable with
 * no database in the process.
 *
 * `rows` holds up to `limit + 1` records (the extra one is the `hasMore` probe).
 * Which of the two cursor modes (see `cursor.ts`) is emitted depends on whether
 * the caller is mid-pull or has drained the tail:
 *
 *   - `hasMore` → an EXCLUSIVE, id-bearing cursor. An inclusive one would make
 *     the next page start at the row just delivered; with a small `limit` that
 *     re-delivers the same page forever and pagination never terminates.
 *   - drained → an INCLUSIVE cursor. This is where the boundary-millisecond
 *     hazard actually lives (a row updated after the cursor was issued but
 *     inside its millisecond), and re-sending beats skipping.
 */
export function pageFrom(
  rows: ContactRecord[],
  cursor: SyncCursor | null,
  limit: number,
): ContactPage {
  const contacts = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = contacts.at(-1);
  if (last === undefined) {
    // An empty page keeps the caller's cursor — resetting it to null would make
    // the next sync re-download everything.
    return { contacts, nextCursor: cursor, hasMore: false };
  }
  return {
    contacts,
    nextCursor: { updatedAt: last.updatedAt, afterId: hasMore ? last.id : null },
    hasMore,
  };
}
