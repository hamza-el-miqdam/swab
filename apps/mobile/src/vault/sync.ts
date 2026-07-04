/**
 * Vault sync (FS-07 VLT-02/VLT-04): pushes the opaque encrypted blob.
 * On 409 the client re-pulls the server version and retries once —
 * single-device POC, last write wins.
 */
import { getVault as fetchServerVault, pushVault } from '../api/client';
import { getEncryptedVault, setVaultVersion } from './vault';

export async function syncVault(): Promise<void> {
  const { blob, version } = await getEncryptedVault();
  const result = await pushVault({ blob, version });
  if (result.ok) {
    await setVaultVersion(result.version);
    return;
  }
  const server = await fetchServerVault();
  const retryVersion = (server?.version ?? version) + 1;
  const retry = await pushVault({ blob, version: retryVersion });
  if (!retry.ok) {
    throw new Error('vault sync: conflict persisted after retry');
  }
  await setVaultVersion(retry.version);
}
