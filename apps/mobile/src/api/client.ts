/**
 * Fetch-based API seam (packages/api-client will replace this later —
 * consume-only per the mobile agent scope).
 *
 * PRIVACY INVARIANT (ONB-05 / G1 / mobile rule 2): the ONLY user-data shapes
 * this module can send are `phoneHash`, `code`, `displayName`, and the opaque
 * encrypted vault `{ blob, version }`. There is deliberately NO type here for
 * rings, roles, état, ressenti, scope names, or filter reasons — if you need
 * to add one, stop: you are breaking the product's core promise.
 */
import { getAccessToken } from '../lib/session';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function buildHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return {
    'content-type': 'application/json',
    ...(token !== null ? { authorization: `Bearer ${token}` } : {}),
  };
}

// --- Auth (FS-07 IDT-01..03) -----------------------------------------------

export interface OtpRequestBody {
  phoneHash: string;
}

export async function requestOtp(body: OtpRequestBody): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/otp/request`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(res.status, 'otp request failed');
  }
}

export interface OtpVerifyBody {
  phoneHash: string;
  code: string;
  displayName?: string;
}

export interface OtpVerifyResponse {
  accessToken: string;
  refreshToken: string;
}

export async function verifyOtp(body: OtpVerifyBody): Promise<OtpVerifyResponse> {
  const res = await fetch(`${BASE_URL}/auth/otp/verify`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(res.status, 'otp verify failed');
  }
  return (await res.json()) as OtpVerifyResponse;
}

// --- Vault (FS-07 VLT-02): opaque blob only --------------------------------

export interface EncryptedVaultBlob {
  /** base64 AES-256-GCM ciphertext — the server can never read it. */
  blob: string;
  version: number;
}

export type VaultPushResult =
  | { ok: true; version: number }
  | { ok: false; reason: 'conflict' };

export async function pushVault(body: EncryptedVaultBlob): Promise<VaultPushResult> {
  const res = await fetch(`${BASE_URL}/vault`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    return { ok: false, reason: 'conflict' };
  }
  if (!res.ok) {
    throw new ApiError(res.status, 'vault push failed');
  }
  const parsed = (await res.json()) as { version: number };
  return { ok: true, version: parsed.version };
}

export async function getVault(): Promise<EncryptedVaultBlob | null> {
  const res = await fetch(`${BASE_URL}/vault`, {
    method: 'GET',
    headers: await buildHeaders(),
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new ApiError(res.status, 'vault fetch failed');
  }
  return (await res.json()) as EncryptedVaultBlob;
}
