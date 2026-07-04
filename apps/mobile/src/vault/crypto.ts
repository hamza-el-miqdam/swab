/**
 * Vault encryption — DECISION RECORD (VLT-01, ONB-02)
 *
 * Primitive: AES-256-GCM via `react-native-quick-crypto` (JSI, node:crypto-
 * compatible API), key held in the OS keychain via `expo-secure-store`.
 *
 * Why this and not something else:
 *  - `expo-crypto` only exposes digests + random bytes — no AEAD. A digest-
 *    based stream cipher would be homemade crypto; rejected outright.
 *  - SQLCipher (encrypt-at-rest) protects the file but not the sync blob;
 *    the server must receive ciphertext, so we need an in-process AEAD anyway.
 *  - `react-native-quick-crypto` is a real, audited-primitive binding
 *    (OpenSSL/BoringSSL under the hood). It autolinks in the managed workflow
 *    via `expo prebuild` / a dev client — it does NOT run in Expo Go. That is
 *    the honest trade-off and it is accepted: the vault is the product.
 *
 * In Jest, jest.config.js maps this import to node:crypto (same API), so the
 * round-trip property test exercises genuine AES-256-GCM.
 *
 * Wire format: base64( IV(12) || AUTH_TAG(16) || CIPHERTEXT ).
 */
import * as SecureStore from 'expo-secure-store';
import QuickCrypto from 'react-native-quick-crypto';

import { fromBase64, toBase64 } from '../lib/base64';

const VAULT_KEY_STORE_ID = 'swab.vault.key.v1';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * ONB-02: called right after OTP verification, before any classification
 * input is possible. Key never leaves the device (recovery phrase backup is
 * FS-07 OQ-IDT-2, out of onboarding scope).
 */
export async function getOrCreateVaultKey(): Promise<Uint8Array> {
  const existing = await SecureStore.getItemAsync(VAULT_KEY_STORE_ID);
  if (existing !== null) {
    return fromBase64(existing);
  }
  const key = new Uint8Array(QuickCrypto.randomBytes(32));
  await SecureStore.setItemAsync(VAULT_KEY_STORE_ID, toBase64(key));
  return key;
}

export function encryptVault(plaintext: string, key: Uint8Array): string {
  const iv = new Uint8Array(QuickCrypto.randomBytes(IV_LENGTH));
  const cipher = QuickCrypto.createCipheriv('aes-256-gcm', key, iv);
  const head = new Uint8Array(cipher.update(plaintext, 'utf8'));
  const tail = new Uint8Array(cipher.final());
  const tag = new Uint8Array(cipher.getAuthTag());
  return toBase64(concatBytes(iv, tag, head, tail));
}

export function decryptVault(payloadB64: string, key: Uint8Array): string {
  const payload = fromBase64(payloadB64);
  const iv = payload.slice(0, IV_LENGTH);
  const tag = payload.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = payload.slice(IV_LENGTH + TAG_LENGTH);
  const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  // Single update call, so utf8 chunk boundaries cannot split a code point.
  return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
}
