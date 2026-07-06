/**
 * VLT-01 — vault behaviors beyond the crypto round-trip: hydration from the
 * persisted ciphertext after a restart, the optional axes (état, ressenti)
 * including clearing them, unknown-id mutations as no-ops, and key reuse.
 */
import { getOrCreateVaultKey } from '../vault/crypto';
import {
  __resetVaultForTests,
  addContact,
  getContacts,
  getEncryptedVault,
  setEtat,
  setRessenti,
  setRing,
} from '../vault/vault';

beforeEach(() => {
  __resetVaultForTests();
});

describe('VLT-01 vault store', () => {
  it('rehydrates contacts by decrypting the persisted blob after a "restart"', async () => {
    const created = await addContact({ displayName: 'Nora', phoneHash: 'ph-1' });
    await setRing(created.id, 2);

    __resetVaultForTests(); // memory gone, ciphertext on "disk" remains

    const contacts = await getContacts();
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      displayName: 'Nora',
      phoneHash: 'ph-1',
      ring: 2,
    });
  });

  it('sets and clears the optional axes (ONB-06: optional, reversible)', async () => {
    const c = await addContact({ displayName: 'Sami' });

    await setEtat(c.id, 'occupé');
    await setRessenti(c.id, 'précieux');
    let [stored] = await getContacts();
    expect(stored).toMatchObject({ etat: 'occupé', ressenti: 'précieux' });

    await setEtat(c.id, undefined);
    await setRessenti(c.id, undefined);
    [stored] = await getContacts();
    expect(stored?.etat).toBeUndefined();
    expect(stored?.ressenti).toBeUndefined();
  });

  it('ignores mutations for unknown contact ids', async () => {
    await addContact({ displayName: 'Sami' });
    await expect(setRing('no-such-id', 1)).resolves.toBeUndefined();
    await expect(setEtat('no-such-id', 'ailleurs')).resolves.toBeUndefined();
    const contacts = await getContacts();
    expect(contacts[0]?.ring).toBeUndefined();
    expect(contacts[0]?.etat).toBeUndefined();
  });

  it('materializes a blob on first getEncryptedVault of an empty vault', async () => {
    const { blob, version } = await getEncryptedVault();
    expect(blob.length).toBeGreaterThan(0);
    expect(version).toBeGreaterThanOrEqual(1);
  });

  it('reuses the same vault key once created (ONB-02)', async () => {
    const first = await getOrCreateVaultKey();
    const second = await getOrCreateVaultKey();
    expect(second).toEqual(first);
    expect(first).toHaveLength(32);
  });
});
