/**
 * Phase 1M-I · data-layer integration tests.
 *
 * Real feature hooks + real API modules + the auth cache reset, wired to the fake Supabase
 * client (tests/utils/fake-supabase.ts). The fake only answers per table / RPC; database rules
 * themselves are covered by the pgTAP suite.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  subscribeToAuthChanges,
  type AuthChangeEvent,
  type Session,
} from '@/features/auth/api/auth-api';
import { registerAuthCacheReset } from '@/features/auth/api/auth-cache';
import { blockKeys, useBlockUser, useOwnBlocks } from '@/features/blocks';
import { decisionKeys, useOwnDecisions, useSubmitDecision } from '@/features/decisions';
import { matchKeys, useOwnMatches } from '@/features/matches';
import { photoKeys, useOwnProfilePhotos, useUploadProfilePhoto } from '@/features/photos';
import { newPhotoId, readLocalPhoto } from '@/features/photos/api/photo-file';
import { useGenderPreferences, useSetGenderPreferences } from '@/features/preferences';
import { profileKeys, useOwnProfile } from '@/features/profile';
import { reportKeys, useReportUser } from '@/features/reports';
import { getSupabaseClient } from '@/services/supabase';

import { createFakeSupabase, type FakeResult, type RecordedCall } from '../utils/fake-supabase';

jest.mock('@/services/supabase', () => ({ getSupabaseClient: jest.fn() }));
jest.mock('@/features/auth/api/auth-api', () => ({ subscribeToAuthChanges: jest.fn() }));
jest.mock('@/features/photos/api/photo-file', () => ({
  newPhotoId: jest.fn(),
  readLocalPhoto: jest.fn(),
}));

const A = '1c000000-0000-4000-8000-00000000000a';
const B = '2c000000-0000-4000-8000-00000000000b';
const MATCH_ID = 'e1000000-0000-4000-8000-000000000001';
const PHOTO_ID = 'ab100000-0000-4000-8000-000000000001';
const T = '2026-10-09T00:00:00Z';

const profile = (id: string, firstName: string) => ({
  id,
  first_name: firstName,
  date_of_birth: '1990-01-01',
  gender: 'woman',
  bio: null,
  home_city: null,
  home_country: null,
  occupation: null,
  is_profile_complete: true,
  is_discoverable: false,
  created_at: T,
  updated_at: T,
});
const match = (unmatched: boolean) => ({
  id: MATCH_ID,
  user_low_id: A,
  user_high_id: B,
  created_at: T,
  unmatched_at: unmatched ? T : null,
  unmatched_by: unmatched ? A : null,
});
const photo = {
  id: PHOTO_ID,
  user_id: A,
  storage_path: `${A}/${PHOTO_ID}.jpg`,
  position: 0,
  is_primary: true,
  mime_type: 'image/jpeg',
  file_size_bytes: 3,
  width: null,
  height: null,
  created_at: T,
  updated_at: T,
};

/** Mutable "server" state that the fake answers from. */
interface ServerState {
  [target: string]: FakeResult;
}

function setup(state: ServerState) {
  const { client, calls } = createFakeSupabase(
    (target) => state[target] ?? { data: [], error: null },
  );
  jest
    .mocked(getSupabaseClient)
    .mockReturnValue(client as unknown as ReturnType<typeof getSupabaseClient>);

  let emit: (event: AuthChangeEvent, session: Session | null) => void = () => undefined;
  jest.mocked(subscribeToAuthChanges).mockImplementation((listener) => {
    emit = listener;
    return () => undefined;
  });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const stopReset = registerAuthCacheReset(queryClient);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const signIn = (event: AuthChangeEvent, userId: string) =>
    emit(event, { user: { id: userId } } as unknown as Session);
  const reads = (table: string) =>
    calls.filter((c: RecordedCall) => c.method === 'from' && c.args[0] === table).length;
  const cleanup = () => {
    stopReset();
    queryClient.clear();
  };
  return {
    queryClient,
    wrapper,
    calls,
    signIn,
    signOut: () => emit('SIGNED_OUT', null),
    reads,
    cleanup,
  };
}

afterEach(() => jest.clearAllMocks());

