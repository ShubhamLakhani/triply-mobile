import type { Profile } from '@/features/profile/types';

/** Top-level route group a user belongs in. `bootstrap` = not enough information yet. */
export type AppArea = 'bootstrap' | 'auth' | 'onboarding' | 'app' | 'error';

/** Why the `error` area is shown (drives the copy and the retry action). */
export type AppAreaProblem = 'session' | 'profile' | 'offline';

export interface ResolveAreaInput {
  isInitializing: boolean;
  isAuthenticated: boolean;
  /** A stored session exists but could not be restored (offline / timeout). */
  sessionRestoreFailed?: boolean;
  /** Own profile row once loaded (null while loading or signed out). */
  profile: Pick<Profile, 'is_profile_complete'> | null | undefined;
  profileError?: unknown;
  /** The profile request is paused because the device is offline (no data yet). */
  profilePaused?: boolean;
  /** True while the user is part-way through onboarding on this device (local marker). */
  onboardingInProgress: boolean;
}

/**
 * Pure routing decision used by the root guard. Completeness comes from the persisted
 * profile row (database-maintained), never from local state; the local onboarding marker only
 * keeps a user with an already-complete profile inside onboarding until they finish the
 * optional steps on this device. Nothing ever waits forever: failures and offline states
 * resolve to `error`, which offers retry and sign-out.
 */
export function resolveAppArea(input: ResolveAreaInput): AppArea {
  if (input.isInitializing) return 'bootstrap';
  if (!input.isAuthenticated) return input.sessionRestoreFailed ? 'error' : 'auth';
  if (input.profile === null || input.profile === undefined) {
    return input.profileError || input.profilePaused ? 'error' : 'bootstrap';
  }
  if (!input.profile.is_profile_complete) return 'onboarding';
  return input.onboardingInProgress ? 'onboarding' : 'app';
}

export function resolveAreaProblem(input: ResolveAreaInput): AppAreaProblem | null {
  if (resolveAppArea(input) !== 'error') return null;
  if (!input.isAuthenticated) return 'session';
  return input.profilePaused && !input.profileError ? 'offline' : 'profile';
}

export const AREA_HOME: Record<Exclude<AppArea, 'bootstrap' | 'error'>, string> = {
  auth: '/welcome',
  onboarding: '/onboarding',
  app: '/discover',
};
