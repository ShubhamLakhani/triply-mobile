import { getSupabaseClient } from '@/services/supabase';

import { createFakeSupabase, type FakeResult } from '../../../../tests/utils/fake-supabase';

import {
  cancelTrip,
  createTrip,
  fetchOwnTripById,
  fetchOwnTrips,
  TRIP_SELECT,
  updateTrip,
} from './trip-api';
import { TripError } from './trip-errors';

jest.mock('@/services/supabase', () => ({ getSupabaseClient: jest.fn() }));

const USER_ID = '5f0c1c1e-5a8b-4f6e-9c7d-2b1f0e3a4d5c';
const TRIP_ID = '8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d';
const DESTINATION_ID = '3f1c2a9e-7b4d-4c1e-9a2b-5d6e7f8a9b0c';

function useFake(result: FakeResult) {
  const { client, calls } = createFakeSupabase(result);
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
  return calls;
}

describe('trip api', () => {
  it('lists own trips with the embedded destination, soonest first', async () => {
    const calls = useFake({ data: [], error: null });
    await expect(fetchOwnTrips(USER_ID)).resolves.toEqual([]);
    expect(calls).toEqual([
      { method: 'from', args: ['trips'] },
      { method: 'select', args: [TRIP_SELECT] },
      { method: 'eq', args: ['user_id', USER_ID] },
      { method: 'order', args: ['start_date', { ascending: true }] },
      { method: 'order', args: ['created_at', { ascending: true }] },
    ]);
    expect(TRIP_SELECT).toContain('destination:destinations(');
  });

  it('returns null for a trip that is missing or not owned', async () => {
    const calls = useFake({ data: null, error: null });
    await expect(fetchOwnTripById(USER_ID, TRIP_ID)).resolves.toBeNull();
    expect(calls.map((c) => c.method)).toEqual(['from', 'select', 'eq', 'eq', 'maybeSingle']);
  });

  it('creates a trip owned by the session user with validated fields only', async () => {
    const calls = useFake({ data: { id: TRIP_ID }, error: null });
    await createTrip(USER_ID, {
      destination_id: DESTINATION_ID,
      start_date: '2026-12-04',
      end_date: '2026-12-12',
    });
    expect(calls.find((c) => c.method === 'insert')?.args).toEqual([
      {
        destination_id: DESTINATION_ID,
        start_date: '2026-12-04',
        end_date: '2026-12-12',
        user_id: USER_ID,
      },
    ]);
  });

  it('rejects invalid input before calling Supabase', async () => {
    const calls = useFake({ data: null, error: null });
    await expect(
      createTrip(USER_ID, {
        destination_id: DESTINATION_ID,
        start_date: '2026-12-12',
        end_date: '2026-12-01',
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(updateTrip(USER_ID, TRIP_ID, {})).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(
      updateTrip(USER_ID, TRIP_ID, { status: 'cancelled' } as never),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(calls).toHaveLength(0);
  });

  it('updates and cancels scoped to the owner and trip id', async () => {
    let calls = useFake({ data: { id: TRIP_ID }, error: null });
    await updateTrip(USER_ID, TRIP_ID, { visibility: 'hidden' });
    expect(calls.filter((c) => c.method !== 'select')).toEqual([
      { method: 'from', args: ['trips'] },
      { method: 'update', args: [{ visibility: 'hidden' }] },
      { method: 'eq', args: ['user_id', USER_ID] },
      { method: 'eq', args: ['id', TRIP_ID] },
      { method: 'single', args: [] },
    ]);

    calls = useFake({ data: { id: TRIP_ID }, error: null });
    await cancelTrip(USER_ID, TRIP_ID);
    expect(calls.find((c) => c.method === 'update')?.args).toEqual([{ status: 'cancelled' }]);
  });

  it.each([
    ['23503', 'destination_unavailable'],
    ['55000', 'trip_cancelled'],
    ['42501', 'not_allowed'],
    ['23514', 'rejected_by_database'],
    ['PGRST116', 'not_found'],
    ['XX000', 'unknown'],
  ])('maps database error %s to %s', async (code, expected) => {
    useFake({ data: null, error: { code, message: 'db error' } });
    const error = await cancelTrip(USER_ID, TRIP_ID).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TripError);
    expect(error).toMatchObject({ code: expected });
  });
});
