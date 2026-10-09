export type DecisionErrorCode =
  | 'not_authenticated'
  | 'invalid_input'
  | 'user_not_found'
  | 'not_allowed'
  /** The pair cannot interact (a block exists in either direction; never says which). */
  | 'unavailable'
  /** The caller's own profile is not complete (18+ gate), Phase 1M-H. */
  | 'profile_incomplete'
  | 'unexpected_response'
  | 'unknown';

/** Typed error for the decisions data layer. `message` is safe to log. */
export class DecisionError extends Error {
  readonly code: DecisionErrorCode;

  constructor(code: DecisionErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DecisionError';
    this.code = code;
  }
}

/** Exact server message for a blocked pair (submit_decision, Phase 1M-F). */
export const INTERACTION_UNAVAILABLE_MESSAGE = 'interaction unavailable';

/** Exact server message when the caller's profile is incomplete (submit_decision, Phase 1M-H). */
export const PROFILE_INCOMPLETE_MESSAGE = 'complete your profile first';

export function toDecisionError(error: { code?: string; message?: string }): DecisionError {
  if (error.code === '42501' && error.message === INTERACTION_UNAVAILABLE_MESSAGE) {
    return new DecisionError('unavailable', 'This person is unavailable.', { cause: error });
  }
  if (error.code === '42501' && error.message === PROFILE_INCOMPLETE_MESSAGE) {
    return new DecisionError('profile_incomplete', 'Complete your profile first.', {
      cause: error,
    });
  }
  switch (error.code) {
    case '22023':
      return new DecisionError('invalid_input', 'Decision was rejected.', { cause: error });
    case 'P0002':
      return new DecisionError('user_not_found', 'User not found.', { cause: error });
    case '42501':
      return new DecisionError('not_allowed', 'Not allowed.', { cause: error });
    default:
      return new DecisionError('unknown', 'Decision request failed.', { cause: error });
  }
}
