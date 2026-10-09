import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchOwnDiscoveryPreferences,
  fetchOwnGenderPreferences,
  setGenderPreferences,
  updateDiscoveryPreferences,
} from '../api/preference-api';
import { PreferenceError } from '../api/preference-errors';
import { preferenceKeys } from '../api/preference-keys';
import type {
  DiscoveryPreferencesUpdateInput,
  GenderPreferencesInput,
} from '../schemas/preferences.schema';
import type { DiscoveryPreferences, GenderPreference } from '../types';

function requireUser(userId: string | null): string {
  if (!userId) throw new PreferenceError('not_authenticated', 'Not signed in.');
  return userId;
}

export function useDiscoveryPreferences(userId: string | null) {
  return useQuery({
    queryKey: preferenceKeys.discovery(userId ?? 'signed-out'),
    queryFn: () => fetchOwnDiscoveryPreferences(requireUser(userId)),
    enabled: userId !== null,
  });
}

export function useUpdateDiscoveryPreferences(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<
    DiscoveryPreferences,
    PreferenceError | Error,
    DiscoveryPreferencesUpdateInput
  >({
    mutationFn: (input) => updateDiscoveryPreferences(requireUser(userId), input),
    onSuccess: async (preferences) => {
      const key = preferenceKeys.discovery(preferences.user_id);
      queryClient.setQueryData(key, preferences);
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useGenderPreferences(userId: string | null) {
  return useQuery({
    queryKey: preferenceKeys.genders(userId ?? 'signed-out'),
    queryFn: () => fetchOwnGenderPreferences(requireUser(userId)),
    enabled: userId !== null,
  });
}

export function useSetGenderPreferences(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<GenderPreference[], PreferenceError | Error, GenderPreferencesInput>({
    mutationFn: (values) => {
      requireUser(userId);
      return setGenderPreferences(values);
    },
    onSuccess: async (genders) => {
      const key = preferenceKeys.genders(requireUser(userId));
      queryClient.setQueryData(key, genders);
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
