import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchActiveInterests, fetchOwnInterests, replaceOwnInterests } from '../api/interest-api';
import { InterestError } from '../api/interest-errors';
import { interestKeys } from '../api/interest-keys';

const CATALOG_STALE_TIME = 60 * 60 * 1000;

function requireUser(userId: string | null): string {
  if (!userId) throw new InterestError('not_authenticated', 'Not signed in.');
  return userId;
}

/** Active interest catalog. Requires a signed-in user (anon has no access). */
export function useInterests(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: interestKeys.catalog(),
    queryFn: fetchActiveInterests,
    staleTime: CATALOG_STALE_TIME,
    enabled: options.enabled ?? true,
  });
}

/** The signed-in user's selected interests. Disabled while signed out. */
export function useOwnInterests(userId: string | null) {
  return useQuery({
    queryKey: interestKeys.own(userId ?? 'signed-out'),
    queryFn: () => fetchOwnInterests(requireUser(userId)),
    enabled: userId !== null,
  });
}

function useInvalidateOwnInterests(userId: string | null) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: interestKeys.own(requireUser(userId)) });
}

/** Saves a multi-select in one atomic call. */
export function useReplaceInterests(userId: string | null) {
  const invalidate = useInvalidateOwnInterests(userId);
  return useMutation<string[], InterestError | Error, readonly string[]>({
    mutationFn: (interestIds) => {
      requireUser(userId);
      return replaceOwnInterests(interestIds);
    },
    onSuccess: invalidate,
  });
}
