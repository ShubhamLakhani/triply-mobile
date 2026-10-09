import { getSupabaseClient } from '@/services/supabase';

import { createFakeSupabase, type FakeResult } from '../../../../tests/utils/fake-supabase';

import {
  addInterest,
  fetchActiveInterests,
  fetchOwnInterests,
  INTEREST_COLUMNS,
  OWN_INTEREST_SELECT,
  removeInterest,
  replaceOwnInterests,
} from './interest-api';
import { InterestError } from './interest-errors';

jest.mock('@/services/supabase', () => ({ getSupabaseClient: jest.fn() }));

const USER_ID = '5f0c1c1e-5a8b-4f6e-9c7d-2b1f0e3a4d5c';
const INTEREST_ID = 'e0000000-0000-4000-8000-000000000001';

function useFake(result: FakeResult) {
  const { client, calls } = createFakeSupabase(result);
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
  return calls;
}

describe('interest api', () => {
  it('reads the active catalog and own selections with explicit columns', async () => {
    let calls = useFake({ data: [], error: null });
    await fetchActiveInterests();
    expect(calls[1]).toEqual({ method: 'select', args: [INTEREST_COLUMNS] });

    calls = useFake({ data: [], error: null });
    await fetchOwnInterests(USER_ID);
    expect(calls).toContainEqual({ method: 'select', args: [OWN_INTEREST_SELECT] });
    expect(calls).toContainEqual({ method: 'eq', args: ['user_id', USER_ID] });
  });

  it('adds and removes a single interest for the session user', async () => {
    let calls = useFake({ data: null, error: null });
    await addInterest(USER_ID, INTEREST_ID);
    expect(calls).toContainEqual({
      method: 'insert',
      args: [{ user_id: USER_ID, interest_id: INTEREST_ID }],
    });

    calls = useFake({ data: null, error: null });
    await removeInterest(USER_ID, INTEREST_ID);
    expect(calls).toEqual([
      { method: 'from', args: ['profile_interests'] },
      { method: 'delete', args: [] },
      { method: 'eq', args: ['user_id', USER_ID] },
      { method: 'eq', args: ['interest_id', INTEREST_ID] },
    ]);
  });

  it('replaces the selection atomically through the RPC', async () => {
    const calls = useFake({ data: [{ interest_id: INTEREST_ID }], error: null });
    await expect(replaceOwnInterests([INTEREST_ID, INTEREST_ID])).resolves.toEqual([INTEREST_ID]);
    expect(calls).toEqual([
      { method: 'rpc', args: ['replace_profile_interests', { p_interest_ids: [INTEREST_ID] }] },
    ]);
  });

  it('validates input before calling Supabase', async () => {
    const calls = useFake({ data: null, error: null });
    await expect(addInterest(USER_ID, 'hiking')).rejects.toMatchObject({ code: 'invalid_input' });
    const eleven = Array.from(
      { length: 11 },
      (_, i) => `e0000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    await expect(replaceOwnInterests(eleven)).rejects.toMatchObject({ code: 'invalid_input' });
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['23514', 'limit_reached'],
    ['23505', 'already_selected'],
    ['23503', 'interest_unavailable'],
    ['42501', 'not_allowed'],
  ])('maps database error %s to %s', async (code, expected) => {
    useFake({ data: null, error: { code, message: 'db error' } });
    const error = await addInterest(USER_ID, INTEREST_ID).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InterestError);
    expect(error).toMatchObject({ code: expected });
  });
});
