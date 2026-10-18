import { TRIPLY_SQLSTATE } from '@/services/supabase/sqlstate';

export type PreferenceErrorCode =
  | 'not_authenticated'
  | 'gender_required'
  | 'account_inactive'
  | 'not_found'
  | 'invalid_input'
  | 'rejected_by_database'
  | 'not_allowed'
  | 'unknown';

/** Typed error for the preferences data layer. `message` is safe to log. */
export class PreferenceError extends Error {
  readonly code: PreferenceErrorCode;

  constructor(code: PreferenceErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PreferenceError';
    this.code = code;
  }
}

export function toPreferenceError(error: { code?: string }): PreferenceError {
  switch (error.code) {
    case 'PGRST116':
      return new PreferenceError('not_found', 'Preferences not found.', { cause: error });
    case '23514':
    case '22023':
      return new PreferenceError('rejected_by_database', 'Preferences were rejected.', {
        cause: error,
      });
    case TRIPLY_SQLSTATE.blockedAfterOnboarding:
      return new PreferenceError('gender_required', 'At least one gender preference is required.', {
        cause: error,
      });
    case TRIPLY_SQLSTATE.accountInactive:
      return new PreferenceError('account_inactive', 'Account is not active.', { cause: error });
    case '42501':
      return new PreferenceError('not_allowed', 'This preference change is not allowed.', {
        cause: error,
      });
    default:
      return new PreferenceError('unknown', 'Preference request failed.', { cause: error });
  }
}
