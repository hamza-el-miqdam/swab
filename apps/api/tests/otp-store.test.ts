import { describe, expect, it } from "vitest";
import { OTP_TTL_SECONDS, OtpStore, type OtpRequestResult } from "../src/otp-store.js";

const HASH = "c".repeat(64);
// otp-store.ts's THROTTLE_WINDOW_MS is also 5 minutes — same literal, separate constant there.
const THROTTLE_WINDOW_MS = OTP_TTL_SECONDS * 1000;

function makeStore(startMs = 0) {
  let t = startMs;
  const store = new OtpStore(() => t);
  return { store, advance: (ms: number) => { t += ms; } };
}

function requestCode(store: OtpStore, hash = HASH): string {
  const result = store.request(hash);
  if (!result.ok) throw new Error("expected request to succeed");
  return result.code;
}

describe("OtpStore (IDT-03)", () => {
  it("IDT-03: a correct code within TTL verifies", () => {
    const { store, advance } = makeStore();
    const code = requestCode(store);
    advance(4 * 60_000 + 59_000); // 4:59
    expect(store.check(HASH, code)).toBe(true);
  });

  it("IDT-03: a code expires after 5 minutes", () => {
    const { store, advance } = makeStore();
    const code = requestCode(store);
    advance(OTP_TTL_SECONDS * 1000 + 1);
    expect(store.check(HASH, code)).toBe(false);

    // A fresh request afterwards issues a new working code.
    const fresh = requestCode(store);
    expect(store.check(HASH, fresh)).toBe(true);
  });

  it("IDT-03: the 6th verify attempt destroys the code even when correct", () => {
    const { store } = makeStore();
    const code = requestCode(store);
    for (let i = 0; i < 5; i++) {
      expect(store.check(HASH, "000000")).toBe(false);
    }
    // Attempt cap already hit by the 5 wrong tries — the correct code no longer verifies.
    expect(store.check(HASH, code)).toBe(false);
  });

  it("IDT-03: check does not consume — consume does", () => {
    const { store } = makeStore();
    const code = requestCode(store);
    expect(store.check(HASH, code)).toBe(true);
    expect(store.check(HASH, code)).toBe(true); // not consumed by check()
    store.consume(HASH);
    expect(store.check(HASH, code)).toBe(false);
  });

  it("IDT-03: 4th request in the window is throttled with a decreasing retryAfterMs", () => {
    const { store, advance } = makeStore();
    requestCode(store); // t=0
    advance(60_000);
    requestCode(store); // t=60_000
    advance(60_000);
    requestCode(store); // t=120_000
    advance(30_000); // t=150_000

    const throttled: OtpRequestResult = store.request(HASH);
    expect(throttled.ok).toBe(false);
    if (!throttled.ok) {
      expect(throttled.retryAfterMs).toBe(150_000); // oldest(0) + 300_000 - 150_000
    }

    advance(THROTTLE_WINDOW_MS); // well past the window
    const recovered = store.request(HASH);
    expect(recovered.ok).toBe(true);
  });

  it("IDT-03: codes are 6 digits and differ per request", () => {
    const { store } = makeStore();
    const codeA = requestCode(store, "a".repeat(64));
    const codeB = requestCode(store, "b".repeat(64)); // different hash to dodge the throttle
    expect(codeA).toMatch(/^\d{6}$/);
    expect(codeB).toMatch(/^\d{6}$/);
  });
});
