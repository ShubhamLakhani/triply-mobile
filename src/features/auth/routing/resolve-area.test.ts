import { resolveAppArea, resolveAreaProblem, type ResolveAreaInput } from './resolve-area';

const ACTIVE = { status: 'active' as const };
const NOT_ONBOARDED = { onboarding_completed_at: null };
const ONBOARDED = { onboarding_completed_at: '2026-10-11T12:00:00Z' };

const base: ResolveAreaInput = {
  isInitializing: false,
  isAuthenticated: true,
  account: ACTIVE,
  profile: NOT_ONBOARDED,
};

describe('resolveAppArea', () => {
  it('shows bootstrap while the session is initialising (prevents route flash)', () => {
    expect(resolveAppArea({ ...base, isInitializing: true, profile: undefined })).toBe('bootstrap');
  });

  it('routes signed-out users to auth', () => {
    expect(
      resolveAppArea({ ...base, isAuthenticated: false, account: undefined, profile: undefined }),
    ).toBe('auth');
  });

  it('keeps a verified password recovery on the auth screens until the password is saved', () => {
    expect(resolveAppArea({ ...base, passwordRecovery: true, profile: ONBOARDED })).toBe('auth');
    expect(resolveAppArea({ ...base, passwordRecovery: false, profile: ONBOARDED })).toBe('app');
  });

  it('waits for the account state and profile row before choosing an area', () => {
    expect(resolveAppArea({ ...base, account: undefined })).toBe('bootstrap');
    expect(resolveAppArea({ ...base, profile: undefined })).toBe('bootstrap');
    expect(resolveAppArea({ ...base, profile: undefined, profileError: new Error('x') })).toBe(
      'error',
    );
  });

  it('routes any non-active account to the restricted area, before onboarding/app', () => {
    for (const status of ['suspended', 'banned', 'deletion_pending'] as const) {
      expect(resolveAppArea({ ...base, account: { status }, profile: ONBOARDED })).toBe(
        'restricted',
      );
      expect(resolveAppArea({ ...base, account: { status }, profile: undefined })).toBe(
        'restricted',
      );
    }
  });

  it('uses the server onboarding timestamp: null → onboarding, set → app', () => {
    expect(resolveAppArea({ ...base, profile: NOT_ONBOARDED })).toBe('onboarding');
    expect(resolveAppArea({ ...base, profile: ONBOARDED })).toBe('app');
  });

  it('never waits forever: failed restores, account and profile loads resolve to error', () => {
    const signedOut = { ...base, isAuthenticated: false, account: undefined, profile: null };
    expect(resolveAppArea({ ...signedOut, sessionRestoreFailed: true })).toBe('error');
    expect(resolveAreaProblem({ ...signedOut, sessionRestoreFailed: true })).toBe('session');
    expect(resolveAppArea(signedOut)).toBe('auth');

    expect(resolveAppArea({ ...base, account: undefined, accountError: new Error('x') })).toBe(
      'error',
    );
    expect(resolveAreaProblem({ ...base, account: undefined, accountError: new Error('x') })).toBe(
      'account',
    );
    expect(resolveAreaProblem({ ...base, account: undefined, accountPaused: true })).toBe(
      'offline',
    );

    expect(resolveAppArea({ ...base, profile: undefined, profilePaused: true })).toBe('error');
    expect(resolveAreaProblem({ ...base, profile: undefined, profilePaused: true })).toBe(
      'offline',
    );
    expect(resolveAreaProblem({ ...base, profile: undefined, profileError: new Error('x') })).toBe(
      'profile',
    );
    // Cached data wins over a paused refetch.
    expect(resolveAppArea({ ...base, profile: ONBOARDED, profilePaused: true })).toBe('app');
    expect(resolveAreaProblem({ ...base, profile: ONBOARDED })).toBeNull();
  });
});
