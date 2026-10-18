/**
 * Onboarding routing with the REAL profile query/mutation hooks (only the network API is
 * mocked), so the cache-then-refetch timing of a profile save is exercised end to end.
 */
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { useSyncExternalStore as import_useSyncExternalStore } from 'react';

import { RootNavigator } from '@/features/auth/components/RootNavigator';
import type { AuthSessionState } from '@/features/auth/hooks/use-auth-session';
import { completeOnboarding } from '@/features/onboarding/api/onboarding-api';
import {
  clearOnboardingProgress,
  getCompletedStep,
  markStepCompleted,
} from '@/features/onboarding/progress';
import { fetchOwnProfile, updateOwnProfile } from '@/features/profile/api/profile-api';
import type { Profile } from '@/features/profile/types';

import DiscoverScreen from '../../app/(tabs)/discover/index';
import { createTestProviders } from '../utils/render-with-providers';

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
jest.mock('@/features/profile/api/profile-api', () => ({
  PROFILE_COLUMNS: 'id',
  fetchOwnProfile: jest.fn(),
  updateOwnProfile: jest.fn(),
}));
jest.mock('@/features/onboarding/api/onboarding-api', () => {
  const actual = jest.requireActual('@/features/onboarding/api/onboarding-api');
  return { ...actual, completeOnboarding: jest.fn() };
});
jest.mock('@/features/account/hooks/use-account-state', () => ({
  useOwnAccountState: () => ({
    data: { status: 'active', suspended_until: null },
    error: null,
    fetchStatus: 'idle',
    refetch: jest.fn(),
  }),
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

const incomplete: Profile = {
  id: USER_ID,
  first_name: 'Maya',
  date_of_birth: '1994-03-07',
  gender: null,
  bio: null,
  home_city: null,
  home_country: null,
  occupation: null,
  is_profile_complete: false,
  onboarding_completed_at: null,
  discovery_paused_at: null,
  created_at: '',
  updated_at: '',
};
// Core profile complete, onboarding not yet completed on the server.
const complete: Profile = { ...incomplete, gender: 'woman', is_profile_complete: true };
const onboarded: Profile = { ...complete, onboarding_completed_at: '2026-10-11T10:00:00Z' };

let discoverMounts = 0;
function CountingDiscover() {
  discoverMounts += 1;
  return <DiscoverScreen />;
}

// The real app/ route tree (so the fixture can never drift from production routes), with the
// root layout replaced by the bare navigator (no env/fonts/Sentry/providers) and Discover
// wrapped to count mounts.
const routes = {
  appDir: 'app',
  overrides: {
    _layout: RootNavigator,
    '(tabs)/discover/index': CountingDiscover,
  },
};

function signIn() {
  mockAuthStore.set({
    session: null,
    userId: USER_ID,
    isAuthenticated: true,
    isLoading: false,
    isInitializing: false,
    restoreError: null,
    retryRestore: jest.fn(),
    passwordRecovery: false,
    signOut: jest.fn().mockResolvedValue(undefined),
  } satisfies AuthSessionState);
}

/** A promise the test resolves by hand, to hold the post-save refetch open. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('onboarding routing (real profile hooks)', () => {
  beforeEach(() => {
    discoverMounts = 0;
    signIn();
  });
  afterEach(async () => {
    await act(async () => clearOnboardingProgress(USER_ID));
    jest.clearAllMocks();
  });

  it('a profile save never routes to the tabs mid-onboarding, even while the refetch is pending', async () => {
    // Before the save every fetch returns the incomplete row; after it, every fetch hangs until
    // the test releases it (the window where the cache already holds the complete row).
    const refetch = deferred<Profile>();
    let saved = false;
    jest
      .mocked(fetchOwnProfile)
      .mockImplementation(() => (saved ? refetch.promise : Promise.resolve(incomplete)));
    jest.mocked(updateOwnProfile).mockImplementation(() => {
      saved = true;
      return Promise.resolve(complete);
    });

    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/', wrapper });
    await router;
    expect(await screen.findByTestId('onboarding-profile')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('field-gender-woman'));
    await fireEvent.press(screen.getByTestId('onboarding-profile-primary'));

    // The saved (core-complete) row is cached and the refetch is still in flight: the gate keeps
    // the user in onboarding because only the server's onboarding_completed_at ends it.
    // Let the navigator settle (renderRouter runs on fake timers): a guard flip would
    // redirect to Discover within a few ticks.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });
    expect(screen.queryByTestId('discover-screen')).toBeNull();
    expect(discoverMounts).toBe(0);
    expect(router.getPathname()).toMatch(/^\/onboarding/);
    // No marker is needed to hold the user here any more (the save resolves after its refetch).
    expect(getCompletedStep(USER_ID)).toBeNull();

    await act(async () => refetch.resolve(complete));
    expect(await screen.findByTestId('onboarding-interests')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/onboarding/interests');
    expect(getCompletedStep(USER_ID)).toBe('profile');
    expect(discoverMounts).toBe(0);
  });

  it('a failed profile save keeps the user on the profile step and does not corrupt progress', async () => {
    jest.mocked(fetchOwnProfile).mockResolvedValue(incomplete);
    jest.mocked(updateOwnProfile).mockRejectedValueOnce(new Error('offline'));

    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/', wrapper });
    await router;
    await screen.findByTestId('onboarding-profile');
    await fireEvent.press(screen.getByTestId('field-gender-woman'));
    await fireEvent.press(screen.getByTestId('onboarding-profile-primary'));

    expect(await screen.findByTestId('onboarding-profile-error')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/onboarding');
    // Nothing was recorded locally; the server row (still incomplete) decides the resume step.
    expect(getCompletedStep(USER_ID)).toBeNull();

    // Retrying succeeds and continues normally.
    jest.mocked(updateOwnProfile).mockResolvedValueOnce(complete);
    jest.mocked(fetchOwnProfile).mockResolvedValue(complete);
    await fireEvent.press(screen.getByTestId('onboarding-profile-primary'));
    expect(await screen.findByTestId('onboarding-interests')).toBeOnTheScreen();
    expect(discoverMounts).toBe(0);
  });

  it('a restart after the profile step resumes at the next step, not the tabs', async () => {
    jest.mocked(fetchOwnProfile).mockResolvedValue(complete);
    markStepCompleted(USER_ID, 'profile');

    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/', wrapper });
    await router;
    expect(await screen.findByTestId('onboarding-interests')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/onboarding/interests');
    expect(discoverMounts).toBe(0);
  });

  it('finishing onboarding: the server timestamp hands over to Discover; the marker is cleared', async () => {
    jest.mocked(fetchOwnProfile).mockResolvedValue(complete);
    jest.mocked(completeOnboarding).mockImplementation(async () => {
      jest.mocked(fetchOwnProfile).mockResolvedValue(onboarded);
      return onboarded;
    });
    markStepCompleted(USER_ID, 'photos');

    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/', wrapper });
    await router;
    expect(await screen.findByTestId('onboarding-ready')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('onboarding-ready-primary'));

    expect(await screen.findByTestId('discover-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/discover');
    expect(discoverMounts).toBe(1);
    await waitFor(() => expect(getCompletedStep(USER_ID)).toBeNull());
  });

  it('a failed completion keeps the user on Ready (no tabs flash)', async () => {
    jest.mocked(fetchOwnProfile).mockResolvedValue(complete);
    jest.mocked(completeOnboarding).mockRejectedValue(new Error('offline'));
    markStepCompleted(USER_ID, 'photos');

    const { wrapper } = createTestProviders();
    const router = renderRouter(routes, { initialUrl: '/', wrapper });
    await router;
    await fireEvent.press(await screen.findByTestId('onboarding-ready-primary'));
    expect(await screen.findByTestId('onboarding-ready-error')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/onboarding/ready');
    expect(discoverMounts).toBe(0);
    expect(getCompletedStep(USER_ID)).toBe('photos');
  });
});
