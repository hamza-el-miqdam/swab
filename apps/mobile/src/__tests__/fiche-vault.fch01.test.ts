/**
 * FCH-01 — every axis edit writes the vault immediately and appends a
 * history event locally. Also: FCH-05 vault fields (reconfirm / snooze),
 * FCH-04 match events (coarse grain), FCH-08 pending → linked, and
 * backward compatibility with pre-FS-03 blobs (no roles/history/createdAt).
 */
import { kvSet } from '../lib/db';
import { encryptVault, getOrCreateVaultKey } from '../vault/crypto';
import {
  __resetVaultForTests,
  addContact,
  getContacts,
  linkContact,
  recordMatch,
  reconfirmAxes,
  setEtat,
  setRessenti,
  setRing,
  setRoles,
  snoozeRetag,
} from '../vault/vault';

beforeEach(() => {
  __resetVaultForTests();
});

async function firstContact() {
  const [contact] = await getContacts();
  if (contact === undefined) {
    throw new Error('vault empty');
  }
  return contact;
}

describe('FCH-01 axis edits write the vault and append a history event', () => {
  it('setRing appends an axis-change event with the ring value', async () => {
    const c = await addContact({ displayName: 'Nora' });
    await setRing(c.id, 2);

    const stored = await firstContact();
    expect(stored.ring).toBe(2);
    expect(stored.history).toHaveLength(1);
    expect(stored.history[0]).toMatchObject({ kind: 'axis-change', axis: 'ring', value: '2' });
    expect(typeof stored.history[0]?.at).toBe('number');
    expect(typeof stored.history[0]?.id).toBe('string');
  });

  it('setRoles stores a copy of the roles and appends an axis-change event', async () => {
    const c = await addContact({ displayName: 'Sami' });
    const roles = ['ami·e', 'collègue'];
    await setRoles(c.id, roles);
    roles.push('mutated-after-call'); // caller mutation must not reach the vault

    const stored = await firstContact();
    expect(stored.roles).toEqual(['ami·e', 'collègue']);
    expect(stored.history[0]).toMatchObject({
      kind: 'axis-change',
      axis: 'roles',
      value: 'ami·e · collègue',
    });
  });

  it('setEtat / setRessenti append events; clearing appends an event without value', async () => {
    const c = await addContact({ displayName: 'Léa' });
    await setEtat(c.id, 'occupé');
    await setRessenti(c.id, 'précieux');
    await setEtat(c.id, undefined);

    const stored = await firstContact();
    expect(stored.etat).toBeUndefined();
    expect(stored.ressenti).toBe('précieux');
    expect(stored.history.map((e) => [e.axis, e.value])).toEqual([
      ['etat', 'occupé'],
      ['ressenti', 'précieux'],
      ['etat', undefined],
    ]);
  });

  it('getContacts returns fresh history copies (no live cache references)', async () => {
    const c = await addContact({ displayName: 'Nora' });
    await setRing(c.id, 1);

    const leaked = await firstContact();
    leaked.history.push({ id: 'fake', at: 0, kind: 'match' });
    leaked.roles.push('fake-role');

    const stored = await firstContact();
    expect(stored.history).toHaveLength(1);
    expect(stored.roles).toHaveLength(0);
  });

  it('history survives a restart inside the encrypted blob (FCH-04 vault-sourced)', async () => {
    const c = await addContact({ displayName: 'Nora' });
    await setEtat(c.id, 'disponible');

    __resetVaultForTests(); // memory gone, ciphertext on "disk" remains

    const stored = await firstContact();
    expect(stored.history).toHaveLength(1);
    expect(stored.history[0]).toMatchObject({ kind: 'axis-change', axis: 'etat' });
  });
});

describe('FCH-05 reconfirm and snooze fields', () => {
  it('reconfirmAxes appends a reconfirm event and clears any snooze', async () => {
    const c = await addContact({ displayName: 'Sami' });
    await snoozeRetag(c.id);
    await reconfirmAxes(c.id);

    const stored = await firstContact();
    expect(stored.retagSnoozedAt).toBeUndefined();
    expect(stored.history).toHaveLength(1);
    expect(stored.history[0]).toMatchObject({ kind: 'reconfirm' });
  });

  it('snoozeRetag records the timestamp quietly — no history event', async () => {
    const before = Date.now();
    const c = await addContact({ displayName: 'Sami' });
    await snoozeRetag(c.id);

    const stored = await firstContact();
    expect(stored.retagSnoozedAt).toBeGreaterThanOrEqual(before);
    expect(stored.history).toHaveLength(0);
  });
});

describe('FCH-04 match events stay coarse', () => {
  it('recordMatch appends a match event with no axis, no value, no verb', async () => {
    const c = await addContact({ displayName: 'Léa' });
    await recordMatch(c.id);

    const stored = await firstContact();
    expect(stored.history).toHaveLength(1);
    expect(stored.history[0]?.kind).toBe('match');
    expect(stored.history[0]?.axis).toBeUndefined();
    expect(stored.history[0]?.value).toBeUndefined();
  });
});

describe('FCH-08 pending until linked', () => {
  it('new contacts are pending (no linkedUserId); linkContact sets it', async () => {
    const c = await addContact({ displayName: 'Nora' });
    expect((await firstContact()).linkedUserId).toBeUndefined();

    await linkContact(c.id, 'user-42');
    expect((await firstContact()).linkedUserId).toBe('user-42');
  });
});

describe('backward compatibility with pre-FS-03 blobs', () => {
  it('hydrates a legacy blob lacking roles/history/createdAt with sane defaults', async () => {
    const key = await getOrCreateVaultKey();
    const legacy = { contacts: [{ id: 'c1', displayName: 'Nora', ring: 2, etat: 'occupé' }] };
    await kvSet('vault.blob.v1', encryptVault(JSON.stringify(legacy), key));
    __resetVaultForTests();

    const stored = await firstContact();
    expect(stored).toMatchObject({ displayName: 'Nora', ring: 2, etat: 'occupé' });
    expect(stored.roles).toEqual([]);
    expect(stored.history).toEqual([]);
    expect(stored.createdAt).toBeUndefined();

    // and the legacy contact is still editable — the edit appends history
    await setRing('c1', 3);
    expect((await firstContact()).history).toHaveLength(1);
  });
});
