export type DecisionErrorCode =
  | 'not_authenticated'
  | 'invalid_input'
  | 'user_not_found'
  | 'not_allowed'
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

export function toDecisionError(error: { code?: string }): DecisionError {
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
