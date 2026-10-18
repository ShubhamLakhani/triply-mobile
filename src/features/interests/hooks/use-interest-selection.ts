import { useState } from 'react';

import { MAX_INTERESTS, MIN_INTERESTS } from '../types';

import { useInterests, useOwnInterests, useReplaceInterests } from './use-interests';

/**
 * `ready` only once the catalog AND the user's saved selection have been returned by the server
 * (or are still cached after a failed refetch). While loading or failed, an empty list is never
 * treated as "no interests": chips cannot be toggled and nothing can be saved, because a save
 * replaces the whole selection.
 */
export type InterestSelectionStatus = 'loading' | 'error' | 'ready';

/**
 * Draft selection for the interest picker: seeded from the saved selection once it loads,
 * toggled locally, saved atomically with replace_profile_interests.
 */
export function useInterestSelection(userId: string | null) {
  const catalog = useInterests({ enabled: userId !== null });
  const own = useOwnInterests(userId);
  const replace = useReplaceInterests(userId);
  // Local edits only; until the user touches a chip the saved selection is shown directly.
  const [draft, setDraft] = useState<string[] | null>(null);

  const ready = catalog.data !== undefined && own.data !== undefined;
  const unavailable =
    catalog.isError ||
    own.isError ||
    catalog.fetchStatus === 'paused' ||
    own.fetchStatus === 'paused';
  const status: InterestSelectionStatus = ready ? 'ready' : unavailable ? 'error' : 'loading';
  const saved = own.data?.map((item) => item.interest_id) ?? [];
  const selectedIds = ready ? (draft ?? saved) : [];
  const toggle = (interestId: string) => {
    if (!ready) return;
    setDraft(
      selectedIds.includes(interestId)
        ? selectedIds.filter((id) => id !== interestId)
        : [...selectedIds, interestId],
    );
  };
  const isDirty =
    ready &&
    draft !== null &&
    JSON.stringify([...draft].sort()) !== JSON.stringify([...saved].sort());

  return {
    status,
    catalog: catalog.data,
    isLoading: status === 'loading',
    isError: status === 'error',
    /** The saved selection is shown from cache because the latest refresh failed. */
    isStale: ready && (catalog.isRefetchError || own.isRefetchError),
    isRetrying: catalog.isFetching || own.isFetching,
    retry: () => {
      void catalog.refetch();
      void own.refetch();
    },
    selectedIds,
    toggle,
    isDirty,
    /** 3–8 selected: required to continue onboarding and for every save once complete. */
    meetsMinimum: selectedIds.length >= MIN_INTERESTS && selectedIds.length <= MAX_INTERESTS,
    save: () => {
      if (!ready) return Promise.reject(new Error('Interests are not loaded yet.'));
      return replace.mutateAsync(selectedIds);
    },
    isSaving: replace.isPending,
  };
}
