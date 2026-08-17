/**
 * POC-ONLY in-memory OTP store (documented, deliberate):
 * - codes are stored as sha256 hashes, never plaintext, never logged;
 * - 5-minute TTL, single-use, max 5 verify attempts (IDT-03);
 * - per-phoneHash request throttle: max 3 codes per 5-minute window (IDT-03);
 * - phoneHashes live only as Map keys in process memory — never logged (G3);
 * - sweep() periodically drops expired codes and stale throttle windows, and
 *   a hard cap on tracked hashes denies new ones (fail-closed, existing codes
 *   stay live) once hit — defense-in-depth against unbounded memory growth
 *   from codes that are requested but never verified (SUG-API-008).
 *
 * Before production: SMS provider (OQ-IDT-1) + a shared store (Postgres/Redis)
 * so throttling survives restarts and multiple instances.
 */
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

const OTP_TTL_MS = 5 * 60_000;
const THROTTLE_WINDOW_MS = 5 * 60_000;
const MAX_REQUESTS_PER_WINDOW = 3;
const MAX_VERIFY_ATTEMPTS = 5;
const DEFAULT_MAX_TRACKED_HASHES = 100_000;

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

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxTrackedHashes: number = DEFAULT_MAX_TRACKED_HASHES,
  ) {}

  /** Test-only accessor — read-only, exposes Map sizes without leaking keys. */
  get trackedCount(): { codes: number; throttles: number } {
    return { codes: this.entries.size, throttles: this.requestLog.size };
  }

  request(phoneHash: string): OtpRequestResult {
    const t = this.now();
    const recent = (this.requestLog.get(phoneHash) ?? []).filter(
      (ts) => t - ts < THROTTLE_WINDOW_MS,
    );
    if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
      const oldest = recent[0] ?? t;
      return { ok: false, retryAfterMs: Math.max(0, oldest + THROTTLE_WINDOW_MS - t) };
    }

    // Defense-in-depth against unbounded growth (SUG-API-008): a hash that is
    // requested but never verified would otherwise live in `entries` forever.
    // Sweep once before denying — an attacker filling the cap with codes that
    // have since expired should not block legitimate new requests. Deny
    // rather than evict a live code at the cap (fail-closed).
    //
    // Only a hash we are not already tracking can grow the map; an existing
    // one overwrites its own row below, leaving `entries.size` unchanged. It
    // must therefore stay servable at the cap, or a user mid-sign-in who lost
    // their SMS could never get a second code while an attacker holds the cap.
    if (!this.entries.has(phoneHash) && this.entries.size >= this.maxTrackedHashes) {
      this.sweep();
      if (this.entries.size >= this.maxTrackedHashes) {
        return { ok: false, retryAfterMs: 60_000 };
      }
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

  /**
   * Drops expired codes and stale throttle windows (SUG-API-008). O(n) —
   * called periodically by the owner (apps/api/src/app.ts) and opportunistically
   * from request() when the tracked-hash cap is hit. Never logs phoneHash keys.
   */
  sweep(): void {
    const t = this.now();
    for (const [key, entry] of this.entries) {
      if (t > entry.expiresAt) this.entries.delete(key);
    }
    for (const [key, times] of this.requestLog) {
      const recent = times.filter((ts) => t - ts < THROTTLE_WINDOW_MS);
      if (recent.length === 0) this.requestLog.delete(key);
      else this.requestLog.set(key, recent);
    }
  }
}
