/**
 * Onboarding step drafts survive a cold restart (found on the iOS simulator in Pre-3M review):
 * the real selection/draft hooks run against mocked APIs and a Map-backed device storage. A
 * "cold restart" = unmount the step (component state gone) and render it again (device storage
 * intact).
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useAuthSession } from '@/features/auth/hooks/use-auth-session';
import {
  fetchActiveInterests,
  fetchOwnInterests,
  replaceOwnInterests,
} from '@/features/interests/api/interest-api';
import { onboardingInterestsDraft } from '@/features/interests/drafts';
import type { InterestSummary, OwnInterest } from '@/features/interests/types';
import {
  fetchOwnDiscoveryPreferences,
  fetchOwnGenderPreferences,
  setGenderPreferences,
  updateDiscoveryPreferences,
} from '@/features/preferences/api/preference-api';
import { onboardingPreferencesDraft } from '@/features/preferences/drafts';
import { fetchOwnProfile, updateOwnProfile } from '@/features/profile/api/profile-api';
import { ProfileError } from '@/features/profile/api/profile-errors';
import { onboardingProfileDraft } from '@/features/profile/drafts';
import type { Profile } from '@/features/profile/types';
import { getDeviceLocalStorage } from '@/services/storage/local-storage';

import { createTestProviders } from '../../../../tests/utils/render-with-providers';
import { clearOnboardingProgress, getCompletedStep } from '../progress';

import { InterestsStep } from './InterestsStep';
import { PreferencesStep } from './PreferencesStep';
import { ProfileStep } from './ProfileStep';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), canGoBack: () => false, push: jest.fn() },
}));
jest.mock('@/features/auth/hooks/use-auth-session', () => ({ useAuthSession: jest.fn() }));
jest.mock('@/features/profile/api/profile-api', () => ({
  fetchOwnProfile: jest.fn(),
  updateOwnProfile: jest.fn(),
}));
jest.mock('@/features/interests/api/interest-api', () => ({
  fetchActiveInterests: jest.fn(),
  fetchOwnInterests: jest.fn(),
  replaceOwnInterests: jest.fn(),
}));
jest.mock('@/features/preferences/api/preference-api', () => ({
  fetchOwnDiscoveryPreferences: jest.fn(),
  fetchOwnGenderPreferences: jest.fn(),
  setGenderPreferences: jest.fn(),
  updateDiscoveryPreferences: jest.fn(),
}));
jest.mock('@/services/storage/local-storage', () => ({ getDeviceLocalStorage: jest.fn() }));

const USER_A = '1a000000-0000-4000-8000-00000000000a';
const USER_B = '2b000000-0000-4000-8000-00000000000b';

const catalog: InterestSummary[] = ['hiking', 'yoga', 'coffee', 'art'].map((slug, i) => ({
  id: `e0000000-0000-4000-8000-00000000000${i + 1}`,
  slug,
  label: slug[0]!.toUpperCase() + slug.slice(1),
  category: 'testing',
}));
const idOf = (slug: string) => catalog.find((c) => c.slug === slug)!.id;
const own = (ids: string[]) =>
  ids.map((interest_id) => ({ interest_id, created_at: '' })) as unknown as OwnInterest[];
const emptyProfile = (userId: string): Profile => ({
  id: userId,
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
});
const savedPrefs = (userId: string) => ({
  user_id: userId,
  min_age: 18,
  max_age: 99,
  minimum_overlap_days: 1,
  created_at: '',
  updated_at: '',
});

/** Device storage shared across "restarts" within one test; writes can be made to fail. */
let device: Map<string, string>;
let failDeviceWrites = false;
function installDevice() {
  device = new Map();
  jest.mocked(getDeviceLocalStorage).mockReturnValue({
    getItem: (k: string) => device.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failDeviceWrites) throw new Error('disk full');
      device.set(k, v);
    },
    removeItem: (k: string) => device.delete(k),
  } as unknown as Storage);
}

