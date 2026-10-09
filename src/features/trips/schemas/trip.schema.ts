import { z } from 'zod';

import { TRIP_VISIBILITIES } from '../types';

const END_BEFORE_START = 'End date must be on or after the start date.';

/** ISO calendar date within the database's sanity bounds (2000-01-01 … 2100-12-31). */
const tripDateSchema = z.iso
  .date({ message: 'Choose a valid date.' })
  .refine((value) => value >= '2000-01-01' && value <= '2100-12-31', 'Choose a valid date.');

/**
 * New trip. Past dates are allowed (the database allows them; discovery filters later).
 * user_id is never accepted from input — it comes from the session.
 */
export const createTripSchema = z
  .object({
    destination_id: z.uuid({ message: 'Choose a destination.' }),
    start_date: tripDateSchema,
    end_date: tripDateSchema,
    visibility: z.enum(TRIP_VISIBILITIES).optional(),
  })
  .strict()
  .refine((trip) => trip.end_date >= trip.start_date, {
    message: END_BEFORE_START,
    path: ['end_date'],
  });

/**
 * Editable trip fields. Status is not editable here: the only client status change is
 * cancellation (cancelTrip). Protected columns are rejected by `.strict()`.
 * When only one date changes, the database validates it against the stored date.
 */
export const updateTripSchema = z
  .object({
    destination_id: z.uuid({ message: 'Choose a destination.' }),
    start_date: tripDateSchema,
    end_date: tripDateSchema,
    visibility: z.enum(TRIP_VISIBILITIES),
  })
  .partial()
  .strict()
  .refine((trip) => !trip.start_date || !trip.end_date || trip.end_date >= trip.start_date, {
    message: END_BEFORE_START,
    path: ['end_date'],
  });

export type CreateTripInput = z.input<typeof createTripSchema>;
export type UpdateTripInput = z.input<typeof updateTripSchema>;
