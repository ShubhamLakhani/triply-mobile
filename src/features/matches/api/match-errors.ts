export type MatchErrorCode =
  'not_authenticated' | 'invalid_input' | 'not_found' | 'not_allowed' | 'unknown';

/** Typed error for the matches data layer. `message` is safe to log. */
export class MatchError extends Error {
  readonly code: MatchErrorCode;

  constructor(code: MatchErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'MatchError';
    this.code = code;
  }
}

export function toMatchError(error: { code?: string }): MatchError {
  switch (error.code) {
    case 'P0002':
    case 'PGRST116':
      return new MatchError('not_found', 'Match not found.', { cause: error });
    case '42501':
      return new MatchError('not_allowed', 'Not allowed.', { cause: error });
    default:
      return new MatchError('unknown', 'Match request failed.', { cause: error });
  }
}
