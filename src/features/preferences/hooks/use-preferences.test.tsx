import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { replaceOwnInterests } from '@/features/interests/api/interest-api';
import { interestKeys } from '@/features/interests/api/interest-keys';
import { useReplaceInterests } from '@/features/interests/hooks/use-interests';

import { setGenderPreferences, updateDiscoveryPreferences } from '../api/preference-api';
import { preferenceKeys } from '../api/preference-keys';
import type { DiscoveryPreferences } from '../types';

import { useSetGenderPreferences, useUpdateDiscoveryPreferences } from './use-preferences';

jest.mock('../api/preference-api', () => ({
  fetchOwnDiscoveryPreferences: jest.fn(),
  fetchOwnGenderPreferences: jest.fn(),
  setGenderPreferences: jest.fn(),
  updateDiscoveryPreferences: jest.fn(),
}));
jest.mock('@/features/interests/api/interest-api', () => ({
  fetchActiveInterests: jest.fn(),
  fetchOwnInterests: jest.fn(),
  replaceOwnInterests: jest.fn(),
}));

const USER_ID = '5f0c1c1e-5a8b-4f6e-9c7d-2b1f0e3a4d5c';

function setup() {
  // gcTime: Infinity avoids lingering garbage-collection timers that keep Jest alive.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('preference + interest mutation hooks', () => {
  afterEach(() => jest.clearAllMocks());

  it('caches the canonical preferences row after an update', async () => {
    const saved: DiscoveryPreferences = {
      user_id: USER_ID,
      min_age: 25,
      max_age: 40,
      minimum_overlap_days: 3,
      created_at: '2026-10-09T00:00:00Z',
      updated_at: '2026-10-09T00:00:00Z',
    };
    jest.mocked(updateDiscoveryPreferences).mockResolvedValue(saved);
    const { wrapper, queryClient } = setup();
    const { result } = await renderHook(() => useUpdateDiscoveryPreferences(USER_ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ min_age: 25, max_age: 40 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(preferenceKeys.discovery(USER_ID))).toEqual(saved);
    queryClient.clear();
  });

  it('caches gender preferences returned by the atomic RPC', async () => {
    jest.mocked(setGenderPreferences).mockResolvedValue(['man', 'woman']);
    const { wrapper, queryClient } = setup();
    const { result } = await renderHook(() => useSetGenderPreferences(USER_ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(['man', 'woman']);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(preferenceKeys.genders(USER_ID))).toEqual(['man', 'woman']);
    queryClient.clear();
  });

  it('invalidates own interests after an atomic replacement', async () => {
    jest.mocked(replaceOwnInterests).mockResolvedValue(['e0000000-0000-4000-8000-000000000001']);
    const { wrapper, queryClient } = setup();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useReplaceInterests(USER_ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(['e0000000-0000-4000-8000-000000000001']);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: interestKeys.own(USER_ID) });
    queryClient.clear();
  });

  it('rejects preference mutations while signed out', async () => {
    const { wrapper, queryClient } = setup();
    const { result } = await renderHook(() => useSetGenderPreferences(null), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(['woman'])).rejects.toMatchObject({
        code: 'not_authenticated',
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(setGenderPreferences).not.toHaveBeenCalled();
    queryClient.clear();
  });
});
