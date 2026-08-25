/**
 * The sync cursor is client input (G1), so its decoder is a validation
 * boundary, not a convenience. Table-driven, per G2 for pure logic.
 */
import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../src/contacts/cursor.js";

describe("sync cursor (VLT-08)", () => {
  it("VLT08 round-trips both modes without losing millisecond precision", async () => {
    const updatedAt = new Date("2026-08-22T19:04:05.123Z");
    for (const afterId of [null, "clx0000000000000000000000"]) {
      expect(decodeCursor(encodeCursor({ updatedAt, afterId }))).toEqual({ updatedAt, afterId });
    }
  });

  it("VLT08 rejects every malformed cursor rather than degrading to a full re-sync", async () => {
    const b64 = (raw: string): string => Buffer.from(raw, "utf8").toString("base64url");
    const cases: [string, string][] = [
      ["not base64url at all", "not valid base64url!!"],
      ["over the length bound", "a".repeat(129)],
      ["not <millis>.<id>", b64("no-dot-here")],
      ["non-numeric millis", b64("abc.contact_1")],
      ["millis beyond a safe integer", b64("9999999999999999.x")],
      ["id outside the allowed charset", b64("1755890000000.has space")],
      ["empty", ""],
    ];
    for (const [label, raw] of cases) {
      expect(decodeCursor(raw), label).toBeNull();
    }
  });
});
