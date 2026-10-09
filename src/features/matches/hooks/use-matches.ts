import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchOwnMatchById, fetchOwnMatches, unmatch } from '../api/match-api';
import { MatchError } from '../api/match-errors';
import { matchKeys } from '../api/match-keys';
import type { OwnMatch } from '../types';

function requireUser(userId: string | null): string {
  if (!userId) throw new MatchError('not_authenticated', 'Not signed in.');
  return userId;
}

export function useOwnMatches(userId: string | null) {
  return useQuery({
    queryKey: matchKeys.own(userId ?? 'signed-out'),
    queryFn: () => fetchOwnMatches(requireUser(userId)),
    enabled: userId !== null,
  });
}

export function useOwnMatch(userId: string | null, matchId: string | null) {
  return useQuery({
    queryKey: matchKeys.detail(userId ?? 'signed-out', matchId ?? ''),
    queryFn: () => fetchOwnMatchById(requireUser(userId), matchId ?? ''),
    enabled: userId !== null && matchId !== null && matchId !== '',
  });
}

export function useUnmatch(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<OwnMatch, MatchError | Error, string>({
    mutationFn: (matchId) => unmatch(requireUser(userId), matchId),
    onSuccess: async (match) => {
      const owner = requireUser(userId);
      queryClient.setQueryData(matchKeys.detail(owner, match.id), match);
      await queryClient.invalidateQueries({ queryKey: matchKeys.own(owner) });
    },
  });
}
