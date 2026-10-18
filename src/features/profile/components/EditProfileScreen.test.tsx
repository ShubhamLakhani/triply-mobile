import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useAuthSession } from '@/features/auth/hooks/use-auth-session';

import { ProfileError } from '../api/profile-errors';

import { useOwnProfile, useUpdateProfile } from '../hooks/use-own-profile';
import type { Profile } from '../types';

import { EditProfileScreen } from './EditProfileScreen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, push: jest.fn(), replace: jest.fn() },
}));
jest.mock('@/features/auth/hooks/use-auth-session', () => ({ useAuthSession: jest.fn() }));
jest.mock('../hooks/use-own-profile', () => ({
  useOwnProfile: jest.fn(),
  useUpdateProfile: jest.fn(),
}));

const USER_ID = '1a000000-0000-4000-8000-00000000000a';
const profile: Profile = {
  id: USER_ID,
  first_name: 'Asha',
  date_of_birth: '1995-05-17',
  gender: 'woman',
  bio: 'Slow travel, fast coffee.',
  home_city: 'Lisbon',
  home_country: 'Portugal',
  occupation: 'Nurse',
  is_profile_complete: true,
  // Not completed yet: the date of birth is still editable (see the locked tests below).
  onboarding_completed_at: null,
  discovery_paused_at: null,
  created_at: '',
  updated_at: '',
};

function setup(current: Profile | undefined = profile) {
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
  jest
    .mocked(useOwnProfile)
    .mockReturnValue({ data: current, isLoading: false } as unknown as ReturnType<
      typeof useOwnProfile
    >);
  const mutateAsync = jest.fn().mockResolvedValue({ ...profile, is_profile_complete: true });
  jest
    .mocked(useUpdateProfile)
    .mockReturnValue({ mutateAsync, isPending: false } as unknown as ReturnType<
      typeof useUpdateProfile
    >);
  return { mutateAsync };
}

describe('EditProfileScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('prefills existing values', async () => {
    setup();
    await render(<EditProfileScreen />);
    expect(screen.getByTestId('field-first-name').props.value).toBe('Asha');
    expect(screen.getByTestId('field-dob-day').props.value).toBe('17');
    expect(screen.getByTestId('field-dob-month').props.value).toBe('05');
    expect(screen.getByTestId('field-dob-year').props.value).toBe('1995');
    expect(screen.getByTestId('field-bio').props.value).toBe('Slow travel, fast coffee.');
    expect(screen.getByTestId('field-gender-woman').props.accessibilityState.checked).toBe(true);
  });

  it('saves only editable fields, never protected ones', async () => {
    const { mutateAsync } = setup();
    await render(<EditProfileScreen />);
    await fireEvent.changeText(screen.getByTestId('field-first-name'), 'Asha M');
    await fireEvent.changeText(screen.getByTestId('field-occupation'), '');

    await fireEvent.press(screen.getByTestId('edit-profile-save'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const payload = mutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual({
      first_name: 'Asha M',
      date_of_birth: '1995-05-17',
      gender: 'woman',
      bio: 'Slow travel, fast coffee.',
      home_city: 'Lisbon',
      home_country: 'Portugal',
      occupation: null,
    });
    for (const key of [
      'id',
      'is_profile_complete',
      'is_discoverable',
      'onboarding_completed_at',
      'discovery_paused_at',
      'created_at',
      'updated_at',
    ]) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it('blocks saving with inline validation when required fields are missing or under 18', async () => {
    const { mutateAsync } = setup();
    await render(<EditProfileScreen />);
    await fireEvent.changeText(screen.getByTestId('field-first-name'), '');
    await fireEvent.changeText(
      screen.getByTestId('field-dob-year'),
      String(new Date().getFullYear() - 16),
    );
    await fireEvent.press(screen.getByTestId('edit-profile-save'));
    expect(await screen.findByText('Tell us your first name.')).toBeOnTheScreen();
    expect(await screen.findByText(/18 or over/)).toBeOnTheScreen();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('after onboarding, shows the date of birth read-only and never sends it', async () => {
    const { mutateAsync } = setup({ ...profile, onboarding_completed_at: '2026-10-11T10:00:00Z' });
    await render(<EditProfileScreen />);
    for (const id of ['field-dob-day', 'field-dob-month', 'field-dob-year']) {
      expect(screen.getByTestId(id).props.editable).toBe(false);
    }
    expect(screen.getByText(/can’t be changed after sign-up/)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('field-bio'), 'Mountains over beaches.');
    await fireEvent.press(screen.getByTestId('edit-profile-save'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const payload = mutateAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('date_of_birth');
    expect(payload).toMatchObject({ bio: 'Mountains over beaches.' });
  });

  it('caps the bio at 500 characters', async () => {
    setup();
    await render(<EditProfileScreen />);
    expect(screen.getByTestId('field-bio').props.maxLength).toBe(500);
  });

  it('explains an inactive account from the server', async () => {
    const { mutateAsync } = setup({ ...profile, onboarding_completed_at: '2026-10-11T10:00:00Z' });
    mutateAsync.mockRejectedValueOnce(new ProfileError('account_inactive', 'inactive'));
    await render(<EditProfileScreen />);
    await fireEvent.press(screen.getByTestId('edit-profile-save'));
    expect(await screen.findByText('Your account can’t make changes right now.')).toBeOnTheScreen();
  });

  it('shows a friendly message when the server rejects the save', async () => {
    const { mutateAsync } = setup();
    mutateAsync.mockRejectedValue(
      new ProfileError('rejected_by_database', 'new row violates check constraint "profiles_x"'),
    );
    await render(<EditProfileScreen />);
    await fireEvent.press(screen.getByTestId('edit-profile-save'));
    expect(await screen.findByTestId('edit-profile-error')).toBeOnTheScreen();
    expect(screen.queryByText(/check constraint/)).toBeNull();
  });
});
