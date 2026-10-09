# features/trips

The signed-in user's own trips (`public.trips`; see `supabase/README.md → Destinations + trips`).

- `api/trip-api.ts`: `fetchOwnTrips`, `fetchOwnTripById`, `createTrip`, `updateTrip`, `cancelTrip`
  (explicit columns + embedded destination via `TRIP_SELECT`)
- `api/trip-keys.ts`: `tripKeys.own(userId)`, `tripKeys.detail(userId, tripId)` (detail nested under own)
- `api/trip-errors.ts`: `TripError` codes mapped from database errors
- `hooks/use-trips.ts`: `useOwnTrips`, `useOwnTrip`, `useCreateTrip`, `useUpdateTrip`, `useCancelTrip`
- `schemas/trip.schema.ts`: Zod schemas (UX mirror of database rules)

Rules: cancel, don't delete (`cancelled` is terminal). Status is not editable except
cancellation, and visibility is owner-controlled. `trip.destination` can be `null` if the
destination was deactivated. Server state lives only in TanStack Query.
