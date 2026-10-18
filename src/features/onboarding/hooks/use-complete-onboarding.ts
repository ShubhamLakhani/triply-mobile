import { useMutation, useQueryClient } from '@tanstack/react-query';

import { profileKeys } from '@/features/profile/api/profile-keys';
import type { Profile } from '@/features/profile/types';

import { completeOnboarding, OnboardingError } from '../api/onboarding-api';

/**
 * Completes onboarding on the server. On success the returned row (with
 * onboarding_completed_at set) replaces the cached profile, which flips the root guard to the
 * app; nothing navigates directly.
 */
export function useCompleteOnboarding(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<Profile, OnboardingError | Error, void>({
    mutationFn: () => {
      if (!userId) throw new OnboardingError('unknown', 'Not signed in.');
      return completeOnboarding();
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.own(profile.id), profile);
    },
  });
}
