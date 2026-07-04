/** Session tokens (IDT-02) live in the OS keychain via expo-secure-store. */
import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'swab.session.access.v1';
const REFRESH_KEY = 'swab.session.refresh.v1';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export async function saveTokens(tokens: SessionTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}
