import type { DestinationSummary } from '@/features/destinations/types';
import type { Tables } from '@/services/supabase';

/** Trip row (generated types; never hand-written). */
export type Trip = Tables<'trips'>;

/** Values allowed by the trips_status_valid CHECK constraint. */
export const TRIP_STATUSES = ['planned', 'active', 'completed', 'cancelled'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

/** Values allowed by the trips_visibility_valid CHECK constraint. */
export const TRIP_VISIBILITIES = ['discoverable', 'hidden'] as const;
export type TripVisibility = (typeof TRIP_VISIBILITIES)[number];

/**
 * Trip with its destination embedded. `destination` is null when the destination has since
 * been deactivated (RLS hides inactive catalog rows), so UI must handle that state.
 */
export type TripWithDestination = Trip & { destination: DestinationSummary | null };

export function isTripStatus(value: string): value is TripStatus {
  return (TRIP_STATUSES as readonly string[]).includes(value);
}
