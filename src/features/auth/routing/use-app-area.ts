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
  /** Set when `area` is `error`: what failed (session restore, profile load, offline). */
  problem: AppAreaProblem | null;
  /** Route to land on inside the area (onboarding resumes at the right step). */
  home: string | null;
  retry: () => void;
}

/** Derives the current route group from the single auth session and the persisted profile row. */
export function useAppArea(): AppAreaState {
  const { userId, isAuthenticated, isInitializing, restoreError, retryRestore } = useAuthSession();
  const profile = useOwnProfile(userId);
  const progress = useOnboardingProgress(userId);

  const input: ResolveAreaInput = {
    isInitializing,
    isAuthenticated,
    sessionRestoreFailed: restoreError !== null,
    profile: profile.data,
    profileError: profile.error,
    profilePaused: profile.fetchStatus === 'paused' && profile.data === undefined,
    onboardingInProgress: progress.inProgress,
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
    else void profile.refetch();
  };

  return { area, problem, home, retry };
}
