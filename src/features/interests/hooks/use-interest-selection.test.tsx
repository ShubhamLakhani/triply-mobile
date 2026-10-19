import { act, renderHook, waitFor } from '@testing-library/react-native';

import { createTestProviders } from '../../../../tests/utils/render-with-providers';
import { fetchActiveInterests, fetchOwnInterests, replaceOwnInterests } from '../api/interest-api';
import type { InterestSummary, OwnInterest } from '../types';

import { useInterestSelection } from './use-interest-selection';

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
jest.mock('../api/interest-api', () => ({
  fetchActiveInterests: jest.fn(),
  fetchOwnInterests: jest.fn(),
  replaceOwnInterests: jest.fn(),
}));

const USER_ID = '5f0c1c1e-5a8b-4f6e-9c7d-2b1f0e3a4d5c';
const catalog: InterestSummary[] = [
  { id: 'i-surf', slug: 'surfing', label: 'Surfing', category: 'outdoors' },
  { id: 'i-food', slug: 'street-food', label: 'Street food', category: 'food' },
  { id: 'i-yoga', slug: 'yoga', label: 'Yoga', category: 'wellness' },
];
const own = (ids: string[]) =>
  ids.map((interest_id) => ({ interest_id, created_at: '' })) as unknown as OwnInterest[];

describe('useInterestSelection', () => {
  afterEach(() => jest.clearAllMocks());

  it('a failed load of the saved selection blocks toggling and saving', async () => {
    jest.mocked(fetchActiveInterests).mockResolvedValue(catalog);
    jest.mocked(fetchOwnInterests).mockRejectedValue(new Error('offline'));
    const { wrapper } = createTestProviders();
    const { result } = await renderHook(() => useInterestSelection(USER_ID), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('error'));
    await act(async () => result.current.toggle('i-surf'));
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.isDirty).toBe(false);
    await expect(result.current.save()).rejects.toThrow('not loaded');
    // Never an accidental "replace everything with one interest".
    expect(replaceOwnInterests).not.toHaveBeenCalled();
  });

  it('retry recovers the saved selection', async () => {
    jest.mocked(fetchActiveInterests).mockResolvedValue(catalog);
    jest
      .mocked(fetchOwnInterests)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(own(['i-food', 'i-yoga']));
    const { wrapper } = createTestProviders();
    const { result } = await renderHook(() => useInterestSelection(USER_ID), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('error'));

    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.selectedIds).toEqual(['i-food', 'i-yoga']);
  });

  it('an empty saved selection is real data (ready), not an error', async () => {
    jest.mocked(fetchActiveInterests).mockResolvedValue(catalog);
    jest.mocked(fetchOwnInterests).mockResolvedValue([]);
    const { wrapper } = createTestProviders();
    const { result } = await renderHook(() => useInterestSelection(USER_ID), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.isError).toBe(false);
    await act(async () => result.current.toggle('i-surf'));
    expect(result.current.selectedIds).toEqual(['i-surf']);
    expect(result.current.isDirty).toBe(true);
  });

  it('a failed refetch keeps the cached selection, and saving builds on it', async () => {
    jest.mocked(fetchActiveInterests).mockResolvedValue(catalog);
    jest
      .mocked(fetchOwnInterests)
      .mockResolvedValueOnce(own(['i-food', 'i-yoga']))
      .mockRejectedValue(new Error('offline'));
    jest.mocked(replaceOwnInterests).mockResolvedValue(['i-food', 'i-yoga', 'i-surf']);
    const { wrapper, queryClient } = createTestProviders();
    const { result } = await renderHook(() => useInterestSelection(USER_ID), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await act(async () => {
      await queryClient.refetchQueries();
    });
    await waitFor(() => expect(result.current.isStale).toBe(true));
    expect(result.current.status).toBe('ready');
    expect(result.current.selectedIds).toEqual(['i-food', 'i-yoga']);

    await act(async () => result.current.toggle('i-surf'));
    await act(async () => {
      await result.current.save();
      // TanStack delivers the post-save cache notifications on a 0 ms timer; let it fire inside
      // this act (otherwise it races the unmount and React logs a "not wrapped in act" warning).
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(replaceOwnInterests).toHaveBeenCalledWith(['i-food', 'i-yoga', 'i-surf']);
  });

  it('meetsMinimum only between 3 and 8 selected interests', async () => {
    jest.mocked(fetchActiveInterests).mockResolvedValue(catalog);
    jest.mocked(fetchOwnInterests).mockResolvedValue(own(['i-food', 'i-yoga']));
    const { wrapper } = createTestProviders();
    const { result } = await renderHook(() => useInterestSelection(USER_ID), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.meetsMinimum).toBe(false);
    await act(async () => result.current.toggle('i-surf'));
    expect(result.current.selectedIds).toHaveLength(3);
    expect(result.current.meetsMinimum).toBe(true);
    await act(async () => result.current.toggle('i-food'));
    expect(result.current.meetsMinimum).toBe(false);
  });
});
