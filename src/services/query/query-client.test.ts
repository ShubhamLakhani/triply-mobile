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
