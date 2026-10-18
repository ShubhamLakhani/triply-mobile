import { getErrorDetails, TRIPLY_SQLSTATE } from '@/services/supabase/sqlstate';

export type ProfileErrorCode =
  | 'not_authenticated'
  | 'not_found'
  | 'invalid_input'
  | 'rejected_by_database'
  | 'under_18'
  | 'date_of_birth_locked'
  | 'core_profile_required'
  | 'account_inactive'
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
  details?: string;
}

/** Maps PostgREST / Postgres error codes (+ Triply `details` keys) to stable app-level codes. */
export function toProfileError(error: PostgrestLikeError): ProfileError {
  const details = getErrorDetails(error);
  switch (error.code) {
    case 'PGRST116':
      return new ProfileError('not_found', 'Profile not found.', { cause: error });
    case '23514':
      if (details === 'date_of_birth_under_18') {
        return new ProfileError('under_18', 'Date of birth is under 18.', { cause: error });
      }
      return new ProfileError('rejected_by_database', 'Profile change was rejected.', {
        cause: error,
      });
    case TRIPLY_SQLSTATE.blockedAfterOnboarding:
      return details === 'date_of_birth_locked'
        ? new ProfileError('date_of_birth_locked', 'Date of birth is locked.', { cause: error })
        : new ProfileError('core_profile_required', 'Required profile field.', { cause: error });
    case TRIPLY_SQLSTATE.accountInactive:
      return new ProfileError('account_inactive', 'Account is not active.', { cause: error });
    case '42501':
      return new ProfileError('forbidden', 'Not allowed to change this profile field.', {
        cause: error,
      });
    default:
      return new ProfileError('unknown', 'Profile request failed.', { cause: error });
  }
}