describe('A. account isolation', () => {
  it('drops every user-scoped cache when another account signs in, and B only sees B', async () => {
    const state: ServerState = { profiles: { data: profile(A, 'Ana'), error: null } };
    const ctx = setup(state);
    ctx.signIn('INITIAL_SESSION', A);

    const first = await renderHook(() => useOwnProfile(A), { wrapper: ctx.wrapper });
    await waitFor(() => expect(first.result.current.data?.first_name).toBe('Ana'));
    for (const key of [
      matchKeys.own(A),
      blockKeys.own(A),
      decisionKeys.own(A),
      reportKeys.own(A),
      photoKeys.own(A),
    ]) {
      ctx.queryClient.setQueryData(key, [{ secret: 'A' }]);
    }
    await first.unmount();

    state.profiles = { data: profile(B, 'Ben'), error: null };
    await act(async () => ctx.signIn('SIGNED_IN', B)); // no SIGNED_OUT in between

    for (const key of [
      profileKeys.own(A),
      matchKeys.own(A),
      blockKeys.own(A),
      decisionKeys.own(A),
      reportKeys.own(A),
      photoKeys.own(A),
    ]) {
      expect(ctx.queryClient.getQueryData(key)).toBeUndefined();
    }
    const second = await renderHook(() => useOwnProfile(B), { wrapper: ctx.wrapper });
    await waitFor(() => expect(second.result.current.data?.first_name).toBe('Ben'));
    expect(
      ctx.queryClient
        .getQueryCache()
        .findAll()
        .every((q) => !q.queryKey.includes(A)),
    ).toBe(true);
    ctx.cleanup();
  });

  it('keeps the cache across token refreshes and clears it on sign-out', async () => {
    const ctx = setup({ profiles: { data: profile(A, 'Ana'), error: null } });
    ctx.signIn('INITIAL_SESSION', A);
    const view = await renderHook(() => useOwnProfile(A), { wrapper: ctx.wrapper });
    await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
    await act(async () => ctx.signIn('TOKEN_REFRESHED', A));
    expect(ctx.queryClient.getQueryData(profileKeys.own(A))).toBeDefined();
    await view.unmount();
    await act(async () => ctx.signOut());
    expect(ctx.queryClient.getQueryCache().findAll()).toHaveLength(0);
    ctx.cleanup();
  });
});

describe('B. like → match', () => {
  it('a matched decision refreshes own decisions and own matches', async () => {
    const state: ServerState = {
      matches: { data: [], error: null },
      user_decisions: { data: [], error: null },
      'rpc:submit_decision': {
        data: {
          decision_id: 'c1000000-0000-4000-8000-000000000001',
          decision: 'like',
          matched: true,
          match_id: MATCH_ID,
          match_created: true,
        },
        error: null,
      },
    };
    const ctx = setup(state);
    const view = await renderHook(
      () => ({
        matches: useOwnMatches(A),
        decisions: useOwnDecisions(A),
        submit: useSubmitDecision(A),
      }),
      { wrapper: ctx.wrapper },
    );
    await waitFor(() => expect(view.result.current.matches.isSuccess).toBe(true));
    expect(view.result.current.matches.data).toEqual([]);

    state.matches = { data: [match(false)], error: null };
    await act(async () => {
      await view.result.current.submit.mutateAsync({ target_user_id: B, decision: 'like' });
    });
    await waitFor(() => expect(view.result.current.matches.data).toHaveLength(1));
    expect(view.result.current.matches.data?.[0]).toMatchObject({
      other_user_id: B,
      is_active: true,
    });
    expect(ctx.reads('user_decisions')).toBe(2);
    ctx.cleanup();
  });
});

