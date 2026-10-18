import { getSupabaseClient } from '@/services/supabase';

import { createFakeSupabase, type FakeResult } from '../../../../tests/utils/fake-supabase';

import { completeOnboarding, toOnboardingError } from './onboarding-api';

jest.mock('@/services/supabase', () => {
  const actual = jest.requireActual('@/services/supabase/sqlstate');
  return { ...actual, getSupabaseClient: jest.fn() };
});
jest.mock('@/features/profile/api/profile-api', () => ({
  PROFILE_COLUMNS: 'id, onboarding_completed_at',
}));

function useFake(result: FakeResult) {
  const { client, calls } = createFakeSupabase(result);
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
  return calls;
}

describe('onboarding api', () => {
  it('completes onboarding through the RPC; the user id is never sent', async () => {
    const row = { id: 'u1', onboarding_completed_at: '2026-10-11T10:00:00Z' };
    const calls = useFake({ data: row, error: null });
    await expect(completeOnboarding()).resolves.toEqual(row);
    expect(calls[0]).toEqual({ method: 'rpc', args: ['complete_onboarding', undefined] });
    expect(calls).toContainEqual({ method: 'select', args: ['id, onboarding_completed_at'] });
  });

  it('parses the missing requirements from TR002 details', async () => {
    useFake({
      data: null,
      error: {
        code: 'TR002',
        message: 'onboarding requirements not met',
        details: 'photos,interests',
      },
    });
    await expect(completeOnboarding()).rejects.toMatchObject({
      code: 'incomplete',
      missing: ['photos', 'interests'],
    });
  });

  it('ignores unknown requirement keys and maps inactive accounts', () => {
    expect(
      toOnboardingError({ code: 'TR002', details: 'photos,teleport' } as never).missing,
    ).toEqual(['photos']);
    expect(toOnboardingError({ code: 'TR001' }).code).toBe('account_inactive');
    expect(toOnboardingError({ code: '08006' }).code).toBe('unknown');
  });
});
