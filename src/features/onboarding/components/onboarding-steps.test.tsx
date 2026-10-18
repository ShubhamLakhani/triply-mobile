import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useAuthSession } from '@/features/auth/hooks/use-auth-session';
import { useOwnInterests } from '@/features/interests/hooks/use-interests';
import { useOwnProfilePhotos } from '@/features/photos/hooks/use-profile-photos';
import { useOwnProfile, useUpdateProfile } from '@/features/profile/hooks/use-own-profile';
import type { Profile } from '@/features/profile/types';

import { createTestProviders } from '../../../../tests/utils/render-with-providers';
import { clearOnboardingProgress, getCompletedStep, markStepCompleted } from '../progress';

import { ProfileStep } from './ProfileStep';
import { ReadyStep } from './ReadyStep';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), canGoBack: () => false, push: jest.fn() },
}));
jest.mock('@/features/auth/hooks/use-auth-session', () => ({ useAuthSession: jest.fn() }));
jest.mock('@/features/profile/hooks/use-own-profile', () => ({
  useOwnProfile: jest.fn(),
  useUpdateProfile: jest.fn(),
}));
jest.mock('@/features/photos/hooks/use-profile-photos', () => ({ useOwnProfilePhotos: jest.fn() }));
jest.mock('@/features/interests/hooks/use-interests', () => ({ useOwnInterests: jest.fn() }));
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
const empty: Profile = {
  id: USER_ID,
  first_name: null,
  date_of_birth: null,
  gender: null,
  bio: null,
  home_city: null,
  home_country: null,
  occupation: null,
  is_profile_complete: false,
  is_discoverable: false,
  created_at: '',
  updated_at: '',
};

function setup(profile: Profile, saved: Profile = { ...profile, is_profile_complete: true }) {
  jest.mocked(useAuthSession).mockReturnValue({
    userId: USER_ID,
    isAuthenticated: true,
    isLoading: false,
    isInitializing: false,
    session: null,
    restoreError: null,
    retryRestore: jest.fn(),
    signOut: jest.fn(),
  });
  const refetch = jest.fn().mockResolvedValue({ data: profile });
  jest.mocked(useOwnProfile).mockReturnValue({ data: profile, isLoading: false, refetch } as never);
  const mutateAsync = jest.fn().mockResolvedValue(saved);
  jest.mocked(useUpdateProfile).mockReturnValue({ mutateAsync, isPending: false } as never);
  jest
    .mocked(useOwnProfilePhotos)
    .mockReturnValue({ data: [{ id: 'p' }], isLoading: false } as never);
  jest
    .mocked(useOwnInterests)
    .mockReturnValue({ data: [{ interest_id: 'i' }, { interest_id: 'j' }] } as never);
  return { mutateAsync, refetch, ...createTestProviders() };
}

async function fillRequired() {
  await fireEvent.changeText(screen.getByTestId('field-first-name'), 'Maya');
  await fireEvent.changeText(screen.getByTestId('field-dob-day'), '7');
  await fireEvent.changeText(screen.getByTestId('field-dob-month'), '3');
  await fireEvent.changeText(screen.getByTestId('field-dob-year'), '1994');
  await fireEvent.press(screen.getByTestId('field-gender-woman'));
}

describe('onboarding steps', () => {
  afterEach(() => {
    clearOnboardingProgress(USER_ID);
    jest.clearAllMocks();
  });

  it('profile step: required fields gate progress; nothing is saved while invalid', async () => {
    const { mutateAsync, wrapper } = setup(empty);
    await render(<ProfileStep />, { wrapper });
    await fireEvent.press(screen.getByTestId('onboarding-profile-primary'));
    expect(await screen.findByText('Tell us your first name.')).toBeOnTheScreen();
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('profile step: saves, marks progress and advances to interests', async () => {
    const { mutateAsync, wrapper, transport } = setup(empty);
    await render(<ProfileStep />, { wrapper });
    await fillRequired();
    await fireEvent.press(screen.getByTestId('onboarding-profile-primary'));
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        first_name: 'Maya',
        date_of_birth: '1994-03-07',
        gender: 'woman',
        bio: null,
        home_city: null,
        home_country: null,
        occupation: null,
      }),
    );
    expect(router.replace).toHaveBeenCalledWith('/onboarding/interests');
    expect(getCompletedStep(USER_ID)).toBe('profile');
    expect(transport.capture).toHaveBeenCalledWith('onboarding_step_completed', {
      step: 'profile',
      skipped: false,
    });
  });

  it('profile step: stays put with guidance when the server still reports incomplete', async () => {
    const { wrapper } = setup(empty, { ...empty, first_name: 'Maya', is_profile_complete: false });
    await render(<ProfileStep />, { wrapper });
    await fillRequired();
    await fireEvent.press(screen.getByTestId('onboarding-profile-primary'));
    expect(await screen.findByTestId('onboarding-profile-error')).toHaveTextContent(
      /isn’t complete yet/,
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('ready step: a complete server profile can finish; progress is cleared', async () => {
    const complete = { ...empty, first_name: 'Maya', is_profile_complete: true };
    const { wrapper, refetch, transport } = setup(complete);
    markStepCompleted(USER_ID, 'photos');
    await render(<ReadyStep />, { wrapper });
    expect(refetch).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('onboarding-ready-primary'));
    // Clearing the marker is what hands over to the app (the root guard flips to `app`);
    // the step never navigates into the still-guarded tabs itself.
    expect(getCompletedStep(USER_ID)).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    expect(transport.capture).toHaveBeenCalledWith('onboarding_completed', {
      photo_count: 1,
      interest_count: 2,
    });
  });

  it('ready step: an incomplete server profile cannot finish', async () => {
    const { wrapper } = setup(empty);
    await render(<ReadyStep />, { wrapper });
    await fireEvent.press(screen.getByTestId('onboarding-ready-primary'));
    expect(await screen.findByTestId('onboarding-ready-error')).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
