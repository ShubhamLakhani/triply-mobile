import { getSupabaseClient } from '@/services/supabase';

import { createFakeSupabase, type FakeResult } from '../../../../tests/utils/fake-supabase';

import { fetchOwnDecisions, submitDecision } from './decision-api';

jest.mock('@/services/supabase', () => ({ getSupabaseClient: jest.fn() }));

const USER_ID = '10000000-0000-4000-8000-00000000000a';
const TARGET = '20000000-0000-4000-8000-00000000000b';
const DECISION_ID = 'c0000000-0000-4000-8000-000000000001';
const MATCH_ID = 'e0000000-0000-4000-8000-000000000001';
const TRIP = 'a1000000-0000-4000-8000-000000000001';

function useFake(result: FakeResult) {
  const { client, calls } = createFakeSupabase(result);
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
  return calls;
}

describe('decision api', () => {
  it('submits through the submit_decision RPC without any actor id', async () => {
    const calls = useFake({
      data: {
        decision_id: DECISION_ID,
        decision: 'like',
        matched: true,
        match_id: MATCH_ID,
        match_created: true,
      },
      error: null,
    });
    const result = await submitDecision({ target_user_id: TARGET, decision: 'like' });
    expect(result).toMatchObject({ matched: true, match_id: MATCH_ID, match_created: true });
    expect(calls[0]).toEqual({
      method: 'rpc',
      args: ['submit_decision', { p_target_user_id: TARGET, p_decision: 'like' }],
    });
    expect(calls.some((call) => call.method === 'from')).toBe(false);
  });

  it('forwards optional trip context', async () => {
    const calls = useFake({
      data: {
        decision_id: DECISION_ID,
        decision: 'pass',
        matched: false,
        match_id: null,
        match_created: false,
      },
      error: null,
    });
    await submitDecision({ target_user_id: TARGET, decision: 'pass', source_trip_id: TRIP });
    expect(calls[0]?.args[1]).toEqual({
      p_target_user_id: TARGET,
      p_decision: 'pass',
      p_source_trip_id: TRIP,
    });
  });

  it('rejects invalid input before calling Supabase', async () => {
    const calls = useFake({ data: null, error: null });
    await expect(submitDecision({ target_user_id: 'bad', decision: 'like' })).rejects.toMatchObject(
      { code: 'invalid_input' },
    );
    expect(calls).toHaveLength(0);
  });

  it('maps server errors to typed codes', async () => {
    useFake({ data: null, error: { code: 'P0002', message: 'user not found' } });
    await expect(
      submitDecision({ target_user_id: TARGET, decision: 'like' }),
    ).rejects.toMatchObject({ code: 'user_not_found' });
    useFake({
      data: null,
      error: { code: '22023', message: 'cannot make a decision about yourself' },
    });
    await expect(
      submitDecision({ target_user_id: TARGET, decision: 'like' }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    useFake({ data: null, error: { code: '42501', message: 'not authenticated' } });
    await expect(
      submitDecision({ target_user_id: TARGET, decision: 'like' }),
    ).rejects.toMatchObject({ code: 'not_allowed' });
  });

  it('maps a blocked pair to the generic unavailable code (no direction)', async () => {
    useFake({ data: null, error: { code: '42501', message: 'interaction unavailable' } });
    await expect(
      submitDecision({ target_user_id: TARGET, decision: 'like' }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('rejects unexpected response shapes', async () => {
    useFake({ data: { matched: 'yes' }, error: null });
    await expect(
      submitDecision({ target_user_id: TARGET, decision: 'like' }),
    ).rejects.toMatchObject({ code: 'unexpected_response' });
  });

  it('reads only outgoing decisions (actor = session user)', async () => {
    const calls = useFake({ data: [], error: null });
    await fetchOwnDecisions(USER_ID);
    expect(calls).toContainEqual({ method: 'from', args: ['user_decisions'] });
    expect(calls).toContainEqual({ method: 'eq', args: ['actor_user_id', USER_ID] });
    expect(calls.some((call) => call.method === 'eq' && call.args[0] === 'target_user_id')).toBe(
      false,
    );
  });
});
