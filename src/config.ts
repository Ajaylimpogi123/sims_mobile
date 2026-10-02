/**
 * App configuration. The only place the server address is read.
 *
 * EXPO_PUBLIC_API_URL is the SIMS Laravel server origin (e.g. https://sims.example.edu.ph
 * or an ngrok HTTPS URL). Expo inlines EXPO_PUBLIC_* values at bundle time, so it must be
 * read as the literal `process.env.EXPO_PUBLIC_API_URL` and the dev server restarted after
 * changing .env.
 */

const API_VERSION_PATH = '/api/v1';

function normalizeServerUrl(raw: string | undefined): { url: string | null; error: string | null } {
  const value = (raw ?? '').trim().replace(/\/+$/, '');
  if (!value) {
    return { url: null, error: 'EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and set the server address.' };
  }
  if (!/^https?:\/\/[^\s/]+/i.test(value)) {
    return { url: null, error: `EXPO_PUBLIC_API_URL must start with https:// (got "${value}").` };
  }
  // Release builds of Android block plain HTTP, so only allow it while developing.
  if (!__DEV__ && value.toLowerCase().startsWith('http://')) {
    return { url: null, error: 'EXPO_PUBLIC_API_URL must use HTTPS in release builds.' };
  }
  // Accept the address with or without the /api/v1 suffix.
  const withoutVersion = value.endsWith(API_VERSION_PATH) ? value.slice(0, -API_VERSION_PATH.length) : value;
  return { url: withoutVersion, error: null };
}

const server = normalizeServerUrl(process.env.EXPO_PUBLIC_API_URL);

export const config = {
  /** Server origin, e.g. https://sims.example.edu.ph (null when misconfigured). */
  serverUrl: server.url,
  /** Base URL for every API request. */
  apiBaseUrl: server.url ? `${server.url}${API_VERSION_PATH}` : null,
  /** Human-readable configuration problem, shown instead of the app. */
  configError: server.error,
  /** ngrok's free tier shows a browser warning page unless this header is sent. */
  isNgrok: server.url ? /ngrok/i.test(server.url) : false,
  requestTimeoutMs: 20_000,
  logoutTimeoutMs: 8_000,
} as const;
