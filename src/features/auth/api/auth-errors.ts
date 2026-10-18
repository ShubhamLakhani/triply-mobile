import { isTimeoutError } from '@/utils/timeout';

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'email_taken'
  | 'weak_password'
  | 'rate_limited'
  | 'invalid_input'
  | 'email_undeliverable'
  | 'signup_disabled'
  | 'network'
  | 'timeout'
  | 'link_expired'
  | 'link_invalid'
  | 'unknown';

/** Typed, user-safe auth error. `message` is a fixed sentence; the raw error stays in `cause`. */
export class AppAuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AppAuthError';
    this.code = code;
  }
}

const MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials: 'That email and password don’t match.',
  email_not_confirmed: 'Please confirm your email first. Check your inbox for the link.',
  email_taken: 'An account with this email already exists. Try signing in.',
  weak_password: 'Choose a stronger password (at least 8 characters).',
  rate_limited: 'Too many attempts. Please wait a moment and try again.',
  invalid_input: 'Check your email and password and try again.',
  email_undeliverable: 'We couldn’t send an email to that address. Try a different email.',
  signup_disabled: 'New sign-ups are paused right now. Please try again later.',
  network: 'You seem to be offline. Check your connection and try again.',
  timeout: 'This is taking longer than it should. Check your connection and try again.',
  link_expired:
    'That link has expired or was already used. Sign in, or create your account again to get a new link.',
  link_invalid:
    'We couldn’t sign you in from that link. If you’ve confirmed your email, sign in to continue.',
  unknown: 'Something went wrong. Please try again.',
};

export function authError(code: AuthErrorCode, cause?: unknown): AppAuthError {
  return new AppAuthError(code, MESSAGES[code], { cause });
}

interface SupabaseAuthErrorLike {
  code?: string;
  status?: number;
  name?: string;
  message?: string;
}

/**
 * Maps Supabase Auth errors (by stable `code`, then status) to app codes. Never leaks raw text.
 * App-level timeouts (utils/timeout) map to `timeout`.
 */
export function toAuthError(error: unknown): AppAuthError {
  if (error instanceof AppAuthError) return error;
  if (isTimeoutError(error)) return authError('timeout', error);
  const like: SupabaseAuthErrorLike = typeof error === 'object' && error !== null ? error : {};
  switch (like.code) {
    case 'invalid_credentials':
      return authError('invalid_credentials', error);
    case 'email_not_confirmed':
      return authError('email_not_confirmed', error);
    case 'user_already_exists':
    case 'email_exists':
      return authError('email_taken', error);
    case 'weak_password':
      return authError('weak_password', error);
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return authError('rate_limited', error);
    case 'validation_failed':
      return authError('invalid_input', error);
    case 'email_address_not_authorized':
    case 'email_address_invalid':
      return authError('email_undeliverable', error);
    case 'signup_disabled':
    case 'email_provider_disabled':
      return authError('signup_disabled', error);
    case 'request_timeout':
    case 'hook_timeout':
    case 'hook_timeout_after_retry':
      return authError('timeout', error);
    case 'otp_expired':
    case 'flow_state_expired':
      return authError('link_expired', error);
    case 'flow_state_not_found':
    case 'bad_code_verifier':
    case 'pkce_code_verifier_not_found':
      return authError('link_invalid', error);
    default:
      break;
  }
  if (like.name === 'AuthRetryableFetchError' || like.status === 0) {
    return authError('network', error);
  }
  if (like.status === 429) return authError('rate_limited', error);
  if (like.status === 400 || like.status === 422) return authError('invalid_input', error);
  return authError('unknown', error);
}
