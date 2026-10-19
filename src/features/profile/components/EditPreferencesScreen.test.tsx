import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useAuthSession } from '@/features/auth/hooks/use-auth-session';
import {
  fetchOwnDiscoveryPreferences,
  fetchOwnGenderPreferences,
  setGenderPreferences,
  updateDiscoveryPreferences,
} from '@/features/preferences/api/preference-api';

import { createTestProviders } from '../../../../tests/utils/render-with-providers';

import { EditPreferencesScreen } from './EditPreferencesScreen';

// The selection/draft hooks import the device draft store (expo-sqlite): not under test here.
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
jest.mock('@/features/auth/hooks/use-auth-session', () => ({ useAuthSession: jest.fn() }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true } }));
jest.mock('@/features/preferences/api/preference-api', () => ({
  fetchOwnDiscoveryPreferences: jest.fn(),
  fetchOwnGenderPreferences: jest.fn(),
  setGenderPreferences: jest.fn(),
  updateDiscoveryPreferences: jest.fn(),
}));

const USER_ID = '5f0c1c1e-5a8b-4f6e-9c7d-2b1f0e3a4d5c';

describe('EditPreferencesScreen', () => {
  beforeEach(() => {
    jest.mocked(useAuthSession).mockReturnValue({
      session: null,
      userId: USER_ID,
      isAuthenticated: true,
      isLoading: false,
      isInitializing: false,
      restoreError: null,
      retryRestore: jest.fn(),
      passwordRecovery: false,
      signOut: jest.fn(),
    });
  });
  afterEach(() => jest.clearAllMocks());

  it('a load failure shows Retry and keeps Save disabled; retry recovers', async () => {
    jest
      .mocked(fetchOwnDiscoveryPreferences)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({
        user_id: USER_ID,
        min_age: 25,
        max_age: 35,
        minimum_overlap_days: 2,
        created_at: '',
        updated_at: '',
      });
    jest.mocked(fetchOwnGenderPreferences).mockResolvedValue(['woman']);
    const { wrapper } = createTestProviders();
    await render(<EditPreferencesScreen />, { wrapper });

    expect(await screen.findByTestId('preferences-load-error')).toBeOnTheScreen();
    const save = screen.getByTestId('edit-preferences-save');
    expect(save.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(save);
    expect(updateDiscoveryPreferences).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('preferences-load-error-retry'));
    await waitFor(() => expect(screen.queryByTestId('preferences-load-error')).toBeNull());
    expect(screen.getByTestId('pref-min-age')).toBeOnTheScreen();
    expect(screen.getByTestId('pref-genders')).toBeOnTheScreen();
    // Still nothing to save until the user changes something.
    expect(screen.getByTestId('edit-preferences-save').props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('cannot save with no gender preference; Everyone saves every canonical value', async () => {
    const saved = {
      user_id: USER_ID,
      min_age: 25,
      max_age: 35,
      minimum_overlap_days: 2,
      created_at: '',
      updated_at: '',
    };
    jest.mocked(fetchOwnDiscoveryPreferences).mockResolvedValue(saved);
    jest.mocked(fetchOwnGenderPreferences).mockResolvedValue(['woman']);
    jest.mocked(updateDiscoveryPreferences).mockResolvedValue(saved);
    jest
      .mocked(setGenderPreferences)
      .mockResolvedValue(['man', 'woman', 'non_binary', 'other', 'prefer_not_to_say']);
    const { wrapper } = createTestProviders();
    await render(<EditPreferencesScreen />, { wrapper });
    await screen.findByTestId('pref-genders');

    // Deselect the only choice: Save stays disabled and the field explains why.
    await fireEvent.press(screen.getByTestId('pref-genders-woman'));
    expect(await screen.findByText('Choose at least one option.')).toBeOnTheScreen();
    expect(screen.getByTestId('edit-preferences-save').props.accessibilityState.disabled).toBe(
      true,
    );

    await fireEvent.press(screen.getByTestId('pref-genders-everyone'));
    expect(screen.getByTestId('pref-genders-everyone').props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByTestId('edit-preferences-save'));
    await waitFor(() =>
      expect(setGenderPreferences).toHaveBeenCalledWith([
        'man',
        'woman',
        'non_binary',
        'other',
        'prefer_not_to_say',
      ]),
    );
  });
});
