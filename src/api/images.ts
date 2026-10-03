import { Image } from 'expo-image';

import { tokenStore } from '@/auth/token-store';
import { config } from '@/config';

const API_PREFIX = '/api/v1/';

/**
 * expo-image source for a protected API image (e.g. an attendance photo_url), sent with the Bearer token.
 *
 * The URL is re-rooted on the configured server so the token never goes to another host, and so a
 * server that builds URLs with a different host (APP_URL vs. an ngrok tunnel) still works.
 * Returns null for anything that isn't an /api/v1 URL.
 */
export function authImageSource(url: string | null | undefined): { uri: string; headers: Record<string, string>; cacheKey: string } | null {
  if (!url || !config.serverUrl) return null;
  const at = url.indexOf(API_PREFIX);
  if (at < 0) return null;
  const uri = `${config.serverUrl}${url.slice(at)}`;
  const token = tokenStore.current();
  return {
    uri,
    // The URL carries a ?v= fingerprint that changes when the photo is replaced, so it is a safe cache key.
    cacheKey: uri,
    headers: {
      Accept: 'image/*',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(config.isNgrok ? { 'ngrok-skip-browser-warning': 'true' } : {}),
    },
  };
}

/**
 * Forget every cached protected image (attendance evidence) on this phone. Called whenever a
 * session ends or a new one starts, so photos never outlive the account or the access that loaded them.
 */
export function clearImageCaches() {
  void Image.clearMemoryCache().catch(() => undefined);
  void Image.clearDiskCache().catch(() => undefined);
}
