import * as SecureStore from 'expo-secure-store';

/**
 * The Sanctum token lives only in expo-secure-store (Android Keystore-backed).
 * A copy is kept in memory so the API client can attach it synchronously.
 */
const TOKEN_KEY = 'sims.auth.token';

let current: string | null = null;

export const tokenStore = {
  /** Token for the next request, or null when signed out. */
  current(): string | null {
    return current;
  },

  async load(): Promise<string | null> {
    current = await SecureStore.getItemAsync(TOKEN_KEY);
    return current;
  },

  async save(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    current = token;
  },

  async clear(): Promise<void> {
    current = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};
