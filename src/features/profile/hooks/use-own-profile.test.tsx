import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { fetchOwnProfile, updateOwnProfile } from '../api/profile-api';
import { profileKeys } from '../api/profile-keys';
import type { Profile } from '../types';

import { useOwnProfile, useUpdateProfile } from './use-own-profile';

// Session plumbing is covered elsewhere; these tests exercise the query/mutation wiring.
jest.mock('@/features/auth/hooks/use-auth-session', () => ({ useAuthSession: jest.fn() }));
jest.mock('../api/profile-api', () => ({
  fetchOwnProfile: jest.fn(),
  updateOwnProfile: jest.fn(),
}));

const USER_ID = '5f0c1c1e-5a8b-4f6e-9c7d-2b1f0e3a4d5c';

const baseProfile: Profile = {
  id: USER_ID,
  first_name: 'Asha',
  date_of_birth: '1995-05-17',
  gender: 'woman',
  bio: null,
  home_city: null,
  home_country: null,
  occupation: null,
  is_profile_complete: true,
  onboarding_completed_at: null,
  discovery_paused_at: null,
  created_at: '2026-10-09T00:00:00Z',
  updated_at: '2026-10-09T00:00:00Z',
};

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

describe('own profile hooks', () => {
  afterEach(() => jest.clearAllMocks());

  it('does not query while signed out', async () => {
    const { wrapper, queryClient } = setup();
    await renderHook(() => useOwnProfile(null), { wrapper });
    expect(fetchOwnProfile).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it('loads the own profile under a user-scoped key', async () => {
    jest.mocked(fetchOwnProfile).mockResolvedValue(baseProfile);
    const { wrapper, queryClient } = setup();
    const { result } = await renderHook(() => useOwnProfile(USER_ID), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(baseProfile));
    expect(queryClient.getQueryData(profileKeys.own(USER_ID))).toEqual(baseProfile);
    queryClient.clear();
  });

  it('writes the canonical database row to the cache and invalidates after update', async () => {
    const updated = { ...baseProfile, bio: 'Slow travel.' };
    jest.mocked(updateOwnProfile).mockResolvedValue(updated);
    jest.mocked(fetchOwnProfile).mockResolvedValue(updated);
    const { wrapper, queryClient } = setup();
    queryClient.setQueryData(profileKeys.own(USER_ID), baseProfile);
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = await renderHook(() => useUpdateProfile(USER_ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ bio: 'Slow travel.' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(updateOwnProfile).toHaveBeenCalledWith(USER_ID, { bio: 'Slow travel.' });
    expect(queryClient.getQueryData(profileKeys.own(USER_ID))).toEqual(updated);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: profileKeys.own(USER_ID) });
    queryClient.clear();
  });

  it('rejects updates while signed out without calling the API', async () => {
    const { wrapper, queryClient } = setup();
    const { result } = await renderHook(() => useUpdateProfile(null), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ bio: 'hi' })).rejects.toMatchObject({
        code: 'not_authenticated',
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(updateOwnProfile).not.toHaveBeenCalled();
    queryClient.clear();
  });
});
