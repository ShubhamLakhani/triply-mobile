import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createTestProviders } from '../../../../tests/utils/render-with-providers';
import {
  fetchOwnDiscoveryPreferences,
  fetchOwnGenderPreferences,
  setGenderPreferences,
  updateDiscoveryPreferences,
} from '../api/preference-api';
import type { DiscoveryPreferences } from '../types';

import { usePreferencesDraft } from './use-preferences-draft';

jest.mock('../api/preference-api', () => ({
  fetchOwnDiscoveryPreferences: jest.fn(),
  fetchOwnGenderPreferences: jest.fn(),
  setGenderPreferences: jest.fn(),
  updateDiscoveryPreferences: jest.fn(),
}));

const USER_ID = '5f0c1c1e-5a8b-4f6e-9c7d-2b1f0e3a4d5c';
const savedRow: DiscoveryPreferences = {
  user_id: USER_ID,
  min_age: 27,
  max_age: 38,
  minimum_overlap_days: 3,
  created_at: '',
  updated_at: '',
};

describe('usePreferencesDraft', () => {
  afterEach(() => jest.clearAllMocks());

  it('a load failure is an error state: nothing to show, and save is refused', async () => {
    jest.mocked(fetchOwnDiscoveryPreferences).mockRejectedValue(new Error('offline'));
    jest.mocked(fetchOwnGenderPreferences).mockResolvedValue(['woman']);
    const { wrapper } = createTestProviders();
    const { result } = await renderHook(() => usePreferencesDraft(USER_ID), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.value).toBeNull();
    // Defaults are never offered as editable values.
    await act(async () => result.current.setValue({ ...savedRow, genders: [] }));
    expect(result.current.value).toBeNull();
    await expect(result.current.save()).rejects.toThrow('not loaded');
    expect(updateDiscoveryPreferences).not.toHaveBeenCalled();
    expect(setGenderPreferences).not.toHaveBeenCalled();
  });

  it('retry recovers and then shows the saved values', async () => {
    jest
      .mocked(fetchOwnDiscoveryPreferences)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(savedRow);
    jest.mocked(fetchOwnGenderPreferences).mockResolvedValue(['woman']);
    const { wrapper } = createTestProviders();
    const { result } = await renderHook(() => usePreferencesDraft(USER_ID), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('error'));

    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.value).toEqual({
      min_age: 27,
      max_age: 38,
      minimum_overlap_days: 3,
      genders: ['woman'],
    });
  });

  it('empty saved gender preferences are real data, not an error', async () => {
    jest.mocked(fetchOwnDiscoveryPreferences).mockResolvedValue(savedRow);
    jest.mocked(fetchOwnGenderPreferences).mockResolvedValue([]);
    const { wrapper } = createTestProviders();
    const { result } = await renderHook(() => usePreferencesDraft(USER_ID), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.isError).toBe(false);
    expect(result.current.value?.genders).toEqual([]);
  });

  it('cached values survive a failed refetch and remain the values that get saved', async () => {
    jest
      .mocked(fetchOwnDiscoveryPreferences)
      .mockResolvedValueOnce(savedRow)
      .mockRejectedValue(new Error('offline'));
    jest.mocked(fetchOwnGenderPreferences).mockResolvedValue(['man']);
    jest.mocked(updateDiscoveryPreferences).mockResolvedValue(savedRow);
    jest.mocked(setGenderPreferences).mockResolvedValue(['man']);
    const { wrapper, queryClient } = createTestProviders();
    const { result } = await renderHook(() => usePreferencesDraft(USER_ID), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await queryClient.refetchQueries();
    });
    await waitFor(() => expect(result.current.isStale).toBe(true));
    expect(result.current.status).toBe('ready');
    expect(result.current.value?.min_age).toBe(27);

    await act(async () => result.current.save());
    expect(updateDiscoveryPreferences).toHaveBeenCalledWith(USER_ID, {
      min_age: 27,
      max_age: 38,
      minimum_overlap_days: 3,
    });
    expect(setGenderPreferences).toHaveBeenCalledWith(['man']);
  });

  it('only marks the draft dirty after a real change', async () => {
    jest.mocked(fetchOwnDiscoveryPreferences).mockResolvedValue(savedRow);
    jest.mocked(fetchOwnGenderPreferences).mockResolvedValue([]);
    const { wrapper } = createTestProviders();
    const { result } = await renderHook(() => usePreferencesDraft(USER_ID), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.isDirty).toBe(false);
    const value = result.current.value;
    if (!value) throw new Error('expected loaded preferences');
    await act(async () => result.current.setValue({ ...value, max_age: 40 }));
    expect(result.current.isDirty).toBe(true);
  });
});
