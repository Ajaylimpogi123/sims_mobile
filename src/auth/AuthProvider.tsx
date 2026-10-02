import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { login as apiLogin, logout as apiLogout, meQueryOptions } from '@/api/auth';
import { ApiError, MESSAGES, toApiError } from '@/api/errors';
import { ROLE_STUDENT, ROLE_SUPERVISOR, type User } from '@/api/types';

import { getDeviceName } from './device-name';
import { setSessionEndedHandler } from './session-events';
import { tokenStore } from './token-store';

/**
 * restoring     – reading the stored token and calling GET /me (splash)
 * signedOut     – show Login
 * signedIn      – show the tabs for user.role_id
 * restoreFailed – a token exists but /me couldn't be reached (offline / server error); offer retry
 */
export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn' | 'restoreFailed';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** Message for the login screen, e.g. why the session ended. */
  notice: string | null;
  restoreError: ApiError | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retryRestore: () => Promise<void>;
  clearNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** The server only lets students and supervisors in; this mirrors it so the app never routes anyone else. */
function isMobileRole(user: User | null | undefined): user is User {
  return !!user && (user.role_id === ROLE_STUDENT || user.role_id === ROLE_SUPERVISOR);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<ApiError | null>(null);
  const restoreStarted = useRef(false);

  /** Forget everything locally. Never throws. */
  const endLocalSession = useCallback(
    async (message: string | null) => {
      try {
        await tokenStore.clear();
      } catch {
        // Secure storage failure: the in-memory token is already gone.
      }
      queryClient.clear();
      setUser(null);
      setRestoreError(null);
      setNotice(message);
      setStatus('signedOut');
    },
    [queryClient],
  );

  // 401 / 403-code from any authenticated request -> back to login with the reason.
  useEffect(
    () => setSessionEndedHandler((message) => void endLocalSession(message)),
    [endLocalSession],
  );

  const restore = useCallback(async () => {
    setStatus('restoring');
    setRestoreError(null);

    let token: string | null = null;
    try {
      token = await tokenStore.load();
    } catch {
      token = null;
    }
    if (!token) {
      setStatus('signedOut');
      return;
    }

    try {
      const me = await queryClient.fetchQuery({ ...meQueryOptions, staleTime: 0 });
      if (!isMobileRole(me.user)) {
        await endLocalSession(MESSAGES.roleNotAllowed);
        return;
      }
      setUser(me.user);
      setStatus('signedIn');
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.endsSession) {
        // The client interceptor already ended the session; make sure the state agrees.
        await endLocalSession(apiError.message);
        return;
      }
      setRestoreError(apiError);
      setStatus('restoreFailed');
    }
  }, [endLocalSession, queryClient]);

  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;
    void restore();
  }, [restore]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setNotice(null);
      const result = await apiLogin({ email: email.trim(), password, device_name: getDeviceName() });

      if (!isMobileRole(result.user)) {
        throw new ApiError({ kind: 'forbidden', status: 403, message: MESSAGES.roleNotAllowed });
      }

      await tokenStore.save(result.token);
      queryClient.clear();
      setUser(result.user);
      setStatus('signedIn');
      // Warm the profile so the Profile tab opens instantly.
      void queryClient.prefetchQuery(meQueryOptions);
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    if (tokenStore.current()) {
      try {
        await apiLogout();
      } catch {
        // Offline, timed out or already revoked: clear locally anyway.
      }
    }
    await endLocalSession(null);
  }, [endLocalSession]);

  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, notice, restoreError, signIn, signOut, retryRestore: restore, clearNotice }),
    [status, user, notice, restoreError, signIn, signOut, restore, clearNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
