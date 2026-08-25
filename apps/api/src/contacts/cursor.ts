/**
 * Delta-pull cursor (VLT-08) — opaque to clients on purpose.
 *
 * A bare `updatedAt > since` cursor is unsafe here. `Timestamptz(3)` is
 * millisecond precision, and `updatedAt` is assigned when the write happens, so
 * a row updated *after* a cursor was issued can land in the very millisecond
 * that cursor names — and would then never be delivered again. Silent data loss
 * in a sync protocol is the one failure mode worth spending complexity on, so
 * this cursor is built to re-send rather than to skip:
 *
 *   - `afterId === null` (the normal case): the pull is INCLUSIVE of the
 *     cursor's millisecond. Rows written in that same millisecond come back
 *     once more; the client overwrites its cache with server state anyway
 *     (ADR-001: "on any disagreement the server's value is correct"), so a
 *     re-send is idempotent where a skip is not.
 *   - `afterId` set: emitted only when a page boundary falls *inside* one
 *     millisecond. It resumes by row id within that millisecond, so paging
 *     makes progress instead of looping on the same rows.
 *
 * The exact fix is a monotonic per-row sync sequence (`bigserial`), which would
 * make a strict keyset correct with no re-sends at all. That is a schema change
 * owned by the Data Steward — filed as an `area:db` follow-up, see the
 * changelog. This encoding is opaque so adopting it needs no client release.
 */

export interface SyncCursor {
  updatedAt: Date;
  /** `null` = re-scan `updatedAt`'s whole millisecond; set = resume after this id within it. */
  afterId: string | null;
}

/** `<epochMillis>.<id>`; the id half is empty for an inclusive cursor. */
const DECODED_RE = /^(\d{1,15})\.([A-Za-z0-9_-]{0,64})$/;
/** Bounded so a hostile value can never allocate: 15 digits + '.' + 64 id chars, base64url'd. */
export const MAX_CURSOR_LENGTH = 128;
const CURSOR_RE = /^[A-Za-z0-9_-]{1,128}$/;

export function encodeCursor(cursor: SyncCursor): string {
  return Buffer.from(`${cursor.updatedAt.getTime()}.${cursor.afterId ?? ""}`, "utf8").toString(
    "base64url",
  );
}

/** `null` for any malformed value — the caller turns that into a 400, never a silent full re-sync. */
export function decodeCursor(raw: string): SyncCursor | null {
  if (!CURSOR_RE.test(raw)) return null;
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  const match = DECODED_RE.exec(decoded);
  if (match === null) return null;
  const millis = Number(match[1]);
  if (!Number.isSafeInteger(millis)) return null;
  const updatedAt = new Date(millis);
  if (Number.isNaN(updatedAt.getTime())) return null;
  const afterId = match[2] as string;
  return { updatedAt, afterId: afterId === "" ? null : afterId };
}
