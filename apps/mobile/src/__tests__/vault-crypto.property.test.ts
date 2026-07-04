/**
 * VLT-01 — vault crypto round-trip property test (mobile agent rule 7):
 * for ALL strings (unicode included), decrypt(encrypt(x)) === x, ciphertexts
 * are non-deterministic (fresh IV), and tampering fails loudly.
 */
import fc from 'fast-check';
import { randomBytes } from 'node:crypto';

import { decryptVault, encryptVault } from '../vault/crypto';

describe('VLT-01 AES-256-GCM vault round-trip', () => {
  const key = new Uint8Array(randomBytes(32));

  it('round-trips arbitrary unicode payloads', () => {
    fc.assert(
      fc.property(fc.fullUnicodeString({ maxLength: 2000 }), (plaintext) => {
        expect(decryptVault(encryptVault(plaintext, key), key)).toBe(plaintext);
      }),
      { numRuns: 200 },
    );
  });

  it('never emits the same ciphertext twice (fresh IV per encryption)', () => {
    const payload = JSON.stringify({ contacts: [{ displayName: 'Léa', ring: 1 }] });
    expect(encryptVault(payload, key)).not.toBe(encryptVault(payload, key));
  });

  it('rejects tampered ciphertext (GCM auth)', () => {
    const blob = encryptVault('sensible', key);
    const tampered = `${blob.slice(0, -4)}AAAA`;
    expect(() => decryptVault(tampered, key)).toThrow();
  });

  it('rejects the wrong key', () => {
    const blob = encryptVault('sensible', key);
    const otherKey = new Uint8Array(randomBytes(32));
    expect(() => decryptVault(blob, otherKey)).toThrow();
  });
});
