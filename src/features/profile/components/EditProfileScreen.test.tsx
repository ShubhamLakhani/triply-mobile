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
  is_discoverable: false,
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
