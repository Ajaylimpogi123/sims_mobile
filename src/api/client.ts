import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { notifySessionEnded } from '@/auth/session-events';
import { tokenStore } from '@/auth/token-store';
import { config } from '@/config';

import { toApiError } from './errors';

declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * Don't end the session on 401/403-code for this request
     * (used by POST /logout, which clears the session itself).
     */
    skipSessionEnd?: boolean;
    /** Internal: the token this request was sent with. */
    sentToken?: string | null;
  }
}

/**
 * The one HTTP client for the SIMS API. Screens never build URLs or call axios directly;
 * they go through the functions in src/api/*.ts.
 *
 * Every rejection is an ApiError (see ./errors.ts).
 */
export const api = axios.create({
  baseURL: config.apiBaseUrl ?? undefined,
  timeout: config.requestTimeoutMs,
  headers: {
    Accept: 'application/json',
    ...(config.isNgrok ? { 'ngrok-skip-browser-warning': 'true' } : {}),
  },
});

api.interceptors.request.use((request: InternalAxiosRequestConfig) => {
  const token = tokenStore.current();
  request.sentToken = token;
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
  return request;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const apiError = toApiError(error);
    const request = error.config;

    // Only end the session if the rejected token is still the one we're using
    // (a late 401 from a previous session must not log out a new one).
    if (
      apiError.endsSession &&
      request?.sentToken &&
      request.sentToken === tokenStore.current() &&
      !request.skipSessionEnd
    ) {
      notifySessionEnded(apiError.message);
    }

    return Promise.reject(apiError);
  },
);
