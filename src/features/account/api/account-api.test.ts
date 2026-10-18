import { getSupabaseClient } from '@/services/supabase';

import { createFakeSupabase, type FakeResult } from '../../../../tests/utils/fake-supabase';

import { fetchOwnAccountState } from './account-api';
import { isAccountInactiveError } from './account-errors';

jest.mock('@/services/supabase', () => ({ getSupabaseClient: jest.fn() }));

function useFake(result: FakeResult) {
  const { client, calls } = createFakeSupabase(result);
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
  return calls;
}

describe('account api', () => {
  it('reads only the own effective state through the RPC (never the table)', async () => {
    const calls = useFake({ data: { status: 'active', suspended_until: null }, error: null });
    await expect(fetchOwnAccountState()).resolves.toEqual({
      status: 'active',
      suspended_until: null,
    });
    expect(calls).toEqual([
      { method: 'rpc', args: ['get_my_account_state', undefined] },
      { method: 'single', args: [] },
    ]);
  });

  it('rejects unknown statuses instead of treating them as active', async () => {
    useFake({ data: { status: 'frozen', suspended_until: null }, error: null });
    await expect(fetchOwnAccountState()).rejects.toMatchObject({ code: 'unexpected_response' });
  });

  it('maps a missing state and an anonymous caller to typed errors', async () => {
    useFake({ data: null, error: { code: 'P0002', message: 'account state not found' } });
    await expect(fetchOwnAccountState()).rejects.toMatchObject({ code: 'not_found' });
    useFake({ data: null, error: { code: '42501', message: 'not authenticated' } });
    await expect(fetchOwnAccountState()).rejects.toMatchObject({ code: 'not_authenticated' });
  });

  it('recognises account_inactive feature errors and raw TR001', () => {
    expect(isAccountInactiveError({ code: 'account_inactive' })).toBe(true);
    expect(isAccountInactiveError({ code: 'TR001' })).toBe(true);
    expect(isAccountInactiveError({ code: 'TR003' })).toBe(false);
    expect(isAccountInactiveError(new Error('x'))).toBe(false);
  });
});
