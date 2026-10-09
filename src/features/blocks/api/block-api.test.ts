import { getSupabaseClient } from '@/services/supabase';

import { createFakeSupabase, type FakeResult } from '../../../../tests/utils/fake-supabase';
import { isBlockedByMe } from '../types';

import { blockUser, fetchOwnBlocks, unblockUser } from './block-api';

jest.mock('@/services/supabase', () => ({ getSupabaseClient: jest.fn() }));

const USER_ID = '10000000-0000-4000-8000-00000000000a';
const TARGET = '20000000-0000-4000-8000-00000000000b';

function useFake(result: FakeResult) {
  const { client, calls } = createFakeSupabase(result);
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
  return calls;
}

describe('block api', () => {
  it('blocks through the block_user RPC with only the target id', async () => {
    const calls = useFake({
      data: { blocked_user_id: TARGET, created_at: '2026-10-09T00:00:00Z' },
      error: null,
    });
    await expect(blockUser(TARGET)).resolves.toEqual({
      blocked_user_id: TARGET,
      created_at: '2026-10-09T00:00:00Z',
    });
    expect(calls[0]).toEqual({ method: 'rpc', args: ['block_user', { p_target_user_id: TARGET }] });
    expect(calls.some((call) => call.method === 'from')).toBe(false);
  });

  it('unblocks through the unblock_user RPC and reports whether a block was removed', async () => {
    const calls = useFake({ data: false, error: null });
    await expect(unblockUser(TARGET)).resolves.toBe(false);
    expect(calls[0]).toEqual({
      method: 'rpc',
      args: ['unblock_user', { p_target_user_id: TARGET }],
    });
  });

  it('rejects invalid targets before calling Supabase', async () => {
    const calls = useFake({ data: null, error: null });
    await expect(blockUser('nope')).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(unblockUser('')).rejects.toMatchObject({ code: 'invalid_input' });
    expect(calls).toHaveLength(0);
  });

  it('maps server errors to typed codes', async () => {
    useFake({ data: null, error: { code: '22023', message: 'cannot block yourself' } });
    await expect(blockUser(TARGET)).rejects.toMatchObject({ code: 'invalid_input' });
    useFake({ data: null, error: { code: 'P0002', message: 'user not found' } });
    await expect(blockUser(TARGET)).rejects.toMatchObject({ code: 'user_not_found' });
    useFake({ data: { blocked_user_id: 'x' }, error: null });
    await expect(blockUser(TARGET)).rejects.toMatchObject({ code: 'unexpected_response' });
  });

  it('reads only outgoing blocks (blocker = session user)', async () => {
    const calls = useFake({ data: [], error: null });
    await fetchOwnBlocks(USER_ID);
    expect(calls).toContainEqual({ method: 'from', args: ['user_blocks'] });
    expect(calls).toContainEqual({ method: 'eq', args: ['blocker_user_id', USER_ID] });
    expect(calls.some((call) => call.method === 'eq' && call.args[0] === 'blocked_user_id')).toBe(
      false,
    );
  });

  it('derives "blocked by me" from the own block list only', () => {
    const blocks = [{ blocked_user_id: TARGET, created_at: '2026-10-09T00:00:00Z' }];
    expect(isBlockedByMe(blocks, TARGET)).toBe(true);
    expect(isBlockedByMe(blocks, USER_ID)).toBe(false);
  });
});
