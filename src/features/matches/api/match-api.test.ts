import { getSupabaseClient } from '@/services/supabase';

import { createFakeSupabase, type FakeResult } from '../../../../tests/utils/fake-supabase';

import { fetchOwnMatches, unmatch } from './match-api';

jest.mock('@/services/supabase', () => ({ getSupabaseClient: jest.fn() }));

const A = '10000000-0000-4000-8000-00000000000a';
const B = '20000000-0000-4000-8000-00000000000b';
const MATCH_ID = 'e0000000-0000-4000-8000-000000000001';

const row = (unmatched: boolean) => ({
  id: MATCH_ID,
  user_low_id: A,
  user_high_id: B,
  created_at: '2026-10-09T00:00:00Z',
  unmatched_at: unmatched ? '2026-10-09T01:00:00Z' : null,
  unmatched_by: unmatched ? B : null,
});

function useFake(result: FakeResult) {
  const { client, calls } = createFakeSupabase(result);
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
  return calls;
}

describe('match api', () => {
  it('lists matches where the user is either participant and derives the other user', async () => {
    const calls = useFake({ data: [row(false)], error: null });
    const [fromB] = await fetchOwnMatches(B);
    expect(calls).toContainEqual({
      method: 'or',
      args: [`user_low_id.eq.${B},user_high_id.eq.${B}`],
    });
    expect(fromB).toMatchObject({ other_user_id: A, is_active: true });
    useFake({ data: [row(false)], error: null });
    const [fromA] = await fetchOwnMatches(A);
    expect(fromA?.other_user_id).toBe(B);
  });

  it('rejects a non-uuid user id before building a filter', async () => {
    const calls = useFake({ data: [], error: null });
    await expect(fetchOwnMatches('x,user_low_id.neq.null')).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(calls).toHaveLength(0);
  });

  it('unmatches via the RPC only and reports an inactive match', async () => {
    const calls = useFake({ data: row(true), error: null });
    const match = await unmatch(A, MATCH_ID);
    expect(calls[0]).toEqual({ method: 'rpc', args: ['unmatch', { p_match_id: MATCH_ID }] });
    expect(calls.some((call) => call.method === 'from')).toBe(false);
    expect(match.is_active).toBe(false);
  });

  it('maps an unknown or foreign match to not_found', async () => {
    useFake({ data: null, error: { code: 'P0002', message: 'match not found' } });
    await expect(unmatch(A, MATCH_ID)).rejects.toMatchObject({ code: 'not_found' });
  });
});
