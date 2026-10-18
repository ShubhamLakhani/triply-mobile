import * as Linking from 'expo-linking';

import { getSupabaseClient, warmUpSupabaseConnection } from '@/services/supabase';
import { withTimeout } from '@/utils/timeout';

import { authError, toAuthError } from './auth-errors';

/** Path (inside the app scheme) Supabase redirects to after an email confirmation. */
export const AUTH_CALLBACK_PATH = 'auth/callback';

/** Budget for exchanging a callback code (one small request). */
export const AUTH_LINK_TIMEOUT_MS = 20_000;

/** Full redirect URL for the current install variant, e.g. triply-dev://auth/callback. */
export function getAuthRedirectUrl(): string {
  return Linking.createURL(AUTH_CALLBACK_PATH);
}

/**
 * What an incoming URL is, from the app's point of view:
 * - `null`: not an auth callback for this install (wrong scheme, host or path) — ignored.
 * - `code`: a PKCE authorization code (the only thing that can sign a user in).
 * - `error`: Supabase redirected back with an error (e.g. an expired link).
 * - `rejected`: a callback carrying anything else (raw tokens, a malformed code, nothing).
 */
export type ParsedAuthLink =
  | { kind: 'code'; code: string }
  | { kind: 'error'; errorCode: string | null }
  | { kind: 'rejected'; reason: 'raw_tokens' | 'malformed' | 'empty' };

// PKCE auth codes are opaque short strings (UUIDs today). Anything else is not ours.
const AUTH_CODE_PATTERN = /^[A-Za-z0-9._~-]{8,256}$/;

function parseParams(raw: string): Map<string, string> {
  const params = new Map<string, string>();
  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const separator = pair.indexOf('=');
    const rawKey = separator === -1 ? pair : pair.slice(0, separator);
    const rawValue = separator === -1 ? '' : pair.slice(separator + 1);
    try {
      const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      if (!params.has(key)) params.set(key, decodeURIComponent(rawValue.replace(/\+/g, ' ')));
    } catch {
      // Malformed percent-encoding: drop the pair.
    }
  }
  return params;
}

function normaliseBase(base: string): string {
  const trimmed = base.replace(/\/+$/, '');
  const schemeEnd = trimmed.indexOf('://');
  return schemeEnd === -1
    ? trimmed
    : `${trimmed.slice(0, schemeEnd).toLowerCase()}${trimmed.slice(schemeEnd)}`;
}

/**
 * Strictly parses a deep link. Only `<this install's scheme>://auth/callback` is considered;
 * query and fragment parameters are both read (Supabase uses either for errors).
 */
export function parseAuthLink(
  url: string,
  expectedBase: string = getAuthRedirectUrl(),
): ParsedAuthLink | null {
  const match = /^([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/.exec(url.trim());
  if (!match) return null;
  const [, base = '', query = '', fragment = ''] = match;
  if (normaliseBase(base) !== normaliseBase(expectedBase)) return null;

  const params = new Map([...parseParams(fragment), ...parseParams(query)]);
  if (params.has('error') || params.has('error_code') || params.has('error_description')) {
    return { kind: 'error', errorCode: params.get('error_code') ?? params.get('error') ?? null };
  }
  if (params.has('access_token') || params.has('refresh_token')) {
    return { kind: 'rejected', reason: 'raw_tokens' };
  }
  const code = params.get('code');
  if (code === undefined) return { kind: 'rejected', reason: 'empty' };
  if (!AUTH_CODE_PATTERN.test(code)) return { kind: 'rejected', reason: 'malformed' };
  return { kind: 'code', code };
}

export type AuthLinkResult = 'signed_in' | 'ignored' | 'already_signed_in';

// Codes are single-use; remember the ones handled in this process so a replayed initial URL
// (e.g. after the provider remounts) is not exchanged twice.
const handledCodes = new Set<string>();

/** Test-only: forget handled codes. */
export function resetHandledAuthLinks(): void {
  handledCodes.clear();
}

/**
 * Completes an email-confirmation deep link by exchanging its PKCE code with Supabase.
 * - Not an auth callback → `ignored`.
 * - A session already exists on this device → `already_signed_in` (never replaced by a link).
 * - Raw tokens, malformed or empty callbacks and provider errors → a typed AppAuthError
 *   (`link_invalid` / `link_expired`); raw provider text is never surfaced.
 * - Any failed exchange is final: auth-js discards the code verifier on every failure, so the
 *   link cannot be retried. Supabase has already confirmed the email by the time it redirects
 *   with a code, so a transient failure becomes `link_invalid` ("sign in to continue"), never
 *   a misleading "you're offline, try again".
 * Tokens and codes are never logged or stored by the app.
 */
export async function completeAuthLink(url: string): Promise<AuthLinkResult> {
  const parsed = parseAuthLink(url);
  if (!parsed) return 'ignored';
  if (parsed.kind === 'error') {
    throw authError(
      parsed.errorCode === 'otp_expired' || parsed.errorCode === 'flow_state_expired'
        ? 'link_expired'
        : 'link_invalid',
    );
  }
  if (parsed.kind === 'rejected') throw authError('link_invalid');
  if (handledCodes.has(parsed.code)) return 'ignored';
  handledCodes.add(parsed.code);

  const { auth } = getSupabaseClient();
  const current = await auth.getSession();
  if (current.data.session) return 'already_signed_in';

  // The link usually resumes the app from the background; make sure the one-shot POST below
  // does not go out on a connection that died meanwhile (see warm-up.ts).
  await warmUpSupabaseConnection();

  try {
    const { error } = await withTimeout(
      auth.exchangeCodeForSession(parsed.code),
      AUTH_LINK_TIMEOUT_MS,
      'Auth link exchange',
    );
    if (error) throw error;
  } catch (cause) {
    const appError = toAuthError(cause);
    if (appError.code === 'network' || appError.code === 'timeout') {
      throw authError('link_invalid', cause);
    }
    throw appError;
  }
  return 'signed_in';
}

/**
 * Listens for auth deep links (cold start + while running). Call only once the stored session
 * has been read, so "already signed in" is known. Returns an unsubscribe function.
 */
export function registerAuthLinkHandler(handlers: {
  onError: (error: unknown) => void;
  onSignedIn?: () => void;
}): () => void {
  const handle = (url: string | null) => {
    if (!url) return;
    completeAuthLink(url)
      .then((result) => {
        if (result === 'signed_in') handlers.onSignedIn?.();
      })
      .catch(handlers.onError);
  };
  void Linking.getInitialURL().then(handle, handlers.onError);
  const subscription = Linking.addEventListener('url', (event) => handle(event.url));
  return () => subscription.remove();
}
