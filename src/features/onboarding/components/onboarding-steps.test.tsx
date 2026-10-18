import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useAuthSession } from '@/features/auth/hooks/use-auth-session';
import { useInterestSelection } from '@/features/interests/hooks/use-interest-selection';
import { useOwnInterests } from '@/features/interests/hooks/use-interests';
import { useOwnProfilePhotos } from '@/features/photos/hooks/use-profile-photos';
import { profileKeys } from '@/features/profile/api/profile-keys';
import { useOwnProfile, useUpdateProfile } from '@/features/profile/hooks/use-own-profile';
import type { Profile } from '@/features/profile/types';

import { createTestProviders } from '../../../../tests/utils/render-with-providers';
import { completeOnboarding, OnboardingError } from '../api/onboarding-api';
import { clearOnboardingProgress, getCompletedStep, markStepCompleted } from '../progress';

import { InterestsStep } from './InterestsStep';
import { PhotosStep } from './PhotosStep';
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
jest.mock('@/features/interests/hooks/use-interest-selection', () => ({
  useInterestSelection: jest.fn(),
}));
jest.mock('@/features/photos/components/PhotoManager', () => ({ PhotoManager: () => null }));
jest.mock('../api/onboarding-api', () => {
  const actual = jest.requireActual('../api/onboarding-api');
  return { ...actual, completeOnboarding: jest.fn() };
});
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
  onboarding_completed_at: null,
  discovery_paused_at: null,
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
    passwordRecovery: false,
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

  it('ready step: the server completes onboarding; the cache flips, the marker is cleared', async () => {
    const complete = { ...empty, first_name: 'Maya', is_profile_complete: true };
    const completed = { ...complete, onboarding_completed_at: '2026-10-11T10:00:00Z' };
    jest.mocked(completeOnboarding).mockResolvedValue(completed);
    const { wrapper, queryClient, transport } = setup(complete);
    markStepCompleted(USER_ID, 'photos');
    await render(<ReadyStep />, { wrapper });
    await fireEvent.press(screen.getByTestId('onboarding-ready-primary'));
    await waitFor(() => expect(completeOnboarding).toHaveBeenCalledTimes(1));
    // The updated row (server timestamp) is what hands over to the app via the root guard;
    // the step never navigates into the still-guarded tabs itself.
    await waitFor(() =>
      expect(queryClient.getQueryData(profileKeys.own(USER_ID))).toEqual(completed),
    );
    expect(getCompletedStep(USER_ID)).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    expect(transport.capture).toHaveBeenCalledWith('onboarding_completed', {
      photo_count: 1,
      interest_count: 2,
    });
  });

  it('ready step: lists what is missing and offers to fix the earliest step', async () => {
    jest
      .mocked(completeOnboarding)
      .mockRejectedValue(
        new OnboardingError('incomplete', 'x', { missing: ['photos', 'interests'] }),
      );
    const { wrapper } = setup({ ...empty, first_name: 'Maya', is_profile_complete: true });
    await render(<ReadyStep />, { wrapper });
    await fireEvent.press(screen.getByTestId('onboarding-ready-primary'));
    expect(await screen.findByTestId('onboarding-ready-error')).toHaveTextContent(
      'Almost there. Still needed: 3 to 8 interests, at least one photo.',
    );
    await fireEvent.press(screen.getByTestId('onboarding-ready-secondary'));
    expect(router.replace).toHaveBeenCalledWith('/onboarding/interests');
    expect(getCompletedStep(USER_ID)).toBeNull();
  });

  it('ready step: an inactive account or a network failure settles with a message', async () => {
    jest
      .mocked(completeOnboarding)
      .mockRejectedValueOnce(new OnboardingError('account_inactive', 'x'))
      .mockRejectedValueOnce(new Error('Network request failed'));
    const { wrapper } = setup({ ...empty, first_name: 'Maya', is_profile_complete: true });
    await render(<ReadyStep />, { wrapper });
    await fireEvent.press(screen.getByTestId('onboarding-ready-primary'));
    expect(await screen.findByTestId('onboarding-ready-error')).toHaveTextContent(
      /can’t make changes/,
    );
    await fireEvent.press(screen.getByTestId('onboarding-ready-primary'));
    expect(await screen.findByTestId('onboarding-ready-error')).toHaveTextContent(
      /Check your connection/,
    );
    // No infinite spinner: the button is usable again.
    expect(
      screen.getByTestId('onboarding-ready-primary').props.accessibilityState.busy,
    ).toBeFalsy();
  });

  it('interests step: Continue needs 3 interests and there is no skip', async () => {
    const save = jest.fn().mockResolvedValue(['a', 'b', 'c']);
    const selection = (ids: string[]) => ({
      status: 'ready',
      catalog: [],
      isLoading: false,
      isError: false,
      isStale: false,
      isRetrying: false,
      retry: jest.fn(),
      selectedIds: ids,
      toggle: jest.fn(),
      isDirty: true,
      meetsMinimum: ids.length >= 3 && ids.length <= 8,
      save,
      isSaving: false,
    });
    const { wrapper } = setup({ ...empty, first_name: 'Maya', is_profile_complete: true });
    jest.mocked(useInterestSelection).mockReturnValue(selection(['a', 'b']) as never);
    const view = await render(<InterestsStep />, { wrapper });
    expect(screen.getByTestId('onboarding-interests-primary')).toHaveTextContent('Pick 1 more');
    expect(
      screen.getByTestId('onboarding-interests-primary').props.accessibilityState.disabled,
    ).toBe(true);
    expect(screen.queryByTestId('onboarding-interests-secondary')).toBeNull();

    jest.mocked(useInterestSelection).mockReturnValue(selection(['a', 'b', 'c']) as never);
    await view.rerender(<InterestsStep />);
    await fireEvent.press(screen.getByTestId('onboarding-interests-primary'));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(router.replace).toHaveBeenCalledWith('/onboarding/preferences');
  });

  it('photos step: a photo is required and there is no skip', async () => {
    const { wrapper } = setup({ ...empty, first_name: 'Maya', is_profile_complete: true });
    jest.mocked(useOwnProfilePhotos).mockReturnValue({ data: [], isLoading: false } as never);
    await render(<PhotosStep />, { wrapper });
    expect(screen.getByTestId('onboarding-photos-primary').props.accessibilityState.disabled).toBe(
      true,
    );
    expect(screen.queryByTestId('onboarding-photos-secondary')).toBeNull();
  });
});
