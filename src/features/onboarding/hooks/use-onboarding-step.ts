import { router } from 'expo-router';
import { useEffect } from 'react';

import { useAuthSession } from '@/features/auth/hooks/use-auth-session';
import { useOwnProfile } from '@/features/profile/hooks/use-own-profile';
import { useAnalytics } from '@/services/analytics';

import {
  markStepCompleted,
  nextStep,
  ONBOARDING_STEPS,
  STEP_ROUTES,
  stepIndex,
  type OnboardingStep,
} from '../progress';

/**
 * Shared step plumbing: tracks the view, and advances (marking the step complete locally) with
 * replace-style navigation so Android back never returns to a finished step.
 */
export function useOnboardingStep(step: OnboardingStep) {
  const { userId } = useAuthSession();
  const profile = useOwnProfile(userId);
  const analytics = useAnalytics();

  useEffect(() => {
    analytics.track('onboarding_step_viewed', { step });
  }, [analytics, step]);

  const advance = (options: { skipped?: boolean } = {}) => {
    if (userId) markStepCompleted(userId, step);
    analytics.track('onboarding_step_completed', { step, skipped: options.skipped ?? false });
    const next = nextStep(step);
    if (next) router.replace(STEP_ROUTES[next] as never);
  };

  const back = () => {
    const previous = ONBOARDING_STEPS[stepIndex(step) - 1];
    if (previous) router.replace(STEP_ROUTES[previous] as never);
  };

  return { userId, profile, advance, back };
}
