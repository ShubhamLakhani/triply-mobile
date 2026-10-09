import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { matchKeys } from '@/features/matches/api/match-keys';

import { fetchOwnDecisions, submitDecision } from '../api/decision-api';
import { DecisionError } from '../api/decision-errors';
import { decisionKeys } from '../api/decision-keys';
import type { SubmitDecisionInput } from '../schemas/decision.schema';
import type { DecisionResult } from '../types';

function requireUser(userId: string | null): string {
  if (!userId) throw new DecisionError('not_authenticated', 'Not signed in.');
  return userId;
}

/** The signed-in user's outgoing decisions. */
export function useOwnDecisions(userId: string | null) {
  return useQuery({
    queryKey: decisionKeys.own(userId ?? 'signed-out'),
    queryFn: () => fetchOwnDecisions(requireUser(userId)),
    enabled: userId !== null,
  });
}

/**
 * Submits a like/pass. Refreshes own decisions; when the server reports a match, also
 * refreshes own matches. The other user's caches are never assumed.
 */
export function useSubmitDecision(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<DecisionResult, DecisionError | Error, SubmitDecisionInput>({
    mutationFn: (input) => {
      requireUser(userId);
      return submitDecision(input);
    },
    onSuccess: async (result) => {
      const owner = requireUser(userId);
      const refreshes = [queryClient.invalidateQueries({ queryKey: decisionKeys.own(owner) })];
      if (result.matched) {
        refreshes.push(queryClient.invalidateQueries({ queryKey: matchKeys.own(owner) }));
      }
      await Promise.all(refreshes);
    },
  });
}
