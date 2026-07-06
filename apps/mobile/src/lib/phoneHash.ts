/**
 * IDT-01 / IDT-06: phone numbers are salted and hashed ON-DEVICE; the raw
 * number never leaves the phone. The salt is a per-deployment namespace
 * shared by all clients (required for contact discovery), not a secret.
 */
import * as Crypto from 'expo-crypto';

// String(): process.env is untyped (any) under the Expo/RN type setup.
const SALT = String(process.env.EXPO_PUBLIC_PHONE_HASH_SALT ?? 'swab-poc-phone-salt-v1');

/** Best-effort E.164 normalization: keep a leading +, strip everything else. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/gu, '');
  return hasPlus ? `+${digits}` : digits;
}

export async function hashPhoneNumber(raw: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${SALT}:${normalizePhone(raw)}`,
  );
}
