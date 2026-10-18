import { useAuth, type AuthState } from '../providers/AuthProvider';

export interface AuthSessionState {
  session: AuthState['session'];
  userId: string | null;
  isAuthenticated: boolean;
  /** Alias of `isInitializing`, kept for Phase 1M callers. */
  isLoading: boolean;
  isInitializing: boolean;
  /** A stored session could not be restored (offline / timeout); see AuthState. */
  restoreError: AuthState['restoreError'];
  retryRestore: () => void;
  /** A recovery code was verified; the new password is not saved yet (see AuthState). */
  passwordRecovery: boolean;
  signOut: () => Promise<void>;
}

/** Current session from the single app-level AuthProvider (no per-screen subscriptions). */
export function useAuthSession(): AuthSessionState {
  const {
    session,
    userId,
    isAuthenticated,
    isInitializing,
    restoreError,
    retryRestore,
    passwordRecovery,
    signOut,
  } = useAuth();
  return {
    session,
    userId,
    isAuthenticated,
    isLoading: isInitializing,
    isInitializing,
    restoreError,
    retryRestore,
    passwordRecovery,
    signOut,
  };
}
