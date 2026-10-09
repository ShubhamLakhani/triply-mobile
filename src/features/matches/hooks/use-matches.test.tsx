import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { unmatch } from '../api/match-api';
import { matchKeys } from '../api/match-keys';
import type { OwnMatch } from '../types';

import { useUnmatch } from './use-matches';

jest.mock('../api/match-api', () => ({
  fetchOwnMatchById: jest.fn(),
  fetchOwnMatches: jest.fn(),
  unmatch: jest.fn(),
}));

const A = '10000000-0000-4000-8000-00000000000a';
const B = '20000000-0000-4000-8000-00000000000b';
const MATCH_ID = 'e0000000-0000-4000-8000-000000000001';

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

describe('useUnmatch', () => {
  afterEach(() => jest.clearAllMocks());

  it('caches the ended match and refreshes the match list', async () => {
    const ended: OwnMatch = {
      id: MATCH_ID,
      user_low_id: A,
      user_high_id: B,
      created_at: '2026-10-09T00:00:00Z',
      unmatched_at: '2026-10-09T01:00:00Z',
      unmatched_by: A,
      other_user_id: B,
      is_active: false,
    };
    jest.mocked(unmatch).mockResolvedValue(ended);
    const { wrapper, queryClient } = setup();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useUnmatch(A), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(MATCH_ID);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(unmatch).toHaveBeenCalledWith(A, MATCH_ID);
    expect(queryClient.getQueryData(matchKeys.detail(A, MATCH_ID))).toEqual(ended);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: matchKeys.own(A) });
    queryClient.clear();
  });

  it('rejects while signed out', async () => {
    const { wrapper, queryClient } = setup();
    const { result } = await renderHook(() => useUnmatch(null), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync(MATCH_ID)).rejects.toMatchObject({
        code: 'not_authenticated',
      });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(unmatch).not.toHaveBeenCalled();
    queryClient.clear();
  });
});
