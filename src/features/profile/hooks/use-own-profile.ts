import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthSession } from '@/features/auth/hooks/use-auth-session';

import { fetchOwnProfile, updateOwnProfile } from '../api/profile-api';
import { ProfileError } from '../api/profile-errors';
import { profileKeys } from '../api/profile-keys';
import type { ProfileUpdateInput } from '../schemas/profile.schema';
import type { Profile } from '../types';

/** Own profile for a known user id. Disabled while signed out. */
export function useOwnProfile(userId: string | null) {
  return useQuery({
    queryKey: profileKeys.own(userId ?? 'signed-out'),
    queryFn: () => {
      if (!userId) throw new ProfileError('not_authenticated', 'Not signed in.');
      return fetchOwnProfile(userId);
    },
    enabled: userId !== null,
  });
}

/** Own profile for the currently signed-in user. */
export function useCurrentProfile() {
  const { userId, isLoading: isSessionLoading } = useAuthSession();
  const query = useOwnProfile(userId);
  return { ...query, userId, isSessionLoading };
}

/**
 * Updates editable own-profile fields. On success the canonical row returned by the
 * database (with recomputed is_profile_complete) replaces the cache.
 */
export function useUpdateProfile(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<Profile, ProfileError | Error, ProfileUpdateInput>({
    mutationFn: (input) => {
      if (!userId) throw new ProfileError('not_authenticated', 'Not signed in.');
      return updateOwnProfile(userId, input);
    },
    onSuccess: async (profile) => {
      queryClient.setQueryData(profileKeys.own(profile.id), profile);
      await queryClient.invalidateQueries({ queryKey: profileKeys.own(profile.id) });
    },
  });
}