function signIn(userId: string) {
  jest.mocked(useAuthSession).mockReturnValue({
    userId,
    isAuthenticated: true,
    isLoading: false,
    isInitializing: false,
    session: null,
    restoreError: null,
    retryRestore: jest.fn(),
    passwordRecovery: false,
    signOut: jest.fn(),
  });
}

const chip = (slug: string) => screen.getByTestId(`interest-${slug}`);
const checked = (slug: string) => chip(slug).props.accessibilityState.checked as boolean;

describe('onboarding drafts survive a cold restart', () => {
  beforeEach(() => {
    installDevice();
    failDeviceWrites = false;
    signIn(USER_A);
    jest.mocked(fetchOwnProfile).mockImplementation(async (userId) => emptyProfile(userId));
    jest.mocked(updateOwnProfile).mockImplementation(async (userId, input) => ({
      ...emptyProfile(userId),
      ...input,
      is_profile_complete: true,
    }));
    jest.mocked(fetchActiveInterests).mockResolvedValue(catalog);
    jest.mocked(fetchOwnInterests).mockResolvedValue([]);
    jest.mocked(replaceOwnInterests).mockImplementation(async (ids) => [...ids]);
    jest
      .mocked(fetchOwnDiscoveryPreferences)
      .mockImplementation(async (userId) => savedPrefs(userId));
    jest.mocked(fetchOwnGenderPreferences).mockResolvedValue([]);
    jest.mocked(updateDiscoveryPreferences).mockImplementation(async (userId, input) => ({
      ...savedPrefs(userId),
      ...input,
    }));
    jest.mocked(setGenderPreferences).mockImplementation(async (genders) => [...genders]);
  });
  afterEach(async () => {
    // A step may still be mounted here (RNTL unmounts afterwards): the store emits inside act.
    await act(async () => {
      clearOnboardingProgress(USER_A);
      clearOnboardingProgress(USER_B);
    });
    jest.clearAllMocks();
  });

  it('interests: selected → force-close → restart → the same chips are selected (unsaved)', async () => {
    const first = await render(<InterestsStep />, { wrapper: createTestProviders().wrapper });
    await screen.findByTestId('interest-picker');
    await fireEvent.press(chip('hiking'));
    await fireEvent.press(chip('yoga'));
    expect(screen.getByTestId('interest-picker-count')).toHaveTextContent(/^2 of 8 chosen/);
    // Nothing reached the server yet (Continue was never tapped) …
    expect(replaceOwnInterests).not.toHaveBeenCalled();
    // … but the device holds the draft under this user's key.
    expect(onboardingInterestsDraft.read(USER_A)).toEqual([idOf('hiking'), idOf('yoga')]);

    await first.unmount(); // force-close: all component state is gone
    await render(<InterestsStep />, { wrapper: createTestProviders().wrapper });
    await screen.findByTestId('interest-picker');
    expect(screen.getByTestId('interest-picker-count')).toHaveTextContent(
      '2 of 8 chosen — pick at least 3',
    );
    expect(checked('hiking')).toBe(true);
    expect(checked('yoga')).toBe(true);
    expect(checked('coffee')).toBe(false);

    // Continuing saves exactly the restored draft and drops the device copy.
    await fireEvent.press(chip('coffee'));
    await fireEvent.press(screen.getByTestId('onboarding-interests-primary'));
    await waitFor(() =>
      expect(replaceOwnInterests).toHaveBeenCalledWith([
        idOf('hiking'),
        idOf('yoga'),
        idOf('coffee'),
      ]),
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding/preferences'));
    expect(onboardingInterestsDraft.read(USER_A)).toBeNull();
    expect(getCompletedStep(USER_A)).toBe('interests');
  });

  it('interests: a draft restored after restart wins over the (older) server selection', async () => {
    jest.mocked(fetchOwnInterests).mockResolvedValue(own([idOf('art')]));
    const first = await render(<InterestsStep />, { wrapper: createTestProviders().wrapper });
    await screen.findByTestId('interest-picker');
    expect(checked('art')).toBe(true);
    await fireEvent.press(chip('art')); // deselect the saved one
    await fireEvent.press(chip('hiking'));
    await first.unmount();

    await render(<InterestsStep />, { wrapper: createTestProviders().wrapper });
    await screen.findByTestId('interest-picker');
    expect(checked('art')).toBe(false);
    expect(checked('hiking')).toBe(true);
  });

  it('preferences: edited → force-close → restart → the same values are shown (unsaved)', async () => {
    const first = await render(<PreferencesStep />, { wrapper: createTestProviders().wrapper });
    await screen.findByTestId('pref-genders');
    await fireEvent.press(screen.getByTestId('pref-genders-everyone'));
    await fireEvent.press(screen.getByTestId('pref-min-age-increment'));
    await fireEvent.press(screen.getByTestId('pref-min-age-increment'));
    await fireEvent.press(screen.getByTestId('pref-overlap-increment'));
    expect(screen.getByTestId('pref-min-age-value')).toHaveTextContent('20');
    expect(updateDiscoveryPreferences).not.toHaveBeenCalled();
    expect(setGenderPreferences).not.toHaveBeenCalled();
    expect(onboardingPreferencesDraft.read(USER_A)).toEqual({
      min_age: 20,
      max_age: 99,
      minimum_overlap_days: 2,
      genders: ['man', 'woman', 'non_binary', 'other', 'prefer_not_to_say'],
    });

    await first.unmount();
    await render(<PreferencesStep />, { wrapper: createTestProviders().wrapper });
    await screen.findByTestId('pref-genders');
    expect(screen.getByTestId('pref-genders-everyone').props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId('pref-min-age-value')).toHaveTextContent('20');
    expect(screen.getByTestId('pref-overlap-value')).toHaveTextContent('2 days');

    await fireEvent.press(screen.getByTestId('onboarding-preferences-primary'));
    await waitFor(() =>
      expect(updateDiscoveryPreferences).toHaveBeenCalledWith(USER_A, {
        min_age: 20,
        max_age: 99,
        minimum_overlap_days: 2,
      }),
    );
    expect(setGenderPreferences).toHaveBeenCalledWith([
      'man',
      'woman',
      'non_binary',
      'other',
      'prefer_not_to_say',
    ]);
    await waitFor(() => expect(onboardingPreferencesDraft.read(USER_A)).toBeNull());
    expect(router.replace).toHaveBeenCalledWith('/onboarding/photos');
  });

  it('an account switch never shows another user’s draft', async () => {
    const asA = await render(<InterestsStep />, { wrapper: createTestProviders().wrapper });
    await screen.findByTestId('interest-picker');
    await fireEvent.press(chip('hiking'));
    await asA.unmount();
    const prefsA = await render(<PreferencesStep />, { wrapper: createTestProviders().wrapper });
    await screen.findByTestId('pref-genders');
    await fireEvent.press(screen.getByTestId('pref-genders-woman'));
    await prefsA.unmount();

    signIn(USER_B);
    const asB = await render(<InterestsStep />, { wrapper: createTestProviders().wrapper });
    await screen.findByTestId('interest-picker');
    expect(checked('hiking')).toBe(false);
    expect(screen.getByTestId('interest-picker-count')).toHaveTextContent(/^0 of 8/);
    await asB.unmount();
    await render(<PreferencesStep />, { wrapper: createTestProviders().wrapper });
    await screen.findByTestId('pref-genders');
    expect(screen.getByTestId('pref-genders-woman').props.accessibilityState.checked).toBe(false);

    // A's drafts are still there for A.
    expect(onboardingInterestsDraft.read(USER_A)).toEqual([idOf('hiking')]);
    expect(onboardingPreferencesDraft.read(USER_A)?.genders).toEqual(['woman']);
    expect(onboardingInterestsDraft.read(USER_B)).toBeNull();
    expect(onboardingPreferencesDraft.read(USER_B)).toBeNull();
  });

  it('a failed device write warns, keeps the picks on screen and still saves on Continue', async () => {
    failDeviceWrites = true;
    await render(<InterestsStep />, { wrapper: createTestProviders().wrapper });
    await screen.findByTestId('interest-picker');
    await fireEvent.press(chip('hiking'));
    expect(checked('hiking')).toBe(true); // the tap is not lost
    expect(await screen.findByTestId('interests-draft-error')).toHaveTextContent(
      /couldn’t keep a copy/,
    );
    expect(device.size).toBe(0);

    await fireEvent.press(chip('yoga'));
    await fireEvent.press(chip('coffee'));
    await fireEvent.press(screen.getByTestId('onboarding-interests-primary'));
    await waitFor(() => expect(replaceOwnInterests).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding/preferences'));
  });

  it('a failed server save shows a recoverable error; the draft survives and a retry works', async () => {
    jest.mocked(replaceOwnInterests).mockRejectedValueOnce(new Error('Network request failed'));
    const first = await render(<InterestsStep />, { wrapper: createTestProviders().wrapper });
    await screen.findByTestId('interest-picker');
    for (const slug of ['hiking', 'yoga', 'coffee']) await fireEvent.press(chip(slug));
    await fireEvent.press(screen.getByTestId('onboarding-interests-primary'));
    expect(await screen.findByTestId('onboarding-interests-error')).toHaveTextContent(
      /couldn’t save your interests/,
    );
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByTestId('interest-picker-count')).toHaveTextContent('3 of 8 chosen');
    // Still on the device: even a force-close now would not lose the picks.
    expect(onboardingInterestsDraft.read(USER_A)).toHaveLength(3);

    await first.unmount();
    await render(<InterestsStep />, { wrapper: createTestProviders().wrapper });
    await screen.findByTestId('interest-picker');
    expect(screen.getByTestId('interest-picker-count')).toHaveTextContent('3 of 8 chosen');
    await fireEvent.press(screen.getByTestId('onboarding-interests-primary'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding/preferences'));
    expect(replaceOwnInterests).toHaveBeenCalledTimes(2);
    expect(onboardingInterestsDraft.read(USER_A)).toBeNull();
  });

  it('preferences: a failed server save keeps the draft; the partial save is completed on retry', async () => {
    jest.mocked(setGenderPreferences).mockRejectedValueOnce(new Error('Network request failed'));
    await render(<PreferencesStep />, { wrapper: createTestProviders().wrapper });
    await screen.findByTestId('pref-genders');
    await fireEvent.press(screen.getByTestId('pref-genders-man'));
    await fireEvent.press(screen.getByTestId('pref-max-age-decrement'));
    await fireEvent.press(screen.getByTestId('onboarding-preferences-primary'));
    expect(await screen.findByTestId('onboarding-preferences-error')).toHaveTextContent(
      /couldn’t save your preferences/,
    );
    // The age range reached the server, the genders did not: the draft stays until both did.
    expect(updateDiscoveryPreferences).toHaveBeenCalledTimes(1);
    expect(onboardingPreferencesDraft.read(USER_A)).toMatchObject({
      max_age: 98,
      genders: ['man'],
    });

    await fireEvent.press(screen.getByTestId('onboarding-preferences-primary'));
    await waitFor(() => expect(setGenderPreferences).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onboardingPreferencesDraft.read(USER_A)).toBeNull());
    expect(router.replace).toHaveBeenCalledWith('/onboarding/photos');
  });

  it('finishing onboarding forgets any leftover drafts', () => {
    onboardingInterestsDraft.write(USER_A, [idOf('hiking')]);
    onboardingPreferencesDraft.write(USER_A, {
      min_age: 18,
      max_age: 99,
      minimum_overlap_days: 1,
      genders: ['man'],
    });
    clearOnboardingProgress(USER_A);
    expect(onboardingInterestsDraft.read(USER_A)).toBeNull();
    expect(onboardingPreferencesDraft.read(USER_A)).toBeNull();
  });

  describe('profile step', () => {
    const field = (id: string) => screen.getByTestId(id);
    const value = (id: string) => field(id).props.value as string;
    const typed = {
      first_name: 'Maya',
      dob_day: '07',
      dob_month: '03',
      dob_year: '1994',
      gender: 'woman' as const,
    };
    async function typeProfile() {
      await screen.findByTestId('field-first-name');
      await fireEvent.changeText(field('field-first-name'), typed.first_name);
      await fireEvent.changeText(field('field-dob-day'), typed.dob_day);
      await fireEvent.changeText(field('field-dob-month'), typed.dob_month);
      await fireEvent.changeText(field('field-dob-year'), typed.dob_year);
      await fireEvent.press(field('field-gender-woman'));
    }
    function expectRestored() {
      expect(value('field-first-name')).toBe('Maya');
      expect(value('field-dob-day')).toBe('07');
      expect(value('field-dob-month')).toBe('03');
      expect(value('field-dob-year')).toBe('1994');
      expect(field('field-gender-woman').props.accessibilityState.checked).toBe(true);
    }

    it('typed values → force-close → restart → the form shows them again (unsaved)', async () => {
      const first = await render(<ProfileStep />, { wrapper: createTestProviders().wrapper });
      await typeProfile();
      expect(updateOwnProfile).not.toHaveBeenCalled();
      expect(onboardingProfileDraft.read(USER_A)).toEqual(typed);

      await first.unmount();
      await render(<ProfileStep />, { wrapper: createTestProviders().wrapper });
      await screen.findByTestId('field-first-name');
      expectRestored();
    });

    it('a half-typed date is restored as typed, never "fixed up"', async () => {
      const first = await render(<ProfileStep />, { wrapper: createTestProviders().wrapper });
      await screen.findByTestId('field-first-name');
      await fireEvent.changeText(field('field-first-name'), 'Ma');
      await fireEvent.changeText(field('field-dob-day'), '7');
      await first.unmount();
      await render(<ProfileStep />, { wrapper: createTestProviders().wrapper });
      await screen.findByTestId('field-first-name');
      expect(value('field-first-name')).toBe('Ma');
      expect(value('field-dob-day')).toBe('7');
      expect(value('field-dob-year')).toBe('');
    });

    it('Continue saves to the server, clears the draft and the row stays authoritative', async () => {
      const first = await render(<ProfileStep />, { wrapper: createTestProviders().wrapper });
      await typeProfile();
      await first.unmount();
      await render(<ProfileStep />, { wrapper: createTestProviders().wrapper });
      await screen.findByTestId('field-first-name');
      await fireEvent.press(screen.getByTestId('onboarding-profile-primary'));
      await waitFor(() =>
        expect(updateOwnProfile).toHaveBeenCalledWith(USER_A, {
          first_name: 'Maya',
          date_of_birth: '1994-03-07',
          gender: 'woman',
          bio: null,
          home_city: null,
          home_country: null,
          occupation: null,
        }),
      );
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding/interests'));
      expect(onboardingProfileDraft.read(USER_A)).toBeNull();
      expect(getCompletedStep(USER_A)).toBe('profile');
    });

    it('a restored draft is applied on top of the server row (hidden fields keep server values)', async () => {
      jest.mocked(fetchOwnProfile).mockImplementation(async (userId) => ({
        ...emptyProfile(userId),
        first_name: 'Server',
        bio: 'Kept from the server.',
      }));
      onboardingProfileDraft.write(USER_A, { ...typed, first_name: 'Draft' });
      await render(<ProfileStep />, { wrapper: createTestProviders().wrapper });
      await screen.findByTestId('field-first-name');
      expect(value('field-first-name')).toBe('Draft');
      await fireEvent.press(screen.getByTestId('onboarding-profile-primary'));
      await waitFor(() =>
        expect(updateOwnProfile).toHaveBeenCalledWith(
          USER_A,
          expect.objectContaining({ first_name: 'Draft', bio: 'Kept from the server.' }),
        ),
      );
    });

    it('a failed server save keeps the draft (survives a restart); the retry succeeds', async () => {
      jest
        .mocked(updateOwnProfile)
        .mockRejectedValueOnce(new ProfileError('unknown', 'Network request failed'));
      const first = await render(<ProfileStep />, { wrapper: createTestProviders().wrapper });
      await typeProfile();
      await fireEvent.press(screen.getByTestId('onboarding-profile-primary'));
      expect(await screen.findByTestId('onboarding-profile-error')).toHaveTextContent(
        /couldn’t save your profile/,
      );
      expect(router.replace).not.toHaveBeenCalled();
      expect(onboardingProfileDraft.read(USER_A)).toEqual(typed);

      await first.unmount();
      await render(<ProfileStep />, { wrapper: createTestProviders().wrapper });
      await screen.findByTestId('field-first-name');
      expectRestored();
      await fireEvent.press(screen.getByTestId('onboarding-profile-primary'));
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding/interests'));
      expect(updateOwnProfile).toHaveBeenCalledTimes(2);
      expect(onboardingProfileDraft.read(USER_A)).toBeNull();
    });

    it('an account switch never shows another user’s profile draft', async () => {
      const asA = await render(<ProfileStep />, { wrapper: createTestProviders().wrapper });
      await typeProfile();
      await asA.unmount();

      signIn(USER_B);
      await render(<ProfileStep />, { wrapper: createTestProviders().wrapper });
      await screen.findByTestId('field-first-name');
      expect(value('field-first-name')).toBe('');
      expect(value('field-dob-year')).toBe('');
      expect(field('field-gender-woman').props.accessibilityState.checked).toBe(false);
      expect(onboardingProfileDraft.read(USER_B)).toBeNull();
      expect(onboardingProfileDraft.read(USER_A)).toEqual(typed);
    });

    it.each([
      ['not JSON', 'not json'],
      ['wrong types', JSON.stringify({ ...typed, first_name: 123 })],
      ['outdated shape', JSON.stringify({ name: 'Old', dob: '1994-03-07' })],
      ['unknown gender', JSON.stringify({ ...typed, gender: 'robot' })],
      ['non-digit date', JSON.stringify({ ...typed, dob_day: '7a' })],
    ])('a corrupt or outdated device draft (%s) is ignored', async (_name, raw) => {
      device.set(onboardingProfileDraft.key(USER_A), raw);
      expect(onboardingProfileDraft.read(USER_A)).toBeNull();
      await render(<ProfileStep />, { wrapper: createTestProviders().wrapper });
      await screen.findByTestId('field-first-name');
      expect(value('field-first-name')).toBe('');
      expect(screen.queryByTestId('onboarding-profile-error')).toBeNull();
      // Typing after a bad draft works and overwrites it with a valid one.
      await fireEvent.changeText(field('field-first-name'), 'Maya');
      expect(onboardingProfileDraft.read(USER_A)?.first_name).toBe('Maya');
    });

    it('a failed device write warns but keeps the typed form and still saves on Continue', async () => {
      failDeviceWrites = true;
      await render(<ProfileStep />, { wrapper: createTestProviders().wrapper });
      await typeProfile();
      expect(await screen.findByTestId('profile-draft-error')).toHaveTextContent(
        /couldn’t keep a copy/,
      );
      expectRestored(); // the in-memory form is untouched
      expect(device.size).toBe(0);
      await fireEvent.press(screen.getByTestId('onboarding-profile-primary'));
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/onboarding/interests'));
    });

    it('finishing onboarding forgets the profile draft too', () => {
      onboardingProfileDraft.write(USER_A, typed);
      clearOnboardingProgress(USER_A);
      expect(onboardingProfileDraft.read(USER_A)).toBeNull();
    });
  });
});
