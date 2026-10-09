import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { reportUser } from '../api/report-api';
import { reportKeys } from '../api/report-keys';

import { useReportUser } from './use-reports';

jest.mock('../api/report-api', () => ({
  fetchOwnReports: jest.fn(),
  reportUser: jest.fn(),
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

describe('useReportUser', () => {
  afterEach(() => jest.clearAllMocks());

  it('refreshes own reports only (reporting does not block)', async () => {
    jest.mocked(reportUser).mockResolvedValue({
      report_id: 'f0000000-0000-4000-8000-000000000001',
      created_at: '2026-10-09T00:00:00Z',
    });
    const { wrapper, queryClient } = setup();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = await renderHook(() => useReportUser(USER_ID), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ reported_user_id: TARGET, reason: 'spam' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: reportKeys.own(USER_ID) });
    queryClient.clear();
  });

  it('rejects while signed out', async () => {
    const { wrapper, queryClient } = setup();
    const { result } = await renderHook(() => useReportUser(null), { wrapper });
    await act(async () => {
      await expect(
        result.current.mutateAsync({ reported_user_id: TARGET, reason: 'spam' }),
      ).rejects.toMatchObject({ code: 'not_authenticated' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(reportUser).not.toHaveBeenCalled();
    queryClient.clear();
  });
});
