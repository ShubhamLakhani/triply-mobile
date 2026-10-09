import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cancelTrip,
  createTrip,
  fetchOwnTripById,
  fetchOwnTrips,
  updateTrip,
} from '../api/trip-api';
import { TripError } from '../api/trip-errors';
import { tripKeys } from '../api/trip-keys';
import type { CreateTripInput, UpdateTripInput } from '../schemas/trip.schema';
import type { TripWithDestination } from '../types';

function requireUser(userId: string | null): string {
  if (!userId) throw new TripError('not_authenticated', 'Not signed in.');
  return userId;
}

/** Signed-in user's trips (soonest first). Disabled while signed out. */
export function useOwnTrips(userId: string | null) {
  return useQuery({
    queryKey: tripKeys.own(userId ?? 'signed-out'),
    queryFn: () => fetchOwnTrips(requireUser(userId)),
    enabled: userId !== null,
  });
}

/** One own trip; `data` is null when it does not exist or is not the caller's. */
export function useOwnTrip(userId: string | null, tripId: string | null) {
  return useQuery({
    queryKey: tripKeys.detail(userId ?? 'signed-out', tripId ?? ''),
    queryFn: () => fetchOwnTripById(requireUser(userId), tripId ?? ''),
    enabled: userId !== null && tripId !== null && tripId !== '',
  });
}

/** Shared success handling: seed the detail cache, then refresh the list (and details). */
function useTripCacheSync(userId: string | null) {
  const queryClient = useQueryClient();
  return async (trip: TripWithDestination) => {
    queryClient.setQueryData(tripKeys.detail(trip.user_id, trip.id), trip);
    await queryClient.invalidateQueries({ queryKey: tripKeys.own(userId ?? trip.user_id) });
  };
}

export function useCreateTrip(userId: string | null) {
  const onSuccess = useTripCacheSync(userId);
  return useMutation<TripWithDestination, TripError | Error, CreateTripInput>({
    mutationFn: (input) => createTrip(requireUser(userId), input),
    onSuccess,
  });
}

export function useUpdateTrip(userId: string | null) {
  const onSuccess = useTripCacheSync(userId);
  return useMutation<
    TripWithDestination,
    TripError | Error,
    { tripId: string; input: UpdateTripInput }
  >({
    mutationFn: ({ tripId, input }) => updateTrip(requireUser(userId), tripId, input),
    onSuccess,
  });
}

export function useCancelTrip(userId: string | null) {
  const onSuccess = useTripCacheSync(userId);
  return useMutation<TripWithDestination, TripError | Error, string>({
    mutationFn: (tripId) => cancelTrip(requireUser(userId), tripId),
    onSuccess,
  });
}
