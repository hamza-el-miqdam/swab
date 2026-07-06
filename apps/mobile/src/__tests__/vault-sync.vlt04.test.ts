/**
 * VLT-02/VLT-04 — vault sync conflict handling: on 409 the client re-pulls
 * the server version and retries exactly once; a persisting conflict is an
 * error, never silent data loss.
 */
import { getVault as fetchServerVault, pushVault } from '../api/client';
import { syncVault } from '../vault/sync';
import { __resetVaultForTests, addContact, getEncryptedVault } from '../vault/vault';

jest.mock('../api/client', () => ({
  pushVault: jest.fn(),
  getVault: jest.fn(),
}));

const pushMock = pushVault as jest.Mock;
const fetchServerMock = fetchServerVault as jest.Mock;

beforeEach(() => {
  __resetVaultForTests();
  pushMock.mockReset();
  fetchServerMock.mockReset();
});

describe('VLT-04 syncVault', () => {
  it('pushes the local blob and adopts the server version on success', async () => {
    await addContact({ displayName: 'A' });
    pushMock.mockResolvedValue({ ok: true, version: 9 });

    await syncVault();

    expect(pushMock).toHaveBeenCalledTimes(1);
    const sent = pushMock.mock.calls[0][0] as { blob: string; version: number };
    expect(typeof sent.blob).toBe('string');
    expect(sent.blob.length).toBeGreaterThan(0);
    await expect(getEncryptedVault()).resolves.toMatchObject({ version: 9 });
  });

  it('on conflict, re-pulls the server version and retries once above it', async () => {
    await addContact({ displayName: 'A' });
    pushMock
      .mockResolvedValueOnce({ ok: false, reason: 'conflict' })
      .mockResolvedValueOnce({ ok: true, version: 13 });
    fetchServerMock.mockResolvedValue({ blob: 'server-blob', version: 12 });

    await syncVault();

    expect(pushMock).toHaveBeenCalledTimes(2);
    expect((pushMock.mock.calls[1][0] as { version: number }).version).toBe(13);
    await expect(getEncryptedVault()).resolves.toMatchObject({ version: 13 });
  });

  it('falls back to local version + 1 when the server has no vault yet', async () => {
    await addContact({ displayName: 'A' });
    const { version: localVersion } = await getEncryptedVault();
    pushMock
      .mockResolvedValueOnce({ ok: false, reason: 'conflict' })
      .mockResolvedValueOnce({ ok: true, version: localVersion + 1 });
    fetchServerMock.mockResolvedValue(null);

    await syncVault();

    expect((pushMock.mock.calls[1][0] as { version: number }).version).toBe(
      localVersion + 1,
    );
  });

  it('throws when the conflict persists after the single retry', async () => {
    await addContact({ displayName: 'A' });
    pushMock.mockResolvedValue({ ok: false, reason: 'conflict' });
    fetchServerMock.mockResolvedValue({ blob: 'server-blob', version: 4 });

    await expect(syncVault()).rejects.toThrow('conflict persisted');
    expect(pushMock).toHaveBeenCalledTimes(2);
  });
});
