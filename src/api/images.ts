import { Image } from 'expo-image';

import { tokenStore } from '@/auth/token-store';
import { config } from '@/config';

const API_PREFIX = '/api/v1/';

/**
 * The part of an absolute API URL after /api/v1 (e.g. "/reports/12/attachment?v=3f1c"), to request
 * through the configured server only. The server may build URLs with another host (APP_URL vs. an
 * ngrok tunnel); the token must never follow that host. Null for anything that isn't an /api/v1 URL.
 */
export function apiPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const at = url.indexOf(API_PREFIX);
  return at < 0 ? null : url.slice(at + API_PREFIX.length - 1);
}

/**
 * expo-image source for a protected API image (e.g. an attendance photo_url or a report attachment),
 * sent with the Bearer token.
 *
 * The URL is re-rooted on the configured server (see apiPathFromUrl), so the token never goes to
 * another host. Returns null for anything that isn't an /api/v1 URL.
 */
export function authImageSource(url: string | null | undefined): { uri: string; headers: Record<string, string>; cacheKey: string } | null {
  const path = apiPathFromUrl(url);
  if (!path || !config.apiBaseUrl) return null;
  const uri = `${config.apiBaseUrl}${path}`;
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
 * Forget every cached protected image (attendance evidence, report attachments) on this phone. Called
 * whenever a session ends or a new one starts, so photos never outlive the account or the access that loaded them.
 */
export function clearImageCaches() {
  void Image.clearMemoryCache().catch(() => undefined);
  void Image.clearDiskCache().catch(() => undefined);
}
