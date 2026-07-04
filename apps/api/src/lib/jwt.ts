/**
 * Minimal HS256 JWT (node:crypto only — no heavy auth deps for the walking
 * skeleton). IDT-02: short-lived access + longer refresh tokens; refresh
 * rotation/reuse-detection lands with the Device model wiring.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type TokenType = "access" | "refresh";

export interface JwtPayload {
  sub: string;
  type: TokenType;
  iat: number;
  exp: number;
}

function hmac(input: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(input).digest();
}

export function signJwt(
  claims: { sub: string; type: TokenType },
  secret: string,
  ttlSeconds: number,
): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = { ...claims, iat: now, exp: now + ttlSeconds };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = hmac(`${header}.${body}`, secret).toString("base64url");
  return `${header}.${body}.${signature}`;
}

function isJwtPayload(value: unknown): value is JwtPayload {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.sub === "string" &&
    (p.type === "access" || p.type === "refresh") &&
    typeof p.iat === "number" &&
    typeof p.exp === "number"
  );
}

/** Returns the payload for a well-formed, correctly signed, unexpired token — else null. */
export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  if (header === undefined || body === undefined || signature === undefined) return null;

  const expected = hmac(`${header}.${body}`, secret);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const payload: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!isJwtPayload(payload)) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
