/**
 * IDT-01/IDT-06 — phone numbers are salted and hashed ON-DEVICE. The raw
 * number must never be recoverable from what leaves the input handler.
 */
import { createHash } from 'node:crypto';

import { hashPhoneNumber, normalizePhone } from '../lib/phoneHash';

const SALT = 'swab-poc-phone-salt-v1'; // default when EXPO_PUBLIC_PHONE_HASH_SALT is unset

describe('IDT-06 normalizePhone', () => {
  it.each([
    ['+33 6 12 34 56 78', '+33612345678'],
    ['06 12 34 56 78', '0612345678'],
    ['+1 (555) 010-9999', '+15550109999'],
    ['  +212-600-000000  ', '+212600000000'],
    ['0612345678', '0612345678'],
  ])('normalizes %p to %p', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });
});

describe('IDT-06 hashPhoneNumber', () => {
  it('produces the salted SHA-256 of the normalized number', async () => {
    const expected = createHash('sha256')
      .update(`${SALT}:+33612345678`)
      .digest('hex');
    await expect(hashPhoneNumber('+33 6 12 34 56 78')).resolves.toBe(expected);
  });

  it('is stable across formatting variants of the same number', async () => {
    const a = await hashPhoneNumber('+33 6 12 34 56 78');
    const b = await hashPhoneNumber('+33612345678');
    expect(a).toBe(b);
  });

  it('never contains the raw digits (IDT-01: the number never leaves the phone)', async () => {
    const hash = await hashPhoneNumber('+33 6 12 34 56 78');
    expect(hash).toMatch(/^[0-9a-f]{64}$/u);
    expect(hash).not.toContain('0612345678');
    expect(hash).not.toContain('33612345678');
  });
});
