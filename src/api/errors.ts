import { isAxiosError } from 'axios';

import type { ApiErrorBody } from './types';

export type ApiErrorKind =
  /** No response: offline, DNS, TLS, server down, tunnel closed. */
  | 'network'
  | 'timeout'
  /** 401: missing / invalid / revoked token. Ends the session. */
  | 'unauthenticated'
  /** 403 with code account_inactive, or role_not_allowed (no / unknown role). Ends the session. */
  | 'session_blocked'
  /** 403 without a code: not allowed to do this particular thing. */
  | 'forbidden'
  | 'not_found'
  /** 409: refused because of the account's state, e.g. code no_student_profile. Never ends the session. */
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'unknown';

const SESSION_BLOCKED_CODES = ['role_not_allowed', 'account_inactive'];

/** Normalized error for every failed API call. Screens only ever deal with this. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: string | null;
  /** 422 only: first message per request field, e.g. { email: 'The email field is required.' } */
  readonly fieldErrors: Record<string, string>;
  /** 429 only: seconds from the Retry-After header. */
  readonly retryAfterSeconds: number | null;
  /** The JSON error body, for endpoints that send extra data with an error (e.g. attendance 422 `today`). */
  readonly body: ApiErrorBody;

  constructor(init: {
    kind: ApiErrorKind;
    message: string;
    status?: number | null;
    code?: string | null;
    fieldErrors?: Record<string, string>;
    retryAfterSeconds?: number | null;
    body?: ApiErrorBody;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status ?? null;
    this.code = init.code ?? null;
    this.fieldErrors = init.fieldErrors ?? {};
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
    this.body = init.body ?? {};
  }

  /** True when the server has (or must be treated as having) revoked this device's token. */
  get endsSession(): boolean {
    return this.kind === 'unauthenticated' || this.kind === 'session_blocked';
  }
}

export const MESSAGES = {
  network: "Can't reach the server. Check your internet connection and try again.",
  timeout: 'The server took too long to respond. Please try again.',
  unauthenticated: 'Your session has ended. Please log in again.',
  forbidden: "You don't have permission to do that.",
  notFound: "We couldn't find that. It may have been removed.",
  validation: 'Please check the highlighted fields.',
  server: 'Something went wrong on the server. Please try again later.',
  unknown: 'Something went wrong. Please try again.',
  /** Fallback for 403 role_not_allowed (account with no / an unknown role); the server's message wins. */
  roleNotAllowed: 'This account does not have access to the mobile app.',
  tokenStorageFailed: "Couldn't save your login securely on this phone. Please try again; if it keeps happening, restart the phone.",
  accountInactive: 'This account has been deactivated. Please contact an administrator.',
} as const;

function parseRetryAfter(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const date = Date.parse(String(value));
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function rateLimitMessage(retryAfterSeconds: number | null): string {
  return retryAfterSeconds && retryAfterSeconds > 0
    ? `Too many attempts. Please wait ${formatWait(retryAfterSeconds)} and try again.`
    : 'Too many attempts. Please wait a moment and try again.';
}

function firstFieldErrors(errors: ApiErrorBody['errors']): Record<string, string> {
  const result: Record<string, string> = {};
  if (!errors || typeof errors !== 'object') return result;
  for (const [field, messages] of Object.entries(errors)) {
    if (Array.isArray(messages) && typeof messages[0] === 'string') result[field] = messages[0];
  }
  return result;
}

/**
 * 422 code term_archived: a write on a record of a past term by a non-Administrator. The message
 * (also errors.term[0]) says why, e.g. "This record belongs to an archived term (SY 2025-2026 ·
 * 2nd Semester). Only an Administrator can change it."
 */
export function isTermArchived(error: unknown): boolean {
  const apiError = toApiError(error);
  return apiError.kind === 'validation' && apiError.code === 'term_archived';
}

/** Converts anything thrown by axios (or our own code) into an ApiError. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (!isAxiosError(error)) {
    return new ApiError({ kind: 'unknown', message: MESSAGES.unknown });
  }

  const response = error.response;
  if (!response) {
    const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
    return new ApiError(
      timedOut ? { kind: 'timeout', message: MESSAGES.timeout } : { kind: 'network', message: MESSAGES.network },
    );
  }

  const status = response.status;
  const body: ApiErrorBody =
    response.data && typeof response.data === 'object' ? (response.data as ApiErrorBody) : {};
  const serverMessage = typeof body.message === 'string' && body.message ? body.message : null;
  const code = typeof body.code === 'string' ? body.code : null;

  switch (status) {
    case 401:
      return new ApiError({ kind: 'unauthenticated', status, message: MESSAGES.unauthenticated });
    case 403:
      if (code && SESSION_BLOCKED_CODES.includes(code)) {
        const fallback = code === 'account_inactive' ? MESSAGES.accountInactive : MESSAGES.roleNotAllowed;
        return new ApiError({ kind: 'session_blocked', status, code, message: serverMessage ?? fallback });
      }
      return new ApiError({ kind: 'forbidden', status, code, message: serverMessage ?? MESSAGES.forbidden });
    case 404:
      return new ApiError({ kind: 'not_found', status, message: MESSAGES.notFound });
    case 409:
      return new ApiError({ kind: 'conflict', status, code, body, message: serverMessage ?? MESSAGES.unknown });
    case 422:
      return new ApiError({
        kind: 'validation',
        status,
        code,
        body,
        message: serverMessage ?? MESSAGES.validation,
        fieldErrors: firstFieldErrors(body.errors),
      });
    case 429: {
      const retryAfterSeconds = parseRetryAfter(response.headers?.['retry-after']);
      return new ApiError({ kind: 'rate_limited', status, retryAfterSeconds, message: rateLimitMessage(retryAfterSeconds) });
    }
    default:
      if (status >= 500) return new ApiError({ kind: 'server', status, message: MESSAGES.server });
      return new ApiError({ kind: 'unknown', status, code, body, message: serverMessage ?? MESSAGES.unknown });
  }
}
