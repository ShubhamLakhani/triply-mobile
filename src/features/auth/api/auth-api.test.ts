import { getSupabaseClient } from '@/services/supabase';

import { TimeoutError } from '@/utils/timeout';

import {
  AUTH_REQUEST_TIMEOUT_MS,
  getCurrentSession,
  resendSignUpEmail,
  signInWithPassword,
  signOut,
  signUpWithPassword,
} from './auth-api';
import { AppAuthError, toAuthError } from './auth-errors';

jest.mock('@/services/supabase', () => ({ getSupabaseClient: jest.fn() }));
jest.mock('./auth-links', () => ({ getAuthRedirectUrl: () => 'triply-dev://auth/callback' }));

function useAuthClient(auth: Record<string, jest.Mock>) {
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue({ auth } as unknown as ReturnType<typeof getSupabaseClient>);
  return auth;
}

describe('auth api', () => {
  it('normalises the email and signs in', async () => {
    const auth = useAuthClient({
      signInWithPassword: jest
        .fn()
        .mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null }),
    });
    await expect(
      signInWithPassword({ email: '  Maya@Example.com ', password: 'password123' }),
    ).resolves.toMatchObject({ user: { id: 'u1' } });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'maya@example.com',
      password: 'password123',
    });
  });

  it('rejects invalid input before calling Supabase', async () => {
    const auth = useAuthClient({ signInWithPassword: jest.fn() });
    await expect(signInWithPassword({ email: 'nope', password: 'short' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('reports whether sign-up needs email confirmation', async () => {
    const auth = useAuthClient({
      signUp: jest
        .fn()
        .mockResolvedValue({ data: { session: null, user: { id: 'u1' } }, error: null }),
    });
    await expect(
      signUpWithPassword({ email: 'a@b.co', password: 'password123' }),
    ).resolves.toMatchObject({ needsEmailConfirmation: true });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'password123',
      options: { emailRedirectTo: 'triply-dev://auth/callback' },
    });
    useAuthClient({
      signUp: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'u1' } }, user: { id: 'u1' } },
        error: null,
      }),
    });
    await expect(
      signUpWithPassword({ email: 'a@b.co', password: 'password123' }),
    ).resolves.toMatchObject({ needsEmailConfirmation: false });
  });

  it('resends the confirmation email', async () => {
    const auth = useAuthClient({ resend: jest.fn().mockResolvedValue({ error: null }) });
    await resendSignUpEmail('a@b.co');
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'a@b.co',
      options: { emailRedirectTo: 'triply-dev://auth/callback' },
    });
  });

  it('maps Supabase error codes to stable, user-safe codes', () => {
    expect(
      toAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' }).code,
    ).toBe('invalid_credentials');
    expect(toAuthError({ code: 'email_not_confirmed' }).code).toBe('email_not_confirmed');
    expect(toAuthError({ code: 'user_already_exists' }).code).toBe('email_taken');
    expect(toAuthError({ code: 'weak_password' }).code).toBe('weak_password');
    expect(toAuthError({ code: 'over_request_rate_limit' }).code).toBe('rate_limited');
    expect(toAuthError({ name: 'AuthRetryableFetchError', status: 0 }).code).toBe('network');
    const mapped = toAuthError({ status: 500, message: 'secret internal detail' });
    expect(mapped.code).toBe('unknown');
    expect(mapped.message).not.toContain('secret');
  });

  it('maps delivery, sign-up, timeout and link errors to stable codes', () => {
    expect(toAuthError({ code: 'email_address_not_authorized', status: 400 }).code).toBe(
      'email_undeliverable',
    );
    expect(toAuthError({ code: 'signup_disabled', status: 422 }).code).toBe('signup_disabled');
    expect(toAuthError({ code: 'request_timeout', status: 504 }).code).toBe('timeout');
    expect(toAuthError(new TimeoutError(20_000)).code).toBe('timeout');
    expect(toAuthError({ code: 'otp_expired' }).code).toBe('link_expired');
    expect(toAuthError({ code: 'bad_code_verifier' }).code).toBe('link_invalid');
    const existing = toAuthError({ code: 'weak_password' });
    expect(toAuthError(existing)).toBe(existing);
  });
});

describe('auth request timeouts', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const never = () => new Promise<never>(() => undefined);

  it('resolves normally when Supabase answers before the timeout', async () => {
    useAuthClient({
      signUp: jest.fn().mockResolvedValue({ data: { session: null, user: {} }, error: null }),
    });
    await expect(signUpWithPassword({ email: 'a@b.co', password: 'password123' })).resolves.toEqual(
      { needsEmailConfirmation: true, session: null },
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('passes a normal rejection through as a typed error', async () => {
    useAuthClient({
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { session: null },
        error: { code: 'invalid_credentials', status: 400 },
      }),
    });
    await expect(
      signInWithPassword({ email: 'a@b.co', password: 'password123' }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' });
  });

  it.each([
    ['sign up', 'signUp', () => signUpWithPassword({ email: 'a@b.co', password: 'password123' })],
    [
      'sign in',
      'signInWithPassword',
      () => signInWithPassword({ email: 'a@b.co', password: 'password123' }),
    ],
    ['resend', 'resend', () => resendSignUpEmail('a@b.co')],
  ] as const)('%s never spins forever: it rejects with `timeout`', async (_name, method, call) => {
    useAuthClient({ [method]: jest.fn(never) });
    const pending = call();
    jest.advanceTimersByTime(AUTH_REQUEST_TIMEOUT_MS);
    const error: unknown = await pending.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppAuthError);
    expect(error).toMatchObject({
      code: 'timeout',
      message: 'This is taking longer than it should. Check your connection and try again.',
    });
  });

  it('reports an offline session restore as a transient error (the session is kept)', async () => {
    useAuthClient({
      getSession: jest.fn().mockResolvedValue({
        data: { session: null },
        error: { name: 'AuthRetryableFetchError', status: 0 },
      }),
    });
    await expect(getCurrentSession()).rejects.toMatchObject({ code: 'network' });
  });
});

describe('signOut', () => {
  afterEach(() => jest.clearAllMocks());

  it('treats a network failure as signed out (auth-js already removed the local session)', async () => {
    useAuthClient({
      signOut: jest
        .fn()
        .mockResolvedValue({ error: { name: 'AuthRetryableFetchError', status: 0 } }),
    });
    await expect(signOut()).resolves.toBeUndefined();
  });

  it('still reports other failures', async () => {
    useAuthClient({ signOut: jest.fn().mockResolvedValue({ error: { status: 500 } }) });
    await expect(signOut()).rejects.toMatchObject({ code: 'unknown' });
  });
});
