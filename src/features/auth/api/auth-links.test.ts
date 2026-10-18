import * as Linking from 'expo-linking';

import { getSupabaseClient, warmUpSupabaseConnection } from '@/services/supabase';

import {
  completeAuthLink,
  parseAuthLink,
  registerAuthLinkHandler,
  resetHandledAuthLinks,
} from './auth-links';

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `triply-dev://${path}`,
  getInitialURL: jest.fn(),
  addEventListener: jest.fn(),
}));
jest.mock('@/services/supabase', () => ({
  getSupabaseClient: jest.fn(),
  warmUpSupabaseConnection: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/storage/local-storage', () => ({ getDeviceLocalStorage: jest.fn() }));

const CODE = '8d7c1f5e-2b3a-4c4d-9e8f-0a1b2c3d4e5f';

function useAuth(options: { signedIn?: boolean; exchangeError?: unknown } = {}) {
  const exchangeCodeForSession = jest
    .fn()
    .mockResolvedValue({ data: {}, error: options.exchangeError ?? null });
  const setSession = jest.fn();
  const getSession = jest.fn().mockResolvedValue({
    data: { session: options.signedIn ? { user: { id: 'u1' } } : null },
    error: null,
  });
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue({ auth: { exchangeCodeForSession, setSession, getSession } } as never);
  return { exchangeCodeForSession, setSession, getSession };
}

describe('parseAuthLink', () => {
  it('accepts a PKCE code on this install’s exact callback URL', () => {
    expect(parseAuthLink(`triply-dev://auth/callback?code=${CODE}`)).toEqual({
      kind: 'code',
      code: CODE,
    });
    expect(parseAuthLink(`TRIPLY-DEV://auth/callback/?code=${CODE}`)).toEqual({
      kind: 'code',
      code: CODE,
    });
  });

  it('ignores links for another scheme, host or path', () => {
    expect(parseAuthLink(`triply://auth/callback?code=${CODE}`)).toBeNull();
    expect(parseAuthLink(`triply-preview://auth/callback?code=${CODE}`)).toBeNull();
    expect(parseAuthLink(`https://evil.example/auth/callback?code=${CODE}`)).toBeNull();
    expect(parseAuthLink(`triply-dev://profile/auth/callback?code=${CODE}`)).toBeNull();
    expect(parseAuthLink(`triply-dev://auth/callbackx?code=${CODE}`)).toBeNull();
    expect(parseAuthLink('triply-dev://profile')).toBeNull();
  });

  it('rejects raw tokens instead of treating them as a session', () => {
    expect(
      parseAuthLink('triply-dev://auth/callback#access_token=a.b.c&refresh_token=r&type=signup'),
    ).toEqual({ kind: 'rejected', reason: 'raw_tokens' });
    expect(parseAuthLink(`triply-dev://auth/callback?code=${CODE}&access_token=x`)).toEqual({
      kind: 'rejected',
      reason: 'raw_tokens',
    });
  });

  it('rejects malformed or empty callbacks', () => {
    expect(parseAuthLink('triply-dev://auth/callback')).toEqual({
      kind: 'rejected',
      reason: 'empty',
    });
    expect(parseAuthLink('triply-dev://auth/callback?code=<script>')).toEqual({
      kind: 'rejected',
      reason: 'malformed',
    });
    expect(parseAuthLink('triply-dev://auth/callback?code=%E0%A4%A')).toEqual({
      kind: 'rejected',
      reason: 'empty',
    });
  });

  it('reads provider errors from the query or the fragment', () => {
    expect(
      parseAuthLink(
        'triply-dev://auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
      ),
    ).toEqual({ kind: 'error', errorCode: 'otp_expired' });
    expect(parseAuthLink('triply-dev://auth/callback#error=server_error')).toEqual({
      kind: 'error',
      errorCode: 'server_error',
    });
  });
});

describe('completeAuthLink', () => {
  beforeEach(() => resetHandledAuthLinks());
  afterEach(() => jest.clearAllMocks());

  it('exchanges a valid PKCE code for a session', async () => {
    const auth = useAuth();
    await expect(completeAuthLink(`triply-dev://auth/callback?code=${CODE}`)).resolves.toBe(
      'signed_in',
    );
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith(CODE);
    expect(auth.setSession).not.toHaveBeenCalled();
  });

  it('never calls setSession for a raw-token link and reports a safe error', async () => {
    const auth = useAuth();
    await expect(
      completeAuthLink('triply-dev://auth/callback#access_token=a&refresh_token=r'),
    ).rejects.toMatchObject({ code: 'link_invalid' });
    expect(auth.setSession).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('ignores unrelated links and wrong schemes without touching Supabase', async () => {
    const auth = useAuth();
    await expect(completeAuthLink('triply-dev://trips/123')).resolves.toBe('ignored');
    await expect(completeAuthLink(`triply://auth/callback?code=${CODE}`)).resolves.toBe('ignored');
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('rejects a malformed callback with a safe error', async () => {
    useAuth();
    await expect(completeAuthLink('triply-dev://auth/callback?code=')).rejects.toMatchObject({
      code: 'link_invalid',
    });
  });

  it('never replaces the session of a user who is already signed in', async () => {
    const auth = useAuth({ signedIn: true });
    await expect(completeAuthLink(`triply-dev://auth/callback?code=${CODE}`)).resolves.toBe(
      'already_signed_in',
    );
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('maps an expired or invalid code to a user-safe error without raw text', async () => {
    useAuth({
      exchangeError: { code: 'flow_state_expired', status: 403, message: 'raw provider text' },
    });
    const expired: unknown = await completeAuthLink(
      `triply-dev://auth/callback?code=${CODE}`,
    ).catch((e: unknown) => e);
    expect(expired).toMatchObject({ code: 'link_expired' });
    expect((expired as Error).message).not.toMatch(/raw provider text/);

    resetHandledAuthLinks();
    useAuth({
      exchangeError: {
        name: 'AuthPKCECodeVerifierMissingError',
        code: 'pkce_code_verifier_not_found',
      },
    });
    await expect(completeAuthLink(`triply-dev://auth/callback?code=${CODE}`)).rejects.toMatchObject(
      { code: 'link_invalid' },
    );

    await expect(
      completeAuthLink(
        'triply-dev://auth/callback?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).rejects.toMatchObject({ code: 'link_expired' });
  });

  it('exchanges each code once, even if the same link is delivered again', async () => {
    const auth = useAuth();
    await completeAuthLink(`triply-dev://auth/callback?code=${CODE}`);
    await expect(completeAuthLink(`triply-dev://auth/callback?code=${CODE}`)).resolves.toBe(
      'ignored',
    );
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('refreshes the connection before the one-shot exchange', async () => {
    const auth = useAuth();
    await completeAuthLink(`triply-dev://auth/callback?code=${CODE}`);
    expect(warmUpSupabaseConnection).toHaveBeenCalledTimes(1);
    const warmUpOrder = jest.mocked(warmUpSupabaseConnection).mock.invocationCallOrder[0] ?? 0;
    const exchangeOrder = auth.exchangeCodeForSession.mock.invocationCallOrder[0] ?? 0;
    expect(warmUpOrder).toBeLessThan(exchangeOrder);
  });

  it('a network failure during the exchange asks the user to sign in, not to retry', async () => {
    // auth-js discards the code verifier on any failure, so the same link cannot work again.
    const auth = useAuth({ exchangeError: { name: 'AuthRetryableFetchError', status: 0 } });
    const error: unknown = await completeAuthLink(`triply-dev://auth/callback?code=${CODE}`).catch(
      (e: unknown) => e,
    );
    expect(error).toMatchObject({ code: 'link_invalid' });
    expect((error as Error).message).toMatch(/sign in to continue/);
    expect((error as Error).message).not.toMatch(/offline/);
    await expect(completeAuthLink(`triply-dev://auth/callback?code=${CODE}`)).resolves.toBe(
      'ignored',
    );
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });
});

describe('registerAuthLinkHandler', () => {
  beforeEach(() => resetHandledAuthLinks());
  afterEach(() => jest.clearAllMocks());

  it('handles the cold-start URL and later links, reporting errors and sign-ins', async () => {
    useAuth();
    let deliver: (event: { url: string }) => void = () => undefined;
    const remove = jest.fn();
    jest.mocked(Linking.getInitialURL).mockResolvedValue(`triply-dev://auth/callback?code=${CODE}`);
    jest.mocked(Linking.addEventListener).mockImplementation((_type, listener) => {
      deliver = listener as (event: { url: string }) => void;
      return { remove } as never;
    });
    const onError = jest.fn();
    const onSignedIn = jest.fn();

    const unsubscribe = registerAuthLinkHandler({ onError, onSignedIn });
    await new Promise((resolve) => setImmediate(resolve));
    expect(onSignedIn).toHaveBeenCalledTimes(1);

    deliver({ url: 'triply-dev://auth/callback#access_token=a&refresh_token=b' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'link_invalid' }));

    unsubscribe();
    expect(remove).toHaveBeenCalled();
  });
});