describe('C. block after match', () => {
  it('blocking refreshes blocks and shows the match as ended', async () => {
    const state: ServerState = {
      matches: { data: [match(false)], error: null },
      user_blocks: { data: [], error: null },
      'rpc:block_user': { data: { blocked_user_id: B, created_at: T }, error: null },
    };
    const ctx = setup(state);
    const view = await renderHook(
      () => ({ matches: useOwnMatches(A), blocks: useOwnBlocks(A), block: useBlockUser(A) }),
      { wrapper: ctx.wrapper },
    );
    await waitFor(() => expect(view.result.current.matches.data?.[0]?.is_active).toBe(true));

    state.matches = { data: [match(true)], error: null };
    state.user_blocks = { data: [{ blocked_user_id: B, created_at: T }], error: null };
    await act(async () => {
      await view.result.current.block.mutateAsync(B);
    });
    await waitFor(() => expect(view.result.current.matches.data?.[0]?.is_active).toBe(false));
    await waitFor(() => expect(view.result.current.blocks.data).toHaveLength(1));
    ctx.cleanup();
  });

  it('reporting stays independent: no block, match or decision refresh', async () => {
    const ctx = setup({
      matches: { data: [match(false)], error: null },
      user_blocks: { data: [], error: null },
      'rpc:report_user': {
        data: { report_id: 'f1000000-0000-4000-8000-000000000001', created_at: T },
        error: null,
      },
    });
    const view = await renderHook(
      () => ({ matches: useOwnMatches(A), blocks: useOwnBlocks(A), report: useReportUser(A) }),
      { wrapper: ctx.wrapper },
    );
    await waitFor(() => expect(view.result.current.blocks.isSuccess).toBe(true));
    await waitFor(() => expect(view.result.current.matches.isSuccess).toBe(true));
    const before = { matches: ctx.reads('matches'), blocks: ctx.reads('user_blocks') };
    await act(async () => {
      await view.result.current.report.mutateAsync({ reported_user_id: B, reason: 'spam' });
    });
    await waitFor(() => expect(view.result.current.report.isSuccess).toBe(true));
    expect(ctx.reads('matches')).toBe(before.matches);
    expect(ctx.reads('user_blocks')).toBe(before.blocks);
    expect(ctx.calls.some((c) => c.method === 'rpc' && c.args[0] === 'block_user')).toBe(false);
    ctx.cleanup();
  });
});

describe('D. photos', () => {
  it('upload refreshes own photos only (profile completeness untouched)', async () => {
    jest.mocked(newPhotoId).mockReturnValue(PHOTO_ID);
    jest.mocked(readLocalPhoto).mockResolvedValue(new ArrayBuffer(3));
    const state: ServerState = {
      profiles: { data: profile(A, 'Ana'), error: null },
      profile_photos: { data: [], error: null },
      'rpc:register_profile_photo': { data: photo, error: null },
    };
    const ctx = setup(state);
    const view = await renderHook(
      () => ({
        profile: useOwnProfile(A),
        photos: useOwnProfilePhotos(A),
        upload: useUploadProfilePhoto(A),
      }),
      { wrapper: ctx.wrapper },
    );
    await waitFor(() => expect(view.result.current.photos.isSuccess).toBe(true));
    await waitFor(() => expect(view.result.current.profile.isSuccess).toBe(true));
    const profileReads = ctx.reads('profiles');

    state.profile_photos = { data: [photo], error: null };
    await act(async () => {
      await view.result.current.upload.mutateAsync({
        localUri: 'file:///a.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 3,
      });
    });
    await waitFor(() => expect(view.result.current.photos.data).toHaveLength(1));
    expect(ctx.calls.map((c) => c.method)).toEqual(
      expect.arrayContaining(['storage.upload', 'rpc']),
    );
    expect(ctx.reads('profiles')).toBe(profileReads);
    ctx.cleanup();
  });
});

describe('E. preference replacement', () => {
  it('the saved gender set replaces the cached set', async () => {
    const row = (gender: string) => ({ user_id: A, gender, created_at: T });
    const state: ServerState = {
      discovery_gender_preferences: { data: [row('man')], error: null },
      'rpc:set_discovery_gender_preferences': {
        data: [row('non_binary'), row('woman')],
        error: null,
      },
    };
    const ctx = setup(state);
    const view = await renderHook(
      () => ({ genders: useGenderPreferences(A), save: useSetGenderPreferences(A) }),
      { wrapper: ctx.wrapper },
    );
    await waitFor(() => expect(view.result.current.genders.data).toEqual(['man']));

    state.discovery_gender_preferences = { data: [row('non_binary'), row('woman')], error: null };
    await act(async () => {
      await view.result.current.save.mutateAsync(['woman', 'non_binary']);
    });
    await waitFor(() =>
      expect([...(view.result.current.genders.data ?? [])].sort()).toEqual(['non_binary', 'woman']),
    );
    ctx.cleanup();
  });
});
