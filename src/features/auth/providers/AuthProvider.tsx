import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAnalytics } from '@/services/analytics';
import { captureError } from '@/services/observability';

import {
  getCurrentSession,
  signOut as signOutRequest,
  subscribeToAuthChanges,
  type Session,
  type User,
} from '../api/auth-api';
import { createAuthCacheReset } from '../api/auth-cache';
import { toAuthError, type AppAuthError } from '../api/auth-errors';
import { registerAuthLinkHandler } from '../api/auth-links';

export interface AuthState {
  session: Session | null;
  user: User | null;
  userId: string | null;
  isAuthenticated: boolean;
  /** True until the persisted session has been read once. Show a bootstrap screen meanwhile. */
  isInitializing: boolean;
  /**
   * Set when a stored session exists but could not be restored (offline / timed out). The
   * session is kept on the device; the app shows a retry state instead of the sign-in screens.
   */
  restoreError: AppAuthError | null;
  retryRestore: () => void;
  /** The latest auth deep-link problem (expired or invalid link), shown by the auth screens. */
  linkError: AppAuthError | null;
  dismissLinkError: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function isTransient(error: AppAuthError): boolean {
  return error.code === 'network' || error.code === 'timeout';
}

/**
 * The app's single auth subscription. Owns session state, clears the query cache on sign-out or
 * account switch, and identifies analytics with the opaque user id. Tokens stay inside the
 * Supabase client's own store; nothing here is copied to Zustand or logged.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const analytics = useAnalytics();
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [restoreError, setRestoreError] = useState<AppAuthError | null>(null);
  const [linkError, setLinkError] = useState<AppAuthError | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const cacheReset = useRef(createAuthCacheReset(queryClient));

  useEffect(() => {
    let active = true;
    getCurrentSession()
      .then((current) => {
        if (!active) return;
        // Seed the cache-reset tracker so a later sign-in as a different user is detected.
        cacheReset.current('INITIAL_SESSION', current);
        setSession(current);
        setRestoreError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        const error = toAuthError(cause);
        // Offline cold start with an expired access token: keep the stored session and offer a
        // retry. Anything else (e.g. a revoked refresh token) means the user is signed out.
        if (isTransient(error)) setRestoreError(error);
        else captureError(error, { source: 'auth-session' });
      })
      .finally(() => {
        if (active) setIsInitializing(false);
      });
    return () => {
      active = false;
    };
  }, [restoreAttempt]);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeToAuthChanges((event, next) => {
      if (!active) return;
      cacheReset.current(event, next);
      setSession(next);
      if (next) setRestoreError(null);
      if (event === 'SIGNED_OUT') {
        setRestoreError(null);
        analytics.reset();
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [analytics]);

  // Email-confirmation deep links are handled once the stored session is known, so a link can
  // never replace a signed-in session. The resulting SIGNED_IN event moves the user on.
  useEffect(() => {
    if (isInitializing) return undefined;
    return registerAuthLinkHandler({
      onSignedIn: () => setLinkError(null),
      onError: (cause) => {
        const error = toAuthError(cause);
        captureError(error, { source: 'auth-link', code: error.code });
        setLinkError(error);
      },
    });
  }, [isInitializing]);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (userId) analytics.identify(userId);
  }, [analytics, userId]);

  const signOut = useCallback(async () => {
    await signOutRequest();
  }, []);

  const retryRestore = useCallback(() => {
    setRestoreError(null);
    setIsInitializing(true);
    setRestoreAttempt((attempt) => attempt + 1);
  }, []);

  const dismissLinkError = useCallback(() => setLinkError(null), []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      userId,
      isAuthenticated: session !== null,
      isInitializing,
      restoreError: session ? null : restoreError,
      retryRestore,
      linkError,
      dismissLinkError,
      signOut,
    }),
    [
      session,
      userId,
      isInitializing,
      restoreError,
      retryRestore,
      linkError,
      dismissLinkError,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
