import { resolveAppArea, resolveAreaProblem } from './resolve-area';

const base = { isInitializing: false, isAuthenticated: true, onboardingInProgress: false };

describe('resolveAppArea', () => {
  it('shows bootstrap while the session is initialising (prevents route flash)', () => {
    expect(resolveAppArea({ ...base, isInitializing: true, profile: undefined })).toBe('bootstrap');
  });

  it('routes signed-out users to auth', () => {
    expect(resolveAppArea({ ...base, isAuthenticated: false, profile: undefined })).toBe('auth');
  });

  it('waits for the profile row before choosing onboarding vs app', () => {
    expect(resolveAppArea({ ...base, profile: undefined })).toBe('bootstrap');
    expect(resolveAppArea({ ...base, profile: undefined, profileError: new Error('x') })).toBe(
      'error',
    );
  });

  it('routes incomplete profiles to onboarding, regardless of local markers', () => {
    expect(resolveAppArea({ ...base, profile: { is_profile_complete: false } })).toBe('onboarding');
    expect(
      resolveAppArea({
        ...base,
        profile: { is_profile_complete: false },
        onboardingInProgress: false,
      }),
    ).toBe('onboarding');
  });

  it('routes complete profiles to the app unless onboarding is still in progress here', () => {
    expect(resolveAppArea({ ...base, profile: { is_profile_complete: true } })).toBe('app');
    expect(
      resolveAppArea({
        ...base,
        profile: { is_profile_complete: true },
        onboardingInProgress: true,
      }),
    ).toBe('onboarding');
  });

  it('never waits forever: failed restores and offline profile loads resolve to error', () => {
    const signedOut = { ...base, isAuthenticated: false, profile: null };
    expect(resolveAppArea({ ...signedOut, sessionRestoreFailed: true })).toBe('error');
    expect(resolveAreaProblem({ ...signedOut, sessionRestoreFailed: true })).toBe('session');
    expect(resolveAppArea(signedOut)).toBe('auth');

    expect(resolveAppArea({ ...base, profile: undefined, profilePaused: true })).toBe('error');
    expect(resolveAreaProblem({ ...base, profile: undefined, profilePaused: true })).toBe(
      'offline',
    );
    expect(resolveAreaProblem({ ...base, profile: undefined, profileError: new Error('x') })).toBe(
      'profile',
    );
    // Cached data wins over a paused refetch.
    expect(
      resolveAppArea({ ...base, profile: { is_profile_complete: true }, profilePaused: true }),
    ).toBe('app');
    expect(resolveAreaProblem({ ...base, profile: { is_profile_complete: true } })).toBeNull();
  });
});
