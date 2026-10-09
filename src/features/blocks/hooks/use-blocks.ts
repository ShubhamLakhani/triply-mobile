import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { decisionKeys } from '@/features/decisions/api/decision-keys';
import { matchKeys } from '@/features/matches/api/match-keys';

import { blockUser, fetchOwnBlocks, unblockUser } from '../api/block-api';
import { BlockError } from '../api/block-errors';
import { blockKeys } from '../api/block-keys';
import { isBlockedByMe, type OwnBlock } from '../types';

function requireUser(userId: string | null): string {
  if (!userId) throw new BlockError('not_authenticated', 'Not signed in.');
  return userId;
}

/** The signed-in user's outgoing blocks. */
export function useOwnBlocks(userId: string | null) {
  return useQuery({
    queryKey: blockKeys.own(userId ?? 'signed-out'),
    queryFn: () => fetchOwnBlocks(requireUser(userId)),
    enabled: userId !== null,
  });
}

/** Whether the signed-in user blocked `targetUserId` (derived from the own block list only). */
export function useIsUserBlocked(userId: string | null, targetUserId: string) {
  return useQuery({
    queryKey: blockKeys.own(userId ?? 'signed-out'),
    queryFn: () => fetchOwnBlocks(requireUser(userId)),
    enabled: userId !== null,
    select: (blocks: OwnBlock[]) => isBlockedByMe(blocks, targetUserId),
  });
}

/**
 * Blocks a user. Refreshes own blocks, own matches (an active match is ended server-side) and
 * own decisions. Never touches anything about the other user.
 */
export function useBlockUser(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<OwnBlock, BlockError | Error, string>({
    mutationFn: (targetUserId) => {
      requireUser(userId);
      return blockUser(targetUserId);
    },
    onSuccess: async () => {
      const owner = requireUser(userId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: blockKeys.own(owner) }),
        queryClient.invalidateQueries({ queryKey: matchKeys.own(owner) }),
        queryClient.invalidateQueries({ queryKey: decisionKeys.own(owner) }),
      ]);
    },
  });
}

/** Removes the signed-in user's block. Matches are not restored, so only blocks refresh. */
export function useUnblockUser(userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<boolean, BlockError | Error, string>({
    mutationFn: (targetUserId) => {
      requireUser(userId);
      return unblockUser(targetUserId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: blockKeys.own(requireUser(userId)) });
    },
  });
}
