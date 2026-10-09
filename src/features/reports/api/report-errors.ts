export type ReportErrorCode =
  | 'not_authenticated'
  | 'invalid_input'
  | 'user_not_found'
  | 'not_allowed'
  | 'unexpected_response'
  | 'unknown';

/** Typed error for the reports data layer. `message` is safe to log (never includes details). */
export class ReportError extends Error {
  readonly code: ReportErrorCode;

  constructor(code: ReportErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ReportError';
    this.code = code;
  }
}

export function toReportError(error: { code?: string }): ReportError {
  switch (error.code) {
    case '22023':
      return new ReportError('invalid_input', 'Report was rejected.', { cause: error });
    case 'P0002':
      return new ReportError('user_not_found', 'User not found.', { cause: error });
    case '42501':
      return new ReportError('not_allowed', 'Not allowed.', { cause: error });
    default:
      return new ReportError('unknown', 'Report request failed.', { cause: error });
  }
}
