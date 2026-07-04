/**
 * Minimal base64 codec over Uint8Array. Hand-rolled because Hermes does not
 * guarantee atob/btoa and we want zero extra dependencies for this.
 * Round-trip is property-tested (vault-crypto.property test).
 */
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0: number | undefined = bytes[i];
    const b1: number | undefined = bytes[i + 1];
    const b2: number | undefined = bytes[i + 2];
    const n0 = b0 ?? 0;
    out += ALPHABET.charAt(n0 >> 2);
    out += ALPHABET.charAt(((n0 & 0x03) << 4) | ((b1 ?? 0) >> 4));
    out += b1 === undefined ? '=' : ALPHABET.charAt(((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6));
    out += b2 === undefined ? '=' : ALPHABET.charAt(b2 & 0x3f);
  }
  return out;
}

export function fromBase64(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/u, '');
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) {
      continue; // ignore whitespace/invalid chars
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}
