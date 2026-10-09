import { QueryClient } from '@tanstack/react-query';

import { subscribeToAuthChanges, type AuthChangeEvent, type Session } from './auth-api';
import { registerAuthCacheReset } from './auth-cache';

jest.mock('./auth-api', () => ({ subscribeToAuthChanges: jest.fn() }));

describe('registerAuthCacheReset', () => {
  it('clears cached server state on sign-out only', () => {
    let emit: (event: AuthChangeEvent, session: Session | null) => void = () => undefined;
    const unsubscribe = jest.fn();
    jest.mocked(subscribeToAuthChanges).mockImplementation((listener) => {
      emit = listener;
      return unsubscribe;
    });

    const queryClient = new QueryClient();
    queryClient.setQueryData(['profile', 'own', 'u1'], { id: 'u1' });
    const stop = registerAuthCacheReset(queryClient);

    emit('TOKEN_REFRESHED', null);
    expect(queryClient.getQueryData(['profile', 'own', 'u1'])).toEqual({ id: 'u1' });

    emit('SIGNED_OUT', null);
    expect(queryClient.getQueryData(['profile', 'own', 'u1'])).toBeUndefined();

    stop();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
