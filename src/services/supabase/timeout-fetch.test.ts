import { TimeoutError } from '@/utils/timeout';

import { createTimeoutFetch, SUPABASE_FETCH_TIMEOUTS, timeoutForUrl } from './timeout-fetch';

const BASE = 'https://example-ref.supabase.co';

/** A fetch that never answers but rejects like RN's fetch once its signal aborts. */
function hangingFetch() {
  return jest.fn(
    (_input: Parameters<typeof fetch>[0], init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
      }),
  );
}

describe('createTimeoutFetch', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('picks the budget from the request URL', () => {
    expect(timeoutForUrl(`${BASE}/auth/v1/signup`, SUPABASE_FETCH_TIMEOUTS)).toBe(30_000);
    expect(timeoutForUrl(`${BASE}/rest/v1/profiles`, SUPABASE_FETCH_TIMEOUTS)).toBe(30_000);
    expect(timeoutForUrl(`${BASE}/storage/v1/object/x`, SUPABASE_FETCH_TIMEOUTS)).toBe(180_000);
    expect(timeoutForUrl(`${BASE}/auth/v1/logout?scope=global`, SUPABASE_FETCH_TIMEOUTS)).toBe(
      10_000,
    );
  });

  it('returns the response unchanged when it arrives in time', async () => {
    const response = { ok: true } as Response;
    const base = jest.fn().mockResolvedValue(response);
    const timedFetch = createTimeoutFetch(base);
    await expect(timedFetch(`${BASE}/rest/v1/profiles`, { method: 'GET' })).resolves.toBe(response);
    expect(base).toHaveBeenCalledWith(
      `${BASE}/rest/v1/profiles`,
      expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) }),
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('passes a normal network failure through', async () => {
    const failure = new TypeError('Network request failed');
    const timedFetch = createTimeoutFetch(jest.fn().mockRejectedValue(failure));
    await expect(timedFetch(`${BASE}/auth/v1/token`)).rejects.toBe(failure);
  });

  it('aborts a request that never answers and rejects with a TimeoutError', async () => {
    const base = hangingFetch();
    const timedFetch = createTimeoutFetch(base, { defaultMs: 50, storageMs: 500, logoutMs: 10 });
    const pending = timedFetch(`${BASE}/auth/v1/signup`, { method: 'POST' });
    jest.advanceTimersByTime(50);
    await expect(pending).rejects.toBeInstanceOf(TimeoutError);
    const signal = base.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(true);
  });

  it('forwards an abort requested by the caller', async () => {
    const base = hangingFetch();
    const timedFetch = createTimeoutFetch(base);
    const caller = new AbortController();
    const pending = timedFetch(`${BASE}/rest/v1/trips`, { signal: caller.signal });
    caller.abort();
    await expect(pending).rejects.toThrow('Aborted');
    expect(jest.getTimerCount()).toBe(0);
  });
});
