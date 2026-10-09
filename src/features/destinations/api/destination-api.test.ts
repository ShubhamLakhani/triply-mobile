import { getSupabaseClient } from '@/services/supabase';

import { createFakeSupabase, type FakeResult } from '../../../../tests/utils/fake-supabase';

import {
  DESTINATION_COLUMNS,
  DestinationError,
  fetchActiveDestinations,
  fetchDestinationBySlug,
} from './destination-api';

jest.mock('@/services/supabase', () => ({ getSupabaseClient: jest.fn() }));

function useFake(result: FakeResult) {
  const { client, calls } = createFakeSupabase(result);
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
  return calls;
}

describe('destination api', () => {
  it('lists destinations alphabetically with an explicit column list', async () => {
    const calls = useFake({ data: [{ slug: 'bali' }], error: null });
    await expect(fetchActiveDestinations()).resolves.toEqual([{ slug: 'bali' }]);
    expect(calls).toEqual([
      { method: 'from', args: ['destinations'] },
      { method: 'select', args: [DESTINATION_COLUMNS] },
      { method: 'order', args: ['city_name', { ascending: true }] },
    ]);
    expect(DESTINATION_COLUMNS).not.toContain('active');
  });

  it('looks up a destination by slug and returns null when unknown', async () => {
    const calls = useFake({ data: null, error: null });
    await expect(fetchDestinationBySlug('atlantis')).resolves.toBeNull();
    expect(calls).toContainEqual({ method: 'eq', args: ['slug', 'atlantis'] });
  });

  it('wraps database errors', async () => {
    useFake({ data: null, error: { code: '42501', message: 'permission denied' } });
    await expect(fetchActiveDestinations()).rejects.toBeInstanceOf(DestinationError);
  });
});
