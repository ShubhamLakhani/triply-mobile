export type InterestErrorCode =
  | 'not_authenticated'
  | 'invalid_input'
  | 'limit_reached'
  | 'already_selected'
  | 'interest_unavailable'
  | 'not_allowed'
  | 'unknown';

/** Typed error for the interests data layer. `message` is safe to log. */
export class InterestError extends Error {
  readonly code: InterestErrorCode;

  constructor(code: InterestErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'InterestError';
    this.code = code;
  }
}

export function toInterestError(error: { code?: string }): InterestError {
  switch (error.code) {
    case '23514':
      return new InterestError('limit_reached', 'Interest limit reached.', { cause: error });
    case '23505':
      return new InterestError('already_selected', 'Interest already selected.', { cause: error });
    case '23503':
      return new InterestError('interest_unavailable', 'That interest is not available.', {
        cause: error,
      });
    case '22023':
      return new InterestError('invalid_input', 'Interest input is invalid.', { cause: error });
    case '42501':
      return new InterestError('not_allowed', 'This interest change is not allowed.', {
        cause: error,
      });
    default:
      return new InterestError('unknown', 'Interest request failed.', { cause: error });
  }
}
