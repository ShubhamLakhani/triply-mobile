import { DESTINATION_COLUMNS } from '@/features/destinations/api/destination-api';
import { getSupabaseClient } from '@/services/supabase';

import {
  createTripSchema,
  updateTripSchema,
  type CreateTripInput,
  type UpdateTripInput,
} from '../schemas/trip.schema';
import type { TripWithDestination } from '../types';

import { TripError, toTripError } from './trip-errors';

/** Explicit columns + embedded destination (never `select *`). */
export const TRIP_SELECT =
  `id, user_id, destination_id, start_date, end_date, status, visibility, created_at, updated_at, destination:destinations(${DESTINATION_COLUMNS})` as const;

function invalidInput(cause: unknown): TripError {
  return new TripError('invalid_input', 'Trip input is invalid.', { cause });
}

/** Own trips, soonest first. RLS returns only the caller's rows. */
export async function fetchOwnTrips(userId: string): Promise<TripWithDestination[]> {
  const { data, error } = await getSupabaseClient()
    .from('trips')
    .select(TRIP_SELECT)
    .eq('user_id', userId)
    .order('start_date', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw toTripError(error);
  return data;
}

/** One own trip, or null when it does not exist / is not the caller's. */
export async function fetchOwnTripById(
  userId: string,
  tripId: string,
): Promise<TripWithDestination | null> {
  const { data, error } = await getSupabaseClient()
    .from('trips')
    .select(TRIP_SELECT)
    .eq('user_id', userId)
    .eq('id', tripId)
    .maybeSingle();
  if (error) throw toTripError(error);
  return data;
}

/** Creates a planned trip owned by the caller. */
export async function createTrip(
  userId: string,
  input: CreateTripInput,
): Promise<TripWithDestination> {
  const parsed = createTripSchema.safeParse(input);
  if (!parsed.success) throw invalidInput(parsed.error);

  const { data, error } = await getSupabaseClient()
    .from('trips')
    .insert({ ...parsed.data, user_id: userId })
    .select(TRIP_SELECT)
    .single();
  if (error) throw toTripError(error);
  return data;
}

/** Updates destination, dates and/or visibility of an own trip. */
export async function updateTrip(
  userId: string,
  tripId: string,
  input: UpdateTripInput,
): Promise<TripWithDestination> {
  const parsed = updateTripSchema.safeParse(input);
  if (!parsed.success) throw invalidInput(parsed.error);
  if (Object.keys(parsed.data).length === 0) throw invalidInput('No trip fields to update.');

  const { data, error } = await getSupabaseClient()
    .from('trips')
    .update(parsed.data)
    .eq('user_id', userId)
    .eq('id', tripId)
    .select(TRIP_SELECT)
    .single();
  if (error) throw toTripError(error);
  return data;
}

/** Cancels an own trip (terminal; trips are never deleted by the app). */
export async function cancelTrip(userId: string, tripId: string): Promise<TripWithDestination> {
  const { data, error } = await getSupabaseClient()
    .from('trips')
    .update({ status: 'cancelled' })
    .eq('user_id', userId)
    .eq('id', tripId)
    .select(TRIP_SELECT)
    .single();
  if (error) throw toTripError(error);
  return data;
}
