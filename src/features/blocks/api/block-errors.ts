export type BlockErrorCode =
  | 'not_authenticated'
  | 'invalid_input'
  | 'user_not_found'
  | 'not_allowed'
  | 'unexpected_response'
  | 'unknown';

/** Typed error for the blocks data layer. `message` is safe to log. */
export class BlockError extends Error {
  readonly code: BlockErrorCode;

  constructor(code: BlockErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BlockError';
    this.code = code;
  }
}

export function toBlockError(error: { code?: string }): BlockError {
  switch (error.code) {
    case '22023':
      return new BlockError('invalid_input', 'Block request was rejected.', { cause: error });
    case 'P0002':
      return new BlockError('user_not_found', 'User not found.', { cause: error });
    case '42501':
      return new BlockError('not_allowed', 'Not allowed.', { cause: error });
    default:
      return new BlockError('unknown', 'Block request failed.', { cause: error });
  }
}
