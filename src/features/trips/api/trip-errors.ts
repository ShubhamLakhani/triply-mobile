export type TripErrorCode =
  | 'not_authenticated'
  | 'not_found'
  | 'invalid_input'
  | 'destination_unavailable'
  | 'trip_cancelled'
  | 'not_allowed'
  | 'rejected_by_database'
  | 'unknown';

/** Typed error for the trip data layer. `message` is safe to log (no user content). */
export class TripError extends Error {
  readonly code: TripErrorCode;

  constructor(code: TripErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TripError';
    this.code = code;
  }
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

/** Maps Postgres / PostgREST codes raised by the trips migration to stable app codes. */
export function toTripError(error: PostgrestLikeError): TripError {
  switch (error.code) {
    case 'PGRST116':
      return new TripError('not_found', 'Trip not found.', { cause: error });
    case '23503':
      return new TripError('destination_unavailable', 'That destination is not available.', {
        cause: error,
      });
    case '55000':
      return new TripError('trip_cancelled', 'Cancelled trips cannot be changed.', {
        cause: error,
      });
    case '42501':
      return new TripError('not_allowed', 'This trip change is not allowed.', { cause: error });
    case '23514':
      return new TripError('rejected_by_database', 'Trip details were rejected.', { cause: error });
    default:
      return new TripError('unknown', 'Trip request failed.', { cause: error });
  }
}
