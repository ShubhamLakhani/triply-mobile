import { useOwnAccountState } from '@/features/account/hooks/use-account-state';
import type { AccountState } from '@/features/account/types';
import {
  useOnboardingProgress,
  resolveResumeStep,
  STEP_ROUTES,
} from '@/features/onboarding/progress';
import { useOwnProfile } from '@/features/profile/hooks/use-own-profile';

import { useAuthSession } from '../hooks/use-auth-session';

import {
  AREA_HOME,
  resolveAppArea,
  resolveAreaProblem,
  type AppArea,
  type AppAreaProblem,
  type ResolveAreaInput,
} from './resolve-area';

export interface AppAreaState {
  area: AppArea;
  /** Set when `area` is `error`: what failed (session restore, account, profile, offline). */
  problem: AppAreaProblem | null;
  /** Set when `area` is `restricted`. */
  account: AccountState | null;
  /** Route to land on inside the area (onboarding resumes at the right step). */
  home: string | null;
  retry: () => void;
}

/**
 * Derives the current route group from the single auth session, the account state and the
 * persisted profile row (all server state). The local onboarding marker only picks the step
 * to resume inside onboarding.
 */
export function useAppArea(): AppAreaState {
  const { userId, isAuthenticated, isInitializing, restoreError, retryRestore, passwordRecovery } =
    useAuthSession();
  const account = useOwnAccountState(userId);
  const profile = useOwnProfile(userId);
  const progress = useOnboardingProgress(userId);

  const input: ResolveAreaInput = {
    isInitializing,
    isAuthenticated,
    sessionRestoreFailed: restoreError !== null,
    passwordRecovery,
    account: account.data,
    accountError: account.error,
    accountPaused: account.fetchStatus === 'paused' && account.data === undefined,
    profile: profile.data,
    profileError: profile.error,
    profilePaused: profile.fetchStatus === 'paused' && profile.data === undefined,
  };
  const area = resolveAppArea(input);
  const problem = resolveAreaProblem(input);

  let home: string | null = null;
  if (area === 'auth' || area === 'app') home = AREA_HOME[area];
  if (area === 'onboarding') {
    home =
      STEP_ROUTES[
        resolveResumeStep(profile.data?.is_profile_complete === true, progress.completedStep)
      ];
  }

  const retry = () => {
    if (problem === 'session') retryRestore();
    else if (problem === 'account' || (problem === 'offline' && account.data === undefined)) {
      void account.refetch();
    } else void profile.refetch();
  };

  return {
    area,
    problem,
    account: area === 'restricted' ? (account.data ?? null) : null,
    home,
    retry,
  };
}
