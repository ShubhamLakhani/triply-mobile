import type { AccountState } from '@/features/account/types';
import type { Profile } from '@/features/profile/types';

/**
 * Top-level route group a user belongs in. `bootstrap` = not enough information yet;
 * `restricted` = signed in, but the account is suspended / banned / pending deletion.
 */
export type AppArea = 'bootstrap' | 'auth' | 'onboarding' | 'app' | 'restricted' | 'error';

/** Why the `error` area is shown (drives the copy and the retry action). */
export type AppAreaProblem = 'session' | 'profile' | 'account' | 'offline';

export interface ResolveAreaInput {
  isInitializing: boolean;
  isAuthenticated: boolean;
  /** A stored session exists but could not be restored (offline / timeout). */
  sessionRestoreFailed?: boolean;
  /** A recovery code was verified and the new password is not saved yet. */
  passwordRecovery?: boolean;
  /** Own account state once loaded (undefined while loading or signed out). */
  account: Pick<AccountState, 'status'> | undefined;
  accountError?: unknown;
  /** The account request is paused because the device is offline (no data yet). */
  accountPaused?: boolean;
  /** Own profile row once loaded (null/undefined while loading or signed out). */
  profile: Pick<Profile, 'onboarding_completed_at'> | null | undefined;
  profileError?: unknown;
  /** The profile request is paused because the device is offline (no data yet). */
  profilePaused?: boolean;
}

/**
 * Pure routing decision used by the root guard. Everything comes from the server:
 *   signed out → auth · account not active → restricted ·
 *   onboarding_completed_at null → onboarding · set → app.
 * The local onboarding marker only decides which onboarding step to resume (use-app-area).
 * Nothing waits forever: failures and offline states resolve to `error` (retry + sign-out).
 */
export function resolveAppArea(input: ResolveAreaInput): AppArea {
  if (input.isInitializing) return 'bootstrap';
  if (!input.isAuthenticated) return input.sessionRestoreFailed ? 'error' : 'auth';
  // Keep the reset screen mounted until the new password is saved (see AuthProvider).
  if (input.passwordRecovery) return 'auth';
  if (input.account === undefined) {
    return input.accountError || input.accountPaused ? 'error' : 'bootstrap';
  }
  if (input.account.status !== 'active') return 'restricted';
  if (input.profile === null || input.profile === undefined) {
    return input.profileError || input.profilePaused ? 'error' : 'bootstrap';
  }
  return input.profile.onboarding_completed_at === null ? 'onboarding' : 'app';
}

export function resolveAreaProblem(input: ResolveAreaInput): AppAreaProblem | null {
  if (resolveAppArea(input) !== 'error') return null;
  if (!input.isAuthenticated) return 'session';
  if (input.account === undefined) {
    return input.accountPaused && !input.accountError ? 'offline' : 'account';
  }
  return input.profilePaused && !input.profileError ? 'offline' : 'profile';
}

export const AREA_HOME: Record<Exclude<AppArea, 'bootstrap' | 'error' | 'restricted'>, string> = {
  auth: '/welcome',
  onboarding: '/onboarding',
  app: '/discover',
};
