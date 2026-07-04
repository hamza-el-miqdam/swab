/**
 * ONB-05 — THE test. Calibration data (names, rings, état, ressenti) must
 * never appear in any network payload: the only thing that leaves the device
 * is the encrypted vault blob. We calibrate, sync, then inspect every byte
 * handed to fetch.
 */
import { syncVault } from '../vault/sync';
import { __resetVaultForTests, addContact, setEtat, setRing } from '../vault/vault';

const fetchMock = jest.fn();

beforeEach(() => {
  __resetVaultForTests();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('ONB-05 / G1 / mobile rule 2 — classification never leaves the device in clear', () => {
  it('sync payloads contain only {blob, version}; plaintext never appears on the wire', async () => {
    await addContact({ displayName: 'Léa Dupont-Vérificateur' });
    const contacts = await addContact({ displayName: 'Marc Témoin' });
    await setRing(contacts.id, 1);
    await setEtat(contacts.id, 'en pause');

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ version: 3 }),
    });

    await syncVault();

    expect(fetchMock).toHaveBeenCalled();
    for (const call of fetchMock.mock.calls as [string, { body?: string }][]) {
      const [url, init] = call;
      const body = init.body ?? '';
      // Only the vault endpoint is ever hit by sync
      expect(url).toContain('/vault');
      // Payload shape is exactly the opaque blob contract (VLT-02)
      const parsed = JSON.parse(body) as Record<string, unknown>;
      expect(Object.keys(parsed).sort()).toEqual(['blob', 'version']);
      // And nothing readable leaks — names, axes, values
      expect(body).not.toContain('Léa');
      expect(body).not.toContain('Marc');
      expect(body).not.toContain('en pause');
      expect(body).not.toContain('"ring"');
      expect(body).not.toContain('ressenti');
    }
  });
});
