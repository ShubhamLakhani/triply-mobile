import { getSupabaseClient } from '@/services/supabase';

import { createFakeSupabase, type FakeResult } from '../../../../tests/utils/fake-supabase';

import {
  fetchOwnGenderPreferences,
  setGenderPreferences,
  updateDiscoveryPreferences,
} from './preference-api';
import { PreferenceError } from './preference-errors';

jest.mock('@/services/supabase', () => ({ getSupabaseClient: jest.fn() }));

const USER_ID = '5f0c1c1e-5a8b-4f6e-9c7d-2b1f0e3a4d5c';

function useFake(result: FakeResult) {
  const { client, calls } = createFakeSupabase(result);
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
  return calls;
}

describe('preference api', () => {
  it('updates only validated preference fields for the session user', async () => {
    const calls = useFake({ data: { user_id: USER_ID }, error: null });
    await updateDiscoveryPreferences(USER_ID, { min_age: 25, max_age: 35 });
    expect(calls).toContainEqual({ method: 'update', args: [{ min_age: 25, max_age: 35 }] });
    expect(calls).toContainEqual({ method: 'eq', args: ['user_id', USER_ID] });
  });

  it('rejects invalid or empty preference updates before calling Supabase', async () => {
    const calls = useFake({ data: null, error: null });
    await expect(updateDiscoveryPreferences(USER_ID, { min_age: 16 })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    await expect(updateDiscoveryPreferences(USER_ID, {})).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(calls).toHaveLength(0);
  });

  it('reads gender preferences as typed values', async () => {
    useFake({ data: [{ gender: 'man' }, { gender: 'woman' }], error: null });
    await expect(fetchOwnGenderPreferences(USER_ID)).resolves.toEqual(['man', 'woman']);
  });

  it('replaces gender preferences atomically through the RPC', async () => {
    const calls = useFake({ data: [{ gender: 'woman' }], error: null });
    await expect(setGenderPreferences(['woman', 'woman'])).resolves.toEqual(['woman']);
    expect(calls).toEqual([
      { method: 'rpc', args: ['set_discovery_gender_preferences', { p_genders: ['woman'] }] },
    ]);
    await expect(setGenderPreferences(['everyone'] as never)).rejects.toMatchObject({
      code: 'invalid_input',
    });
  });

  it('maps database errors', async () => {
    useFake({ data: null, error: { code: '23514', message: 'check' } });
    const error = await updateDiscoveryPreferences(USER_ID, { max_age: 50 }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PreferenceError);
    expect(error).toMatchObject({ code: 'rejected_by_database' });
  });
});
