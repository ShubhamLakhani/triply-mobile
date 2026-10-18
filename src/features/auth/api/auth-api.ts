import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/services/supabase';
import { withTimeout } from '@/utils/timeout';

import {
  credentialsSchema,
  emailCodeInputSchema,
  emailSchema,
  passwordSchema,
  type CredentialsInput,
  type EmailCodeInput,
} from '../schemas/auth.schema';

import { AppAuthError, authError, toAuthError, toCodeError } from './auth-errors';

export type { AuthChangeEvent, Session, User };

/**
 * Budget for one auth request (sign up / sign in / resend / session restore). Generous enough
 * for Supabase to send a confirmation email on a slow network; after it the UI always settles
 * with a `timeout` AppAuthError. The transport aborts stalled sockets too (timeout-fetch.ts).
 */
export const AUTH_REQUEST_TIMEOUT_MS = 20_000;

/** Runs one Supabase Auth call under the auth time budget, mapping every failure to AppAuthError. */
async function authRequest<T extends { error: unknown }>(
  label: string,
  request: () => Promise<T>,
): Promise<T> {
  let result: T;
  try {
    result = await withTimeout(request(), AUTH_REQUEST_TIMEOUT_MS, label);
  } catch (cause) {
    throw toAuthError(cause);
  }
  if (result.error) throw toAuthError(result.error);
  return result;
}

/**
 * Locally persisted session (expo-sqlite localStorage), refreshed automatically while the
 * app is foregrounded. Use for routing decisions; do not trust it for authorization.
 * Throws AppAuthError `network` / `timeout` when a stored session exists but could not be
 * refreshed (offline cold start); the session is kept and can be restored later.
 */
export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await authRequest('Session restore', () =>
    getSupabaseClient().auth.getSession(),
  );
  return data.session;
}

/** Verifies the session with Supabase Auth (network). Returns null when signed out. */
export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await getSupabaseClient().auth.getUser();
  if (error) {
    if (error.name === 'AuthSessionMissingError') return null;
    throw error;
  }
  return data.user;
}

/** Subscribes to sign-in / sign-out / token refresh events. Returns an unsubscribe function. */
export function subscribeToAuthChanges(
  listener: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const {
    data: { subscription },
  } = getSupabaseClient().auth.onAuthStateChange(listener);
  return () => subscription.unsubscribe();
}

export interface SignUpResult {
  /** True when Supabase requires the 6-digit email code before a session exists. */
  needsEmailConfirmation: boolean;
  session: Session | null;
}

/** A code typed by the user plus when the newest code was requested here (null if unknown). */
export type CodeVerificationInput = EmailCodeInput & { sentAt: number | null };

/** Email + password sign-in. Resolves to the new session; throws a typed AppAuthError. */
export async function signInWithPassword(input: CredentialsInput): Promise<Session> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) throw authError('invalid_input', parsed.error);
  const { data } = await authRequest('Sign in', () =>
    getSupabaseClient().auth.signInWithPassword(parsed.data),
  );
  if (!data.session) throw authError('unknown');
  return data.session;
}

/**
 * Email + password sign-up. Supabase Auth requires email confirmation, so there is no session
 * yet: the confirmation email carries a 6-digit code (template uses {{ .Token }}) that the user
 * types into the app (`verifySignUpCode`). No link or redirect is involved.
 */
export async function signUpWithPassword(input: CredentialsInput): Promise<SignUpResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) throw authError('invalid_input', parsed.error);
  const { data } = await authRequest('Sign up', () => getSupabaseClient().auth.signUp(parsed.data));
  // Supabase returns a user with no identities when the email is already registered and
  // enumeration protection is on. Treat it as "enter your code" without revealing anything.
  return { needsEmailConfirmation: data.session === null, session: data.session };
}

/**
 * Confirms the sign-up with the emailed code. On success Supabase returns a session and the
 * SIGNED_IN event moves the user into onboarding.
 */
export async function verifySignUpCode(input: CodeVerificationInput): Promise<Session> {
  const parsed = emailCodeInputSchema.safeParse({ email: input.email, code: input.code });
  if (!parsed.success) throw authError('code_invalid', parsed.error);
  try {
    const { data } = await authRequest('Verify sign-up code', () =>
      getSupabaseClient().auth.verifyOtp({
        email: parsed.data.email,
        token: parsed.data.code,
        type: 'email',
      }),
    );
    if (!data.session) throw authError('unknown');
    return data.session;
  } catch (cause) {
    throw toCodeError(cause, input.sentAt);
  }
}

/** Sends a new sign-up code (invalidates the previous one; rate limited server-side). */
export async function resendSignUpCode(email: string): Promise<void> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) throw authError('invalid_input', parsed.error);
  await authRequest('Resend sign-up code', () =>
    getSupabaseClient().auth.resend({ type: 'signup', email: parsed.data }),
  );
}

/**
 * Emails a 6-digit recovery code. Supabase answers the same way whether or not the address
 * has an account, so this never reveals which emails are registered.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) throw authError('invalid_input', parsed.error);
  await authRequest('Request password reset', () =>
    getSupabaseClient().auth.resetPasswordForEmail(parsed.data),
  );
}

/**
 * Verifies the recovery code. Supabase then signs the user in and emits PASSWORD_RECOVERY;
 * AuthProvider keeps them on the reset screen until `updatePassword` succeeds.
 */
export async function verifyRecoveryCode(input: CodeVerificationInput): Promise<Session> {
  const parsed = emailCodeInputSchema.safeParse({ email: input.email, code: input.code });
  if (!parsed.success) throw authError('code_invalid', parsed.error);
  try {
    const { data } = await authRequest('Verify recovery code', () =>
      getSupabaseClient().auth.verifyOtp({
        email: parsed.data.email,
        token: parsed.data.code,
        type: 'recovery',
      }),
    );
    if (!data.session) throw authError('unknown');
    return data.session;
  } catch (cause) {
    throw toCodeError(cause, input.sentAt);
  }
}

/** Sets a new password for the signed-in user (after a verified recovery code). */
export async function updatePassword(password: string): Promise<void> {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) throw authError('weak_password', parsed.error);
  await authRequest('Update password', () =>
    getSupabaseClient().auth.updateUser({ password: parsed.data }),
  );
}

/**
 * Signs out and revokes the refresh token. auth-js removes the local session even when the
 * revoke request fails, so a network failure still signs this device out (the old refresh token
 * then simply expires server-side). Cache clearing happens via SIGNED_OUT.
 */
export async function signOut(): Promise<void> {
  try {
    await authRequest('Sign out', () => getSupabaseClient().auth.signOut());
  } catch (error) {
    if (error instanceof AppAuthError && (error.code === 'network' || error.code === 'timeout')) {
      return;
    }
    throw error;
  }
}
