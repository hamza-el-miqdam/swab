/**
 * POC-ONLY in-memory OTP store (documented, deliberate):
 * - codes are stored as sha256 hashes, never plaintext, never logged;
 * - 5-minute TTL, single-use, max 5 verify attempts (IDT-03);
 * - per-phoneHash request throttle: max 3 codes per 5-minute window (IDT-03);
 * - phoneHashes live only as Map keys in process memory — never logged (G3).
 *
 * Before production: SMS provider (OQ-IDT-1) + a shared store (Postgres/Redis)
 * so throttling survives restarts and multiple instances.
 */
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

const OTP_TTL_MS = 5 * 60_000;
const THROTTLE_WINDOW_MS = 5 * 60_000;
const MAX_REQUESTS_PER_WINDOW = 3;
const MAX_VERIFY_ATTEMPTS = 5;

export const OTP_TTL_SECONDS = OTP_TTL_MS / 1000;

interface OtpEntry {
  codeHash: Buffer;
  expiresAt: number;
  attempts: number;
}

export type OtpRequestResult =
  | { ok: true; code: string }
  | { ok: false; retryAfterMs: number };

function hashCode(phoneHash: string, code: string): Buffer {
  return createHash("sha256").update(`${phoneHash}:${code}`).digest();
}

export class OtpStore {
  private readonly entries = new Map<string, OtpEntry>();
  private readonly requestLog = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  request(phoneHash: string): OtpRequestResult {
    const t = this.now();
    const recent = (this.requestLog.get(phoneHash) ?? []).filter(
      (ts) => t - ts < THROTTLE_WINDOW_MS,
    );
    if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
      const oldest = recent[0] ?? t;
      return { ok: false, retryAfterMs: Math.max(0, oldest + THROTTLE_WINDOW_MS - t) };
    }
    recent.push(t);
    this.requestLog.set(phoneHash, recent);

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    this.entries.set(phoneHash, {
      codeHash: hashCode(phoneHash, code),
      expiresAt: t + OTP_TTL_MS,
      attempts: 0,
    });
    return { ok: true, code };
  }

  /**
   * Validates a code without consuming it (attempts still count), so a
   * semantically incomplete request (e.g. missing displayName → 422) does not
   * burn the code. Call consume() once the sign-in fully succeeds.
   */
  check(phoneHash: string, code: string): boolean {
    const entry = this.entries.get(phoneHash);
    if (entry === undefined) return false;
    const t = this.now();
    if (t > entry.expiresAt) {
      this.entries.delete(phoneHash);
      return false;
    }
    entry.attempts += 1;
    if (entry.attempts > MAX_VERIFY_ATTEMPTS) {
      this.entries.delete(phoneHash);
      return false;
    }
    const candidate = hashCode(phoneHash, code);
    return timingSafeEqual(candidate, entry.codeHash);
  }

  /** Single-use guarantee (IDT-03): removes the code after a successful sign-in. */
  consume(phoneHash: string): void {
    this.entries.delete(phoneHash);
  }
}
