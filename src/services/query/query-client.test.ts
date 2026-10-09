import { createQueryClient, QUERY_MAX_RETRIES, shouldRetryQuery } from './query-client';
import { isOnline } from './react-native-managers';

describe('query client defaults', () => {
  it('retries transient failures up to the limit', () => {
    const networkError = new Error('Network request failed');
    expect(shouldRetryQuery(0, networkError)).toBe(true);
    expect(shouldRetryQuery(QUERY_MAX_RETRIES, networkError)).toBe(false);
    expect(shouldRetryQuery(0, { status: 503 })).toBe(true);
    expect(shouldRetryQuery(0, { status: 429 })).toBe(true);
  });

  it('never retries client errors such as auth or RLS failures', () => {
    expect(shouldRetryQuery(0, { status: 401 })).toBe(false);
    expect(shouldRetryQuery(0, { status: '403' })).toBe(false);
    expect(shouldRetryQuery(0, { statusCode: 422 })).toBe(false);
  });

  it('never retries deterministic typed feature errors (Phase 1M-I)', () => {
    const typed = (code: string, cause?: unknown) =>
      Object.assign(new Error('x', { cause }), { code });
    for (const code of [
      'not_allowed',
      'not_found',
      'invalid_input',
      'not_authenticated',
      'limit_reached',
      'unavailable',
      'profile_incomplete',
    ]) {
      expect(shouldRetryQuery(0, typed(code))).toBe(false);
    }
    // `unknown` defers to its cause: a network failure is retried, an RLS failure is not.
    expect(shouldRetryQuery(0, typed('unknown', new Error('Network request failed')))).toBe(true);
    expect(shouldRetryQuery(0, typed('unknown', { code: '42501' }))).toBe(false);
  });

  it('classifies raw PostgREST / Postgres codes', () => {
    expect(shouldRetryQuery(0, { code: '42501', message: 'denied' })).toBe(false);
    expect(shouldRetryQuery(0, { code: 'PGRST116', message: 'no rows' })).toBe(false);
    expect(shouldRetryQuery(0, { code: '23505', message: 'duplicate' })).toBe(false);
    expect(shouldRetryQuery(0, { code: '40001', message: 'serialization' })).toBe(true);
    expect(shouldRetryQuery(0, { code: '57014', message: 'statement timeout' })).toBe(true);
    expect(shouldRetryQuery(0, { code: '', message: 'TypeError: Network request failed' })).toBe(
      true,
    );
  });

  it('disables automatic mutation retries', () => {
    const client = createQueryClient();
    expect(client.getDefaultOptions().mutations?.retry).toBe(0);
    expect(client.getDefaultOptions().queries?.staleTime).toBe(30_000);
    client.clear();
  });

  it('maps expo-network state to TanStack online status', () => {
    expect(isOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(isOnline({ isConnected: true })).toBe(true);
    expect(isOnline({ isConnected: false, isInternetReachable: false })).toBe(false);
    expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
  });
});
