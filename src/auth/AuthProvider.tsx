import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { login as apiLogin, logout as apiLogout, meQueryOptions, revokeToken } from '@/api/auth';
import { ApiError, MESSAGES, toApiError } from '@/api/errors';
import { clearImageCaches } from '@/api/images';
import type { MeResponse, User } from '@/api/types';
import { navigationFor, type Navigation } from '@/navigation/access';

import { getDeviceName } from './device-name';
import { setSessionEndedHandler } from './session-events';
import { tokenStore } from './token-store';

/**
 * restoring     – reading the stored token and calling GET /me (splash)
 * signedOut     – show Login
 * signedIn      – show the navigation for the user's role (see src/navigation/access.ts)
 * restoreFailed – a token exists but /me couldn't be reached (offline / server error); offer retry
 */
export type AuthStatus = 'restoring' | 'signedOut' | 'signedIn' | 'restoreFailed';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** Latest GET /me (role summary + staff flags). Set whenever status is signedIn. */
  me: MeResponse | null;
  /** Tabs / More items for this user. Set whenever status is signedIn. */
  navigation: Navigation | null;
  /** Message for the login screen, e.g. why the session ended. */
  notice: string | null;
  restoreError: ApiError | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retryRestore: () => Promise<void>;
  clearNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('restoring');
  /** /me as of sign-in / restore; the live query below supersedes it once it refetches. */
  const [sessionMe, setSessionMe] = useState<MeResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<ApiError | null>(null);
  const restoreStarted = useRef(false);

  // Keeps role / flags fresh (pull-to-refresh on Profile, app foreground) while signed in.
  const meQuery = useQuery({ ...meQueryOptions, enabled: status === 'signedIn' });
  const me = status === 'signedIn' ? (meQuery.data ?? sessionMe) : null;
  const navigation = useMemo(() => navigationFor(me), [me]);

  /** Forget everything locally. Never throws. */
  const endLocalSession = useCallback(
    async (message: string | null) => {
      try {
        await tokenStore.clear();
      } catch {
        // Secure storage failure: the in-memory token is already gone.
      }
      queryClient.clear();
      clearImageCaches();
      setSessionMe(null);
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

  /**
   * Loads GET /me with the stored token and enters the app. Used after login and on launch.
   * Every active role (1-4) is allowed; the server answers 403 role_not_allowed for anything else.
   */
  const enterWithStoredToken = useCallback(async () => {
    try {
      const fresh = await queryClient.fetchQuery({ ...meQueryOptions, staleTime: 0 });
      if (!navigationFor(fresh)) {
        // A role this app version doesn't know (the server should already have refused it).
        try {
          await apiLogout();
        } catch {
          // Clear locally anyway.
        }
        await endLocalSession(MESSAGES.roleNotAllowed);
        return;
      }
      setSessionMe(fresh);
      setRestoreError(null);
      setStatus('signedIn');
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.endsSession) {
        // The client interceptor already ended the session; make sure the state agrees.
        await endLocalSession(apiError.message);
        return;
      }
      // Offline / server error: keep the token and offer Try again / Log out.
      setRestoreError(apiError);
      setStatus('restoreFailed');
    }
  }, [endLocalSession, queryClient]);

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
    await enterWithStoredToken();
  }, [enterWithStoredToken]);

  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;
    void restore();
  }, [restore]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setNotice(null);
      const result = await apiLogin({ email: email.trim(), password, device_name: getDeviceName() });
      try {
        await tokenStore.save(result.token);
      } catch {
        // Couldn't keep the token in secure storage: revoke it so it isn't left orphaned on the server.
        await tokenStore.clear().catch(() => undefined);
        await revokeToken(result.token);
        throw new ApiError({ kind: 'unknown', message: MESSAGES.tokenStorageFailed });
      }
      queryClient.clear();
      clearImageCaches();
      // Navigation depends on /me (staff flags), so load it before leaving the login screen.
      await enterWithStoredToken();
    },
    [enterWithStoredToken, queryClient],
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
    () => ({
      status,
      user: me?.user ?? null,
      me,
      navigation,
      notice,
      restoreError,
      signIn,
      signOut,
      retryRestore: restore,
      clearNotice,
    }),
    [status, me, navigation, notice, restoreError, signIn, signOut, restore, clearNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

const NO_ITEMS: Pick<Navigation, 'tabs' | 'more'> = { tabs: [], more: [] };

/**
 * Tabs / More items for layouts and screens inside a signed-in route group. Returns empty lists
 * (never throws) while a group is being torn down after logout.
 */
export function useNavigationAccess(): Pick<Navigation, 'tabs' | 'more'> {
  return useAuth().navigation ?? NO_ITEMS;
}
