import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { cancelTrip, createTrip, fetchOwnTrips } from '../api/trip-api';
import { tripKeys } from '../api/trip-keys';
import type { TripWithDestination } from '../types';

import { useCancelTrip, useCreateTrip, useOwnTrips } from './use-trips';

jest.mock('../api/trip-api', () => ({
  cancelTrip: jest.fn(),
  createTrip: jest.fn(),
  fetchOwnTripById: jest.fn(),
  fetchOwnTrips: jest.fn(),
  updateTrip: jest.fn(),
}));

const USER_ID = '5f0c1c1e-5a8b-4f6e-9c7d-2b1f0e3a4d5c';

const trip: TripWithDestination = {
  id: '8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d',
  user_id: USER_ID,
  destination_id: '3f1c2a9e-7b4d-4c1e-9a2b-5d6e7f8a9b0c',
  start_date: '2026-12-04',
  end_date: '2026-12-12',
  status: 'planned',
  visibility: 'discoverable',
  created_at: '2026-10-09T00:00:00Z',
  updated_at: '2026-10-09T00:00:00Z',
  destination: {
    id: '3f1c2a9e-7b4d-4c1e-9a2b-5d6e7f8a9b0c',
    slug: 'bali',
    city_name: 'Bali',
    country_name: 'Indonesia',
    country_code: 'ID',
    latitude: -8.409518,
    longitude: 115.188919,
    timezone: 'Asia/Makassar',
    hero_image_url: null,
  },
};

function setup() {
  // gcTime: Infinity avoids lingering garbage-collection timers that keep Jest alive.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('trip hooks', () => {
  afterEach(() => jest.clearAllMocks());

  it('does not load trips while signed out', async () => {
    const { wrapper, queryClient } = setup();
    await renderHook(() => useOwnTrips(null), { wrapper });
    expect(fetchOwnTrips).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it('loads own trips under a user-scoped key', async () => {
    jest.mocked(fetchOwnTrips).mockResolvedValue([trip]);
    const { wrapper, queryClient } = setup();
    const { result } = await renderHook(() => useOwnTrips(USER_ID), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([trip]));
    expect(queryClient.getQueryData(tripKeys.own(USER_ID))).toEqual([trip]);
    queryClient.clear();
  });

  it('caches the created trip and invalidates the trip list', async () => {
    jest.mocked(createTrip).mockResolvedValue(trip);
    const { wrapper, queryClient } = setup();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useCreateTrip(USER_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        destination_id: trip.destination_id,
        start_date: trip.start_date,
        end_date: trip.end_date,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(tripKeys.detail(USER_ID, trip.id))).toEqual(trip);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripKeys.own(USER_ID) });
    queryClient.clear();
  });

  it('updates the cached trip after cancelling', async () => {
    const cancelled = { ...trip, status: 'cancelled' };
    jest.mocked(cancelTrip).mockResolvedValue(cancelled);
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(tripKeys.detail(USER_ID, trip.id), trip);
    const { result } = await renderHook(() => useCancelTrip(USER_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(trip.id);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(cancelTrip).toHaveBeenCalledWith(USER_ID, trip.id);
    expect(queryClient.getQueryData(tripKeys.detail(USER_ID, trip.id))).toEqual(cancelled);
    queryClient.clear();
  });

  it('rejects mutations while signed out without calling the API', async () => {
    const { wrapper, queryClient } = setup();
    const { result } = await renderHook(() => useCancelTrip(null), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(trip.id)).rejects.toMatchObject({
        code: 'not_authenticated',
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cancelTrip).not.toHaveBeenCalled();
    queryClient.clear();
  });
});
