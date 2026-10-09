import { getSupabaseClient } from '@/services/supabase';

import { createFakeSupabase, type FakeResult } from '../../../../tests/utils/fake-supabase';

import { fetchOwnReports, reportUser } from './report-api';

jest.mock('@/services/supabase', () => ({ getSupabaseClient: jest.fn() }));

const USER_ID = '10000000-0000-4000-8000-00000000000a';
const TARGET = '20000000-0000-4000-8000-00000000000b';
const REPORT_ID = 'f0000000-0000-4000-8000-000000000001';
const MATCH = 'e0000000-0000-4000-8000-000000000001';

function useFake(result: FakeResult) {
  const { client, calls } = createFakeSupabase(result);
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
  return calls;
}

describe('report api', () => {
  it('files a report through report_user without reporter or status', async () => {
    const calls = useFake({
      data: { report_id: REPORT_ID, created_at: '2026-10-09T00:00:00Z' },
      error: null,
    });
    await expect(
      reportUser({
        reported_user_id: TARGET,
        reason: 'harassment',
        details: '  Unwanted messages.  ',
        related_match_id: MATCH,
      }),
    ).resolves.toEqual({ report_id: REPORT_ID, created_at: '2026-10-09T00:00:00Z' });
    expect(calls[0]).toEqual({
      method: 'rpc',
      args: [
        'report_user',
        {
          p_reported_user_id: TARGET,
          p_reason: 'harassment',
          p_details: 'Unwanted messages.',
          p_related_match_id: MATCH,
        },
      ],
    });
  });

  it('omits blank details', async () => {
    const calls = useFake({
      data: { report_id: REPORT_ID, created_at: '2026-10-09T00:00:00Z' },
      error: null,
    });
    await reportUser({ reported_user_id: TARGET, reason: 'spam', details: '   ' });
    expect(calls[0]?.args[1]).toEqual({ p_reported_user_id: TARGET, p_reason: 'spam' });
  });

  it('rejects invalid input before calling Supabase', async () => {
    const calls = useFake({ data: null, error: null });
    await expect(
      reportUser({ reported_user_id: TARGET, reason: 'other', details: 'x'.repeat(2001) }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    expect(calls).toHaveLength(0);
  });

  it('maps server errors to typed codes', async () => {
    useFake({ data: null, error: { code: '22023', message: 'invalid report context' } });
    await expect(reportUser({ reported_user_id: TARGET, reason: 'spam' })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    useFake({ data: null, error: { code: 'P0002', message: 'user not found' } });
    await expect(reportUser({ reported_user_id: TARGET, reason: 'spam' })).rejects.toMatchObject({
      code: 'user_not_found',
    });
  });

  it('reads own submitted reports with explicit columns and no status', async () => {
    const calls = useFake({ data: [], error: null });
    await fetchOwnReports(USER_ID);
    expect(calls).toContainEqual({ method: 'from', args: ['user_reports'] });
    expect(calls).toContainEqual({ method: 'eq', args: ['reporter_user_id', USER_ID] });
    const select = calls.find((call) => call.method === 'select');
    expect(String(select?.args[0])).not.toMatch(/status|\*/);
    expect(calls.some((call) => call.method === 'eq' && call.args[0] === 'reported_user_id')).toBe(
      false,
    );
  });
});
