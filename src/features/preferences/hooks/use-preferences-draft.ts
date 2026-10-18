import { useState } from 'react';

import type { Gender } from '@/features/profile/types';

import type { PreferencesDraft } from '../components/PreferencesFields';

import {
  useDiscoveryPreferences,
  useGenderPreferences,
  useSetGenderPreferences,
  useUpdateDiscoveryPreferences,
} from './use-preferences';

/**
 * `ready` only once BOTH preference queries have returned data from the server (or still hold
 * valid cached data after a failed refetch). Until then there is nothing to edit: no defaults
 * are ever shown as if they were the user's saved values, and nothing can be saved.
 */
export type PreferencesDraftStatus = 'loading' | 'error' | 'ready';

/** Editable copy of discovery + gender preferences; saves both in sequence. */
export function usePreferencesDraft(userId: string | null) {
  const discovery = useDiscoveryPreferences(userId);
  const genders = useGenderPreferences(userId);
  const updateDiscovery = useUpdateDiscoveryPreferences(userId);
  const setGenders = useSetGenderPreferences(userId);
  // Local edits only; until the user changes something the saved values are shown directly.
  const [draft, setDraft] = useState<PreferencesDraft | null>(null);

  const saved: PreferencesDraft | null =
    discovery.data !== undefined && genders.data !== undefined
      ? {
          min_age: discovery.data.min_age,
          max_age: discovery.data.max_age,
          minimum_overlap_days: discovery.data.minimum_overlap_days,
          genders: genders.data as Gender[],
        }
      : null;
  const unavailable =
    discovery.isError ||
    genders.isError ||
    discovery.fetchStatus === 'paused' ||
    genders.fetchStatus === 'paused';
  const status: PreferencesDraftStatus = saved ? 'ready' : unavailable ? 'error' : 'loading';
  const value = saved ? (draft ?? saved) : null;
  const isDirty =
    saved !== null && draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  return {
    status,
    /** The values to show and edit; null until `status` is `ready`. */
    value,
    setValue: (next: PreferencesDraft) => {
      if (saved) setDraft(next);
    },
    isDirty,
    /** At least one gender preference (required to continue and to save once complete). */
    meetsMinimum: value !== null && value.genders.length > 0,
    isLoading: status === 'loading',
    isError: status === 'error',
    /** Saved values are shown from cache because the latest refresh failed. */
    isStale: saved !== null && (discovery.isRefetchError || genders.isRefetchError),
    isRetrying: discovery.isFetching || genders.isFetching,
    retry: () => {
      void discovery.refetch();
      void genders.refetch();
    },
    isSaving: updateDiscovery.isPending || setGenders.isPending,
    save: async () => {
      if (!value) throw new Error('Preferences are not loaded yet.');
      await updateDiscovery.mutateAsync({
        min_age: value.min_age,
        max_age: value.max_age,
        minimum_overlap_days: value.minimum_overlap_days,
      });
      await setGenders.mutateAsync(value.genders);
    },
  };
}
