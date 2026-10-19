import { useState } from 'react';

import { useUserDraft, type UserDraftStore } from '@/services/storage/user-draft-store';

import { MAX_INTERESTS, MIN_INTERESTS } from '../types';

import { useInterests, useOwnInterests, useReplaceInterests } from './use-interests';

/**
 * `ready` only once the catalog AND the user's saved selection have been returned by the server
 * (or are still cached after a failed refetch). While loading or failed, an empty list is never
 * treated as "no interests": chips cannot be toggled and nothing can be saved, because a save
 * replaces the whole selection.
 */
export type InterestSelectionStatus = 'loading' | 'error' | 'ready';

export interface InterestSelectionOptions {
  /**
   * Keeps the unsaved selection per user on the device (onboarding), so a cold restart resumes
   * with it. Without a store the draft lives in component state only (profile edit screen).
   */
  draftStore?: UserDraftStore<string[]>;
}

/**
 * Draft selection for the interest picker: seeded from the saved selection once it loads,
 * toggled locally, saved atomically with replace_profile_interests.
 */
export function useInterestSelection(
  userId: string | null,
  { draftStore = undefined }: InterestSelectionOptions = {},
) {
  const catalog = useInterests({ enabled: userId !== null });
  const own = useOwnInterests(userId);
  const replace = useReplaceInterests(userId);
  // Local edits only; until the user touches a chip the saved selection is shown directly.
  const [memoryDraft, setMemoryDraft] = useState<string[] | null>(null);
  const persistedDraft = useUserDraft(draftStore ?? null, userId);
  const [draftPersistFailed, setDraftPersistFailed] = useState(false);
  const draft = draftStore ? persistedDraft : memoryDraft;

  const ready = catalog.data !== undefined && own.data !== undefined;
  const unavailable =
    catalog.isError ||
    own.isError ||
    catalog.fetchStatus === 'paused' ||
    own.fetchStatus === 'paused';
  const status: InterestSelectionStatus = ready ? 'ready' : unavailable ? 'error' : 'loading';
  const saved = own.data?.map((item) => item.interest_id) ?? [];
  const selectedIds = ready ? (draft ?? saved) : [];
  const setDraft = (next: string[]) => {
    if (draftStore && userId) {
      if (!draftStore.write(userId, next)) setDraftPersistFailed(true);
    } else {
      setMemoryDraft(next);
    }
  };
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
    /**
     * The device copy of the draft could not be written: edits still work this session but
     * would not survive a cold restart until they are saved.
     */
    draftPersistFailed,
    /** Saves the selection when it changed; the device draft is dropped once the server has it. */
    save: async (): Promise<string[]> => {
      if (!ready) throw new Error('Interests are not loaded yet.');
      const ids = isDirty ? await replace.mutateAsync(selectedIds) : selectedIds;
      if (draftStore && userId) draftStore.clear(userId);
      return ids;
    },
    isSaving: replace.isPending,
  };
}
