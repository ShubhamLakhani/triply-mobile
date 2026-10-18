import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  AnalyticsProvider,
  createAnalyticsClient,
  type AnalyticsTransport,
} from '@/services/analytics';

import {
  getCurrentSession,
  signOut,
  subscribeToAuthChanges,
  type AuthChangeEvent,
  type Session,
} from '../api/auth-api';
import { authError } from '../api/auth-errors';
import { registerAuthLinkHandler } from '../api/auth-links';
import { useAuthSession } from '../hooks/use-auth-session';

import { AuthProvider, useAuth } from './AuthProvider';

jest.mock('../api/auth-links', () => ({ registerAuthLinkHandler: jest.fn(() => () => undefined) }));
jest.mock('../api/auth-api', () => ({
  getCurrentSession: jest.fn(),
  signOut: jest.fn(),
  subscribeToAuthChanges: jest.fn(),
}));

const sessionFor = (id: string) => ({ user: { id } }) as unknown as Session;

function setup(initial: Session | null) {
  let emit: (event: AuthChangeEvent, session: Session | null) => void = () => undefined;
  const unsubscribe = jest.fn();
  jest.mocked(getCurrentSession).mockResolvedValue(initial);
  jest.mocked(subscribeToAuthChanges).mockImplementation((listener) => {
    emit = listener;
    return unsubscribe;
  });
  const transport: AnalyticsTransport = {
    capture: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AnalyticsProvider client={createAnalyticsClient(transport)}>
        <AuthProvider>{children}</AuthProvider>
      </AnalyticsProvider>
    </QueryClientProvider>
  );
  return {
    wrapper,
    queryClient,
    transport,
    unsubscribe,
    emit: (e: AuthChangeEvent, s: Session | null) => emit(e, s),
  };
}

describe('AuthProvider', () => {
  afterEach(() => jest.clearAllMocks());

  it('registers one subscription for the whole app and exposes the session', async () => {
    const ctx = setup(sessionFor('u1'));
    const { result, unmount } = await renderHook(
      () => ({ a: useAuth(), b: useAuthSession(), c: useAuthSession() }),
      { wrapper: ctx.wrapper },
    );
    await act(async () => {});
    expect(subscribeToAuthChanges).toHaveBeenCalledTimes(1);
    expect(result.current.a.isInitializing).toBe(false);
    expect(result.current.b.userId).toBe('u1');
    expect(result.current.c.isAuthenticated).toBe(true);
    expect(ctx.transport.identify).toHaveBeenCalledWith('u1');
    await unmount();
    expect(ctx.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('starts initialising, then resolves to signed out', async () => {
    const ctx = setup(null);
    let resolve: (s: Session | null) => void = () => undefined;
    jest.mocked(getCurrentSession).mockReturnValue(
      new Promise<Session | null>((r) => {
        resolve = r;
      }),
    );
    const { result } = await renderHook(() => useAuthSession(), { wrapper: ctx.wrapper });
    expect(result.current.isInitializing).toBe(true);
    await act(async () => resolve(null));
    expect(result.current.isInitializing).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('clears the query cache on sign-out and on account switch, and resets analytics', async () => {
    const ctx = setup(sessionFor('u1'));
    const { result } = await renderHook(() => useAuthSession(), { wrapper: ctx.wrapper });
    await act(async () => {});
    ctx.queryClient.setQueryData(['profile', 'own', 'u1'], { id: 'u1' });

    await act(async () => ctx.emit('SIGNED_IN', sessionFor('u2')));
    expect(ctx.queryClient.getQueryData(['profile', 'own', 'u1'])).toBeUndefined();
    expect(result.current.userId).toBe('u2');

    ctx.queryClient.setQueryData(['profile', 'own', 'u2'], { id: 'u2' });
    await act(async () => ctx.emit('SIGNED_OUT', null));
    expect(ctx.queryClient.getQueryCache().findAll()).toHaveLength(0);
    expect(result.current.isAuthenticated).toBe(false);
    expect(ctx.transport.reset).toHaveBeenCalled();
  });

  it('handles auth links only once the stored session is known', async () => {
    const ctx = setup(null);
    let resolve: (s: Session | null) => void = () => undefined;
    jest.mocked(getCurrentSession).mockReturnValue(
      new Promise<Session | null>((r) => {
        resolve = r;
      }),
    );
    await renderHook(() => useAuth(), { wrapper: ctx.wrapper });
    expect(registerAuthLinkHandler).not.toHaveBeenCalled();
    await act(async () => resolve(null));
    expect(registerAuthLinkHandler).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed confirmation link visible for the auth screens until dismissed', async () => {
    const ctx = setup(null);
    const { result } = await renderHook(() => useAuth(), { wrapper: ctx.wrapper });
    await act(async () => {});
    const handlers = jest.mocked(registerAuthLinkHandler).mock.calls[0]?.[0];
    await act(async () => handlers?.onError(authError('link_expired')));
    expect(result.current.linkError?.code).toBe('link_expired');
    expect(result.current.linkError?.message).toMatch(/expired or was already used/);
    await act(async () => result.current.dismissLinkError());
    expect(result.current.linkError).toBeNull();
  });

  it('offers a retry instead of the sign-in screens when an offline restore fails', async () => {
    const ctx = setup(null);
    jest.mocked(getCurrentSession).mockRejectedValueOnce(authError('network'));
    const { result } = await renderHook(() => useAuthSession(), { wrapper: ctx.wrapper });
    await act(async () => {});
    expect(result.current.isInitializing).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.restoreError?.code).toBe('network');

    jest.mocked(getCurrentSession).mockResolvedValueOnce(sessionFor('u1'));
    await act(async () => result.current.retryRestore());
    expect(getCurrentSession).toHaveBeenCalledTimes(2);
    expect(result.current.restoreError).toBeNull();
    expect(result.current.userId).toBe('u1');
  });

  it('clears the restore error when the session refreshes on its own', async () => {
    const ctx = setup(null);
    jest.mocked(getCurrentSession).mockRejectedValueOnce(authError('timeout'));
    const { result } = await renderHook(() => useAuthSession(), { wrapper: ctx.wrapper });
    await act(async () => {});
    expect(result.current.restoreError?.code).toBe('timeout');
    await act(async () => ctx.emit('TOKEN_REFRESHED', sessionFor('u1')));
    expect(result.current.restoreError).toBeNull();
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('treats a non-transient restore failure (e.g. revoked token) as signed out', async () => {
    const ctx = setup(null);
    jest.mocked(getCurrentSession).mockRejectedValueOnce(authError('unknown'));
    const { result } = await renderHook(() => useAuthSession(), { wrapper: ctx.wrapper });
    await act(async () => {});
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.restoreError).toBeNull();
  });

  it('signOut delegates to the auth API', async () => {
    const ctx = setup(sessionFor('u1'));
    jest.mocked(signOut).mockResolvedValue();
    const { result } = await renderHook(() => useAuthSession(), { wrapper: ctx.wrapper });
    await act(async () => {
      await result.current.signOut();
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
