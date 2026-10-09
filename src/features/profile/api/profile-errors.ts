export type ProfileErrorCode =
  | 'not_authenticated'
  | 'not_found'
  | 'invalid_input'
  | 'rejected_by_database'
  | 'forbidden'
  | 'unknown';

/** Typed error for the profile data layer. `message` is safe to log (no user content). */
export class ProfileError extends Error {
  readonly code: ProfileErrorCode;

  constructor(code: ProfileErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ProfileError';
    this.code = code;
  }
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

/** Maps PostgREST / Postgres error codes to stable app-level codes. */
export function toProfileError(error: PostgrestLikeError): ProfileError {
  switch (error.code) {
    case 'PGRST116':
      return new ProfileError('not_found', 'Profile not found.', { cause: error });
    case '23514':
      return new ProfileError('rejected_by_database', 'Profile change was rejected.', {
        cause: error,
      });
    case '42501':
      return new ProfileError('forbidden', 'Not allowed to change this profile field.', {
        cause: error,
      });
    default:
      return new ProfileError('unknown', 'Profile request failed.', { cause: error });
  }
}
