import { warmUpSupabaseConnection, WARM_UP_ATTEMPT_TIMEOUT_MS } from './warm-up';

jest.mock('@/config/env', () => ({
  getEnv: () => ({
    supabaseUrl: 'https://example-ref.supabase.co',
    supabasePublishableKey: 'sb_publishable_test_0000000000',
  }),
}));

const HEALTH = 'https://example-ref.supabase.co/auth/v1/health';

/** A fetch that never answers but rejects like RN's fetch once aborted. */
const hanging = (_url: unknown, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
  });

describe('warmUpSupabaseConnection', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  it('sends one idempotent GET to the auth health endpoint when the connection is healthy', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    await warmUpSupabaseConnection();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      HEALTH,
      expect.objectContaining({
        method: 'GET',
        headers: { apikey: 'sb_publishable_test_0000000000' },
      }),
    );
  });

  it('retries once after a lost connection, so the next request gets a fresh one', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({ ok: true });
    global.fetch = fetchMock;
    await expect(warmUpSupabaseConnection()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never throws, even when both attempts fail (e.g. offline)', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    global.fetch = fetchMock;
    await expect(warmUpSupabaseConnection()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('waits long enough for iOS to declare a dead connection lost, then gives up', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn(hanging);
    global.fetch = fetchMock;
    const pending = warmUpSupabaseConnection();
    // Observed: iOS reports a silently dead connection lost after 5–6 s.
    expect(WARM_UP_ATTEMPT_TIMEOUT_MS).toBeGreaterThan(6_500);
    await jest.advanceTimersByTimeAsync(WARM_UP_ATTEMPT_TIMEOUT_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(WARM_UP_ATTEMPT_TIMEOUT_MS);
    await expect(pending).resolves.toBeUndefined();
  });
});
