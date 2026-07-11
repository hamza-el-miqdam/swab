// Generates docs/migration/vault-test-vectors.json — cross-platform crypto vectors
// replicating apps/mobile/src/vault/crypto.ts (AES-256-GCM, base64(IV||TAG||CT))
// and src/lib/phoneHash.ts (sha256("SALT:E164"), lowercase hex).
// node:crypto is API-identical to react-native-quick-crypto (the RN Jest suite
// maps the import to node:crypto), so these vectors ARE the reference behavior.
import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const IV_LENGTH = 12;

function encryptVault(plaintext, key, iv) {
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const head = cipher.update(plaintext, 'utf8');
  const tail = cipher.final();
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, head, tail]).toString('base64');
}

function decryptVault(payloadB64, key) {
  const payload = Buffer.from(payloadB64, 'base64');
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ct = payload.subarray(IV_LENGTH + 16);
  const d = createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return d.update(ct, undefined, 'utf8') + d.final('utf8');
}

function normalizePhone(raw) {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/gu, '');
  return hasPlus ? `+${digits}` : digits;
}

const SALT = 'swab-poc-phone-salt-v1';
const hashPhone = (raw) =>
  createHash('sha256').update(`${SALT}:${normalizePhone(raw)}`, 'utf8').digest('hex');

// Deterministic key/IV material (test-only; production always uses fresh randoms).
const bytes = (n, start) => Buffer.from(Array.from({ length: n }, (_, i) => (start + i * 7) % 256));

const vaultCases = [
  {
    name: 'empty-vault',
    plaintext: JSON.stringify({ contacts: [] }),
    key: bytes(32, 1),
    iv: bytes(12, 100),
  },
  {
    name: 'single-contact-all-axes',
    plaintext: JSON.stringify({
      contacts: [
        {
          id: '7d444840-9dc0-11d1-b245-5ffdce74fad2',
          displayName: 'Leïla',
          phoneHash: hashPhone('+33 6 12 34 56 78'),
          ring: 1,
          roles: ['confidente'],
          etat: 'disponible',
          ressenti: 'douceur',
        },
      ],
    }),
    key: bytes(32, 42),
    iv: bytes(12, 200),
  },
  {
    name: 'utf8-multibyte',
    plaintext: JSON.stringify({
      contacts: [
        { id: '00000000-0000-4000-8000-000000000001', displayName: 'صواب — été 🌙', roles: [] },
      ],
    }),
    key: bytes(32, 250),
    iv: bytes(12, 3),
  },
];

const vault = vaultCases.map((c) => {
  const blob = encryptVault(c.plaintext, c.key, c.iv);
  if (decryptVault(blob, c.key) !== c.plaintext) throw new Error(`round-trip failed: ${c.name}`);
  return {
    name: c.name,
    keyBase64: c.key.toString('base64'),
    ivBase64: c.iv.toString('base64'),
    plaintextUtf8: c.plaintext,
    blobBase64: blob,
  };
});

const phoneInputs = ['+33 6 12 34 56 78', '06 12 34 56 78', '+1 (415) 555-0100', '  +212612345678  '];
const phoneHash = phoneInputs.map((input) => ({
  input,
  normalized: normalizePhone(input),
  salt: SALT,
  sha256Hex: hashPhone(input),
}));

const out = {
  $comment:
    'Generated from the RN reference implementation (apps/mobile/src/vault/crypto.ts + src/lib/phoneHash.ts) by a node:crypto script — see docs/migration/rn-native-handoff.md §7. Wire format: base64(IV(12) || TAG(16) || CIPHERTEXT), AES-256-GCM, no AAD. Phone hash: sha256("<salt>:<normalized>") lowercase hex. Native iOS and Android crypto implementations MUST reproduce every vector exactly. Fixed IVs are for tests only; production uses fresh random IVs.',
  generatedFrom: 'apps/mobile/src/vault/crypto.ts @ feat/agents-native-migration',
  aes256gcm: vault,
  phoneHash,
};

writeFileSync(process.argv[2], `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ${process.argv[2]}`);
