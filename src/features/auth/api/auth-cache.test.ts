import { QueryClient } from '@tanstack/react-query';

import { subscribeToAuthChanges, type AuthChangeEvent, type Session } from './auth-api';
import { registerAuthCacheReset } from './auth-cache';

jest.mock('./auth-api', () => ({ subscribeToAuthChanges: jest.fn() }));

const sessionFor = (id: string) => ({ user: { id } }) as unknown as Session;

function setup() {
  let emit: (event: AuthChangeEvent, session: Session | null) => void = () => undefined;
  const unsubscribe = jest.fn();
  jest.mocked(subscribeToAuthChanges).mockImplementation((listener) => {
    emit = listener;
    return unsubscribe;
  });
  // gcTime: Infinity avoids lingering garbage-collection timers that keep Jest alive.
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  const stop = registerAuthCacheReset(queryClient);
  return {
    queryClient,
    stop,
    unsubscribe,
    emit: (e: AuthChangeEvent, s: Session | null) => emit(e, s),
  };
}

describe('registerAuthCacheReset', () => {
  it('keeps the cache across token refreshes and clears it on sign-out', () => {
    const { queryClient, stop, unsubscribe, emit } = setup();
    emit('INITIAL_SESSION', sessionFor('u1'));
    queryClient.setQueryData(['profile', 'own', 'u1'], { id: 'u1' });

    emit('TOKEN_REFRESHED', sessionFor('u1'));
    expect(queryClient.getQueryData(['profile', 'own', 'u1'])).toEqual({ id: 'u1' });

    emit('SIGNED_OUT', null);
    expect(queryClient.getQueryData(['profile', 'own', 'u1'])).toBeUndefined();

    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('clears the cache when a different account signs in without a sign-out', () => {
    const { queryClient, emit } = setup();
    emit('SIGNED_IN', sessionFor('u1'));
    queryClient.setQueryData(['matches', 'own', 'u1'], [{ id: 'm1' }]);

    emit('SIGNED_IN', sessionFor('u2'));
    expect(queryClient.getQueryData(['matches', 'own', 'u1'])).toBeUndefined();
    queryClient.clear();
  });

  it('does not clear when the same account signs in again', () => {
    const { queryClient, emit } = setup();
    emit('SIGNED_IN', sessionFor('u1'));
    queryClient.setQueryData(['profile', 'own', 'u1'], { id: 'u1' });
    emit('SIGNED_IN', sessionFor('u1'));
    expect(queryClient.getQueryData(['profile', 'own', 'u1'])).toEqual({ id: 'u1' });
    queryClient.clear();
  });
});
