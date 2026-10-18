import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

import { getSupabaseClient } from '@/services/supabase';
import { withTimeout } from '@/utils/timeout';

import { credentialsSchema, emailSchema, type CredentialsInput } from '../schemas/auth.schema';

import { AppAuthError, authError, toAuthError } from './auth-errors';
import { getAuthRedirectUrl } from './auth-links';

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
  /** True when Supabase requires the user to confirm the address before a session exists. */
  needsEmailConfirmation: boolean;
  session: Session | null;
}

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
 * Email + password sign-up. With "confirm email" enabled in Supabase Auth there is no session
 * until the link is opened; the UI shows a check-your-email state in that case.
 */
export async function signUpWithPassword(input: CredentialsInput): Promise<SignUpResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) throw authError('invalid_input', parsed.error);
  const { data } = await authRequest('Sign up', () =>
    getSupabaseClient().auth.signUp({
      ...parsed.data,
      // Confirmation emails deep-link back into this install variant (see auth-links.ts).
      options: { emailRedirectTo: getAuthRedirectUrl() },
    }),
  );
  // Supabase returns a user with no identities when the email is already registered and
  // enumeration protection is on. Treat it as "check your email" without revealing anything.
  return { needsEmailConfirmation: data.session === null, session: data.session };
}

/** Re-sends the sign-up confirmation email (rate limited server-side). */
export async function resendSignUpEmail(email: string): Promise<void> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) throw authError('invalid_input', parsed.error);
  await authRequest('Resend confirmation', () =>
    getSupabaseClient().auth.resend({
      type: 'signup',
      email: parsed.data,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    }),
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
