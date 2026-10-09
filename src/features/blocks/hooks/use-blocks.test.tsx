import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { decisionKeys } from '@/features/decisions/api/decision-keys';
import { matchKeys } from '@/features/matches/api/match-keys';

import { blockUser, fetchOwnBlocks, unblockUser } from '../api/block-api';
import { blockKeys } from '../api/block-keys';

import { useBlockUser, useIsUserBlocked, useUnblockUser } from './use-blocks';

jest.mock('../api/block-api', () => ({
  blockUser: jest.fn(),
  fetchOwnBlocks: jest.fn(),
  unblockUser: jest.fn(),
}));

const USER_ID = '10000000-0000-4000-8000-00000000000a';
const TARGET = '20000000-0000-4000-8000-00000000000b';

function setup() {
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

describe('block hooks', () => {
  afterEach(() => jest.clearAllMocks());

  it('refreshes own blocks, matches and decisions after blocking', async () => {
    jest
      .mocked(blockUser)
      .mockResolvedValue({ blocked_user_id: TARGET, created_at: '2026-10-09T00:00:00Z' });
    const { wrapper, queryClient } = setup();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useBlockUser(USER_ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(TARGET);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(blockUser).toHaveBeenCalledWith(TARGET);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: blockKeys.own(USER_ID) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: matchKeys.own(USER_ID) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: decisionKeys.own(USER_ID) });
    queryClient.clear();
  });

  it('refreshes only own blocks after unblocking (matches are not restored)', async () => {
    jest.mocked(unblockUser).mockResolvedValue(true);
    const { wrapper, queryClient } = setup();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useUnblockUser(USER_ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(TARGET);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: blockKeys.own(USER_ID) });
    queryClient.clear();
  });

  it('derives blocked state from the own block list', async () => {
    jest
      .mocked(fetchOwnBlocks)
      .mockResolvedValue([{ blocked_user_id: TARGET, created_at: '2026-10-09T00:00:00Z' }]);
    const { wrapper, queryClient } = setup();
    const { result } = await renderHook(() => useIsUserBlocked(USER_ID, TARGET), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(true);
    queryClient.clear();
  });

  it('rejects while signed out without calling the API', async () => {
    const { wrapper, queryClient } = setup();
    const { result } = await renderHook(() => useBlockUser(null), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(TARGET)).rejects.toMatchObject({
        code: 'not_authenticated',
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(blockUser).not.toHaveBeenCalled();
    queryClient.clear();
  });
});
