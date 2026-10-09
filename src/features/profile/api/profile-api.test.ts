import { getSupabaseClient } from '@/services/supabase';

import { fetchOwnProfile, PROFILE_COLUMNS, updateOwnProfile } from './profile-api';
import { ProfileError } from './profile-errors';

jest.mock('@/services/supabase', () => ({ getSupabaseClient: jest.fn() }));

const USER_ID = '5f0c1c1e-5a8b-4f6e-9c7d-2b1f0e3a4d5c';

/** Minimal chainable fake of the PostgREST builder that records calls. */
function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder = {
    select: (...args: unknown[]) => (calls.push({ method: 'select', args }), builder),
    update: (...args: unknown[]) => (calls.push({ method: 'update', args }), builder),
    eq: (...args: unknown[]) => (calls.push({ method: 'eq', args }), builder),
    single: async () => (calls.push({ method: 'single', args: [] }), result),
  };
  const client = {
    from: (table: string) => (calls.push({ method: 'from', args: [table] }), builder),
  };
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);
  return calls;
}

describe('profile api', () => {
  it('fetches the caller profile with an explicit column list', async () => {
    const calls = fakeClient({ data: { id: USER_ID }, error: null });
    await expect(fetchOwnProfile(USER_ID)).resolves.toEqual({ id: USER_ID });
    expect(calls).toEqual([
      { method: 'from', args: ['profiles'] },
      { method: 'select', args: [PROFILE_COLUMNS] },
      { method: 'eq', args: ['id', USER_ID] },
      { method: 'single', args: [] },
    ]);
  });

  it('sends only validated, normalised editable fields', async () => {
    const calls = fakeClient({ data: { id: USER_ID }, error: null });
    await updateOwnProfile(USER_ID, { first_name: ' Asha ', home_city: '' });
    expect(calls.find((c) => c.method === 'update')?.args).toEqual([
      { first_name: 'Asha', home_city: null },
    ]);
  });

  it('refuses protected fields and empty updates before calling Supabase', async () => {
    const calls = fakeClient({ data: null, error: null });
    await expect(
      updateOwnProfile(USER_ID, { is_profile_complete: true } as never),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(updateOwnProfile(USER_ID, {})).rejects.toMatchObject({ code: 'invalid_input' });
    expect(calls).toHaveLength(0);
  });

  it('maps database errors to typed ProfileErrors', async () => {
    fakeClient({ data: null, error: { code: '23514', message: 'profile must be complete' } });
    const error = await updateOwnProfile(USER_ID, { is_discoverable: true }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ProfileError);
    expect(error).toMatchObject({ code: 'rejected_by_database' });

    fakeClient({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
    await expect(fetchOwnProfile(USER_ID)).rejects.toMatchObject({ code: 'not_found' });

    fakeClient({ data: null, error: { code: '42501', message: 'permission denied' } });
    await expect(fetchOwnProfile(USER_ID)).rejects.toMatchObject({ code: 'forbidden' });
  });
});
