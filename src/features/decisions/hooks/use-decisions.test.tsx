import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { matchKeys } from '@/features/matches/api/match-keys';

import { submitDecision } from '../api/decision-api';
import { decisionKeys } from '../api/decision-keys';
import type { DecisionResult } from '../types';

import { useSubmitDecision } from './use-decisions';

jest.mock('../api/decision-api', () => ({
  fetchOwnDecisions: jest.fn(),
  fetchOwnDecisionForUser: jest.fn(),
  submitDecision: jest.fn(),
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

function result(matched: boolean): DecisionResult {
  return {
    decision_id: 'c0000000-0000-4000-8000-000000000001',
    decision: 'like',
    matched,
    match_id: matched ? 'e0000000-0000-4000-8000-000000000001' : null,
    match_created: matched,
  };
}

describe('useSubmitDecision', () => {
  afterEach(() => jest.clearAllMocks());

  it('refreshes own decisions and own matches when a match is reported', async () => {
    jest.mocked(submitDecision).mockResolvedValue(result(true));
    const { wrapper, queryClient } = setup();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result: hook } = await renderHook(() => useSubmitDecision(USER_ID), { wrapper });
    await act(async () => {
      await hook.current.mutateAsync({ target_user_id: TARGET, decision: 'like' });
    });
    await waitFor(() => expect(hook.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: decisionKeys.own(USER_ID) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: matchKeys.own(USER_ID) });
    queryClient.clear();
  });

  it('does not touch match caches when no match is reported', async () => {
    jest.mocked(submitDecision).mockResolvedValue(result(false));
    const { wrapper, queryClient } = setup();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result: hook } = await renderHook(() => useSubmitDecision(USER_ID), { wrapper });
    await act(async () => {
      await hook.current.mutateAsync({ target_user_id: TARGET, decision: 'pass' });
    });
    await waitFor(() => expect(hook.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: decisionKeys.own(USER_ID) });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: matchKeys.own(USER_ID) });
    queryClient.clear();
  });

  it('rejects while signed out without calling the API', async () => {
    const { wrapper, queryClient } = setup();
    const { result: hook } = await renderHook(() => useSubmitDecision(null), { wrapper });
    await act(async () => {
      await expect(
        hook.current.mutateAsync({ target_user_id: TARGET, decision: 'like' }),
      ).rejects.toMatchObject({ code: 'not_authenticated' });
    });
    await waitFor(() => expect(hook.current.isError).toBe(true));
    expect(submitDecision).not.toHaveBeenCalled();
    queryClient.clear();
  });
});
