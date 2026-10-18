import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { useSyncExternalStore as import_useSyncExternalStore } from 'react';

import { useOwnAccountState } from '@/features/account/hooks/use-account-state';
import type { AccountStatus } from '@/features/account/types';
import { RootNavigator } from '@/features/auth/components/RootNavigator';
import type { AuthSessionState } from '@/features/auth/hooks/use-auth-session';
import { clearOnboardingProgress, markStepCompleted } from '@/features/onboarding/progress';
import { useOwnProfile } from '@/features/profile/hooks/use-own-profile';

import { createTestProviders } from '../utils/render-with-providers';

// A tiny external store so a mocked session change re-renders the real navigator.
const mockAuthStore = {
  state: null as unknown,
  listeners: new Set<() => void>(),
  set(next: unknown) {
    mockAuthStore.state = next;
    mockAuthStore.listeners.forEach((l) => l());
  },
};
jest.mock('@/features/auth/hooks/use-auth-session', () => {
  const { useSyncExternalStore } = jest.requireActual<{
    useSyncExternalStore: typeof import_useSyncExternalStore;
  }>('react');
  return {
    useAuthSession: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          mockAuthStore.listeners.add(listener);
          return () => mockAuthStore.listeners.delete(listener);
        },
        () => mockAuthStore.state,
        () => mockAuthStore.state,
      ),
  };
});
// Only the link-error notice and the password reset screen read the provider directly.
const mockLinkState = {
  linkError: null as { message: string } | null,
  dismissLinkError: jest.fn(),
  passwordRecovery: false,
  finishPasswordRecovery: jest.fn(),
  signOut: jest.fn().mockResolvedValue(undefined),
};
jest.mock('@/features/auth/providers/AuthProvider', () => ({ useAuth: () => mockLinkState }));
jest.mock('@/features/account/hooks/use-account-state', () => ({ useOwnAccountState: jest.fn() }));
jest.mock('@/features/profile/hooks/use-own-profile', () => ({
  useOwnProfile: jest.fn(),
  useUpdateProfile: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));
jest.mock('@/features/photos/hooks/use-profile-photos', () => ({
  useOwnProfilePhotos: () => ({ data: [], isLoading: false }),
  useSignedPhotoUrl: () => ({ data: undefined }),
  useUploadProfilePhoto: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteProfilePhoto: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useSetPrimaryPhoto: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useReorderProfilePhotos: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/features/interests/hooks/use-interests', () => ({
  useInterests: () => ({ data: [], isLoading: false }),
  useOwnInterests: () => ({ data: [], isLoading: false }),
  useReplaceInterests: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/features/preferences/hooks/use-preferences', () => ({
  useDiscoveryPreferences: () => ({ data: undefined, isLoading: false }),
  useGenderPreferences: () => ({ data: undefined, isLoading: false }),
  useUpdateDiscoveryPreferences: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useSetGenderPreferences: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/services/storage/local-storage', () => {
  const store = new Map<string, string>();
  return {
    getDeviceLocalStorage: () => ({
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    }),
  };
});

const USER_ID = '1a000000-0000-4000-8000-00000000000a';

// The real app/ route tree (so the fixture can never drift from production routes), with the
// root layout replaced by the bare navigator (no env/fonts/Sentry/providers).
const routes = { appDir: 'app', overrides: { _layout: RootNavigator } };

function setAuth(state: Partial<AuthSessionState>) {
  const signOut = jest.fn().mockResolvedValue(undefined);
  const retryRestore = jest.fn();
  mockAuthStore.set({
    session: null,
    userId: null,
    isAuthenticated: false,
    isLoading: false,
    isInitializing: false,
    restoreError: null,
    retryRestore,
    passwordRecovery: false,
    signOut,
    ...state,
  });
  return { signOut, retryRestore };
}

function setAccount(
  status: AccountStatus | null,
  extra: Record<string, unknown> = {},
  suspendedUntil: string | null = null,
) {
  const refetch = jest.fn();
  jest.mocked(useOwnAccountState).mockReturnValue({
    data: status === null ? undefined : { status, suspended_until: suspendedUntil },
    error: null,
    isLoading: status === null,
    fetchStatus: 'idle',
    refetch,
    ...extra,
  } as unknown as ReturnType<typeof useOwnAccountState>);
  return { refetch };
}

/** `incomplete`: core profile missing · `core`: core done, onboarding not completed on the
 * server · `onboarded`: onboarding_completed_at set. */
type ProfileState = 'incomplete' | 'core' | 'onboarded' | null;

function setProfile(state: ProfileState, extra: Record<string, unknown> = {}) {
  jest.mocked(useOwnProfile).mockReturnValue({
    data:
      state === null
        ? undefined
        : {
            id: USER_ID,
            first_name: 'Maya',
            date_of_birth: '1994-03-07',
            gender: 'woman',
            bio: null,
            home_city: null,
            home_country: null,
            occupation: null,
            is_profile_complete: state !== 'incomplete',
            onboarding_completed_at: state === 'onboarded' ? '2026-10-11T10:00:00Z' : null,
            discovery_paused_at: null,
            created_at: '',
            updated_at: '',
          },
    error: null,
    isLoading: state === null,
    isError: false,
    refetch: jest.fn(),
    ...extra,
  } as unknown as ReturnType<typeof useOwnProfile>);
}

describe('root routing guards', () => {
  beforeEach(() => setAccount('active'));
  afterEach(async () => {
    await act(async () => clearOnboardingProgress(USER_ID));
    mockLinkState.linkError = null;
    mockLinkState.passwordRecovery = false;
    jest.clearAllMocks();
  });

  it('shows the bootstrap screen (no route flash) while the session initialises', async () => {
    setAuth({ isInitializing: true, isLoading: true });
    setProfile(null);
    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/', wrapper });
    await router;
    expect(await screen.findByTestId('bootstrap-screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('welcome-screen')).toBeNull();
    expect(screen.queryByTestId('discover-screen')).toBeNull();
  });

  it('sends signed-out users to welcome, and keeps them out of the app', async () => {
    setAuth({});
    setProfile(null);
    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/discover', wrapper });
    await router;
    expect(await screen.findByTestId('welcome-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/welcome');
    await fireEvent.press(screen.getByTestId('welcome-sign-up'));
    expect(await screen.findByTestId('sign-up-screen')).toBeOnTheScreen();
  });

  it('sends signed-in users with an incomplete profile to onboarding', async () => {
    setAuth({ userId: USER_ID, isAuthenticated: true });
    setProfile('incomplete');
    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/', wrapper });
    await router;
    expect(await screen.findByTestId('onboarding-profile')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/onboarding');
  });

  it('keeps a complete core profile in onboarding until the server records completion', async () => {
    setAuth({ userId: USER_ID, isAuthenticated: true });
    setProfile('core');
    // No local marker at all (e.g. a new device): still onboarding, resumed after the profile.
    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/discover', wrapper });
    await router;
    expect(await screen.findByTestId('onboarding-interests')).toBeOnTheScreen();
    expect(screen.queryByTestId('discover-screen')).toBeNull();
  });

  it('resumes an unfinished onboarding at the next step', async () => {
    setAuth({ userId: USER_ID, isAuthenticated: true });
    setProfile('core');
    markStepCompleted(USER_ID, 'profile');
    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/', wrapper });
    await router;
    expect(await screen.findByTestId('onboarding-interests')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/onboarding/interests');
  });

  it('sends onboarded accounts into the tabs, even with a stale local marker', async () => {
    setAuth({ userId: USER_ID, isAuthenticated: true });
    setProfile('onboarded');
    markStepCompleted(USER_ID, 'interests');
    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/', wrapper });
    await router;
    expect(await screen.findByTestId('discover-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/discover');
  });

  it('re-evaluates the route when the account signs out', async () => {
    setAuth({ userId: USER_ID, isAuthenticated: true });
    setProfile('onboarded');
    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/profile', wrapper });
    await router;
    expect(await screen.findByTestId('profile-screen')).toBeOnTheScreen();

    setProfile(null);
    await act(async () => {
      setAuth({});
    });
    expect(await screen.findByTestId('welcome-screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-screen')).toBeNull();
  });

  it('explains a failed confirmation link on the welcome screen', async () => {
    setAuth({});
    setProfile(null);
    mockLinkState.linkError = {
      message:
        'That link has expired or was already used. Sign in, or create your account again to get a new link.',
    };
    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/auth/callback?code=expired', wrapper });
    await router;
    expect(await screen.findByTestId('welcome-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('auth-link-error')).toHaveTextContent(/expired or was already used/);
  });

  it('offers retry (not the sign-in screens) when an offline session restore fails', async () => {
    const { retryRestore, signOut } = setAuth({
      restoreError: { code: 'network' } as AuthSessionState['restoreError'],
    });
    setProfile(null);
    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/', wrapper });
    await router;
    expect(await screen.findByTestId('bootstrap-error')).toBeOnTheScreen();
    expect(screen.getByTestId('bootstrap-error-message')).toHaveTextContent(
      /couldn’t restore your session/,
    );
    expect(screen.queryByTestId('welcome-screen')).toBeNull();
    await fireEvent.press(screen.getByTestId('bootstrap-retry'));
    expect(retryRestore).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('bootstrap-sign-out'));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('never spins forever when the profile request is paused offline', async () => {
    setAuth({ userId: USER_ID, isAuthenticated: true });
    setProfile(null, { fetchStatus: 'paused', isLoading: true });
    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/', wrapper });
    await router;
    expect(await screen.findByTestId('bootstrap-error')).toBeOnTheScreen();
    expect(screen.getByTestId('bootstrap-error-message')).toHaveTextContent(/You’re offline/);
  });

  it('offers retry when the profile fails to load instead of guessing a route', async () => {
    setAuth({ userId: USER_ID, isAuthenticated: true });
    setProfile(null, { error: new Error('offline'), isError: true, isLoading: false });
    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/', wrapper });
    await router;
    expect(await screen.findByTestId('bootstrap-error')).toBeOnTheScreen();
  });

  it.each([
    ['suspended', /account is suspended/],
    ['banned', /no longer available/],
    ['deletion_pending', /being deleted/],
  ] as const)(
    'shows the restricted screen (not the app) for a %s account',
    async (status, copy) => {
      setAuth({ userId: USER_ID, isAuthenticated: true });
      setProfile('onboarded');
      setAccount(status);
      const { wrapper } = createTestProviders();
      const router = renderRouter(routes, { initialUrl: '/discover', wrapper });
      await router;
      expect(await screen.findByTestId('restricted-account-screen')).toBeOnTheScreen();
      expect(screen.getByTestId(`restricted-status-${status}`)).toHaveTextContent(copy);
      expect(screen.queryByTestId('discover-screen')).toBeNull();
      expect(screen.queryByTestId('onboarding-profile')).toBeNull();
    },
  );

  it('a suspension shows its end date and only offers sign-out', async () => {
    const { signOut } = setAuth({ userId: USER_ID, isAuthenticated: true });
    setProfile('core');
    setAccount('suspended', {}, '2026-11-01T00:00:00Z');
    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/', wrapper });
    await router;
    expect(await screen.findByTestId('restricted-until')).toHaveTextContent(/Suspended until/);
    await fireEvent.press(screen.getByTestId('restricted-sign-out'));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('waits for the account state, and offers retry when it fails to load', async () => {
    setAuth({ userId: USER_ID, isAuthenticated: true });
    setProfile('onboarded');
    const { refetch } = setAccount(null, {
      error: new Error('offline'),
      isError: true,
      isLoading: false,
    });
    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/', wrapper });
    await router;
    expect(await screen.findByTestId('bootstrap-error')).toBeOnTheScreen();
    expect(screen.getByTestId('bootstrap-error-message')).toHaveTextContent(
      /couldn’t load your account/,
    );
    await fireEvent.press(screen.getByTestId('bootstrap-retry'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps a verified password recovery on the reset screen instead of the app', async () => {
    setAuth({ userId: USER_ID, isAuthenticated: true, passwordRecovery: true });
    mockLinkState.passwordRecovery = true;
    setProfile('onboarded');
    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/forgot-password', wrapper });
    await router;
    expect(await screen.findByTestId('reset-password-screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('discover-screen')).toBeNull();
  });

  it('opens forgot password and the code screen from the signed-out area', async () => {
    setAuth({});
    setProfile(null);
    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/sign-in', wrapper });
    await router;
    await fireEvent.press(await screen.findByTestId('link-forgot-password'));
    expect(await screen.findByTestId('reset-email-screen')).toBeOnTheScreen();
  });
});
