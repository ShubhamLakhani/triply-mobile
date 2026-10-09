import { getSupabaseClient } from '@/services/supabase';

import { blockResultSchema, blockTargetSchema } from '../schemas/block.schema';
import type { OwnBlock } from '../types';

import { BlockError, toBlockError } from './block-errors';

export const BLOCK_COLUMNS = 'blocked_user_id, created_at' as const;

function parseTarget(targetUserId: string): string {
  const parsed = blockTargetSchema.safeParse(targetUserId);
  if (!parsed.success) {
    throw new BlockError('invalid_input', 'Invalid user.', { cause: parsed.error });
  }
  return parsed.data;
}

/** The caller's own outgoing blocks, newest first. */
export async function fetchOwnBlocks(userId: string): Promise<OwnBlock[]> {
  const { data, error } = await getSupabaseClient()
    .from('user_blocks')
    .select(BLOCK_COLUMNS)
    .eq('blocker_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw toBlockError(error);
  return data;
}

/**
 * Blocks a user via the block_user RPC (idempotent). The server also ends any active match
 * with them in the same transaction.
 */
export async function blockUser(targetUserId: string): Promise<OwnBlock> {
  const { data, error } = await getSupabaseClient()
    .rpc('block_user', { p_target_user_id: parseTarget(targetUserId) })
    .single();
  if (error) throw toBlockError(error);
  const result = blockResultSchema.safeParse(data);
  if (!result.success) {
    throw new BlockError('unexpected_response', 'Unexpected block response.', {
      cause: result.error,
    });
  }
  return result.data;
}

/**
 * Removes the caller's own block (idempotent). Resolves to whether a block was removed.
 * Never restores a previous match.
 */
export async function unblockUser(targetUserId: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient().rpc('unblock_user', {
    p_target_user_id: parseTarget(targetUserId),
  });
  if (error) throw toBlockError(error);
  if (typeof data !== 'boolean') {
    throw new BlockError('unexpected_response', 'Unexpected unblock response.');
  }
  return data;
}
