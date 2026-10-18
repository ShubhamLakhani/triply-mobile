export type AccountErrorCode =
  'not_authenticated' | 'not_found' | 'unexpected_response' | 'unknown';

/** Typed error for the account-state data layer. `message` is safe to log. */
export class AccountError extends Error {
  readonly code: AccountErrorCode;

  constructor(code: AccountErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AccountError';
    this.code = code;
  }
}

export function toAccountError(error: { code?: string }): AccountError {
  switch (error.code) {
    case '42501':
      return new AccountError('not_authenticated', 'Not signed in.', { cause: error });
    case 'P0002':
    case 'PGRST116':
      return new AccountError('not_found', 'Account state not found.', { cause: error });
    default:
      return new AccountError('unknown', 'Account state request failed.', { cause: error });
  }
}

/** True for any typed feature error (or raw Postgres error) meaning "your account is inactive". */
export { isAccountInactiveFailure as isAccountInactiveError } from '@/services/query/query-client';
