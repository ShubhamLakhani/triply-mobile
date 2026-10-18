import { withFreshConnection } from './fresh-connection-fetch';

const URL_REST = 'https://example-ref.supabase.co/rest/v1/profiles';
const URL_TOKEN = 'https://example-ref.supabase.co/auth/v1/token?grant_type=password';

function setup() {
  let clock = 1_000_000;
  const calls: string[] = [];
  const base = jest.fn((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
    return Promise.resolve({ ok: true } as Response);
  });
  const warmUp = jest.fn(() => {
    calls.push('WARM-UP');
    return Promise.resolve();
  });
  const fetchFn = withFreshConnection(base, { warmUp, staleAfterMs: 25_000, now: () => clock });
  return {
    fetchFn,
    base,
    warmUp,
    calls,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('withFreshConnection', () => {
  it('does not warm up the very first request (no pooled connection yet)', async () => {
    const ctx = setup();
    await ctx.fetchFn(URL_TOKEN, { method: 'POST' });
    expect(ctx.warmUp).not.toHaveBeenCalled();
  });

  it('warms up before a write that follows a quiet period, then sends the write', async () => {
    const ctx = setup();
    await ctx.fetchFn(URL_REST, { method: 'GET' });
    ctx.advance(104_000);
    await ctx.fetchFn(URL_TOKEN, { method: 'POST' });
    expect(ctx.calls).toEqual([`GET ${URL_REST}`, 'WARM-UP', `POST ${URL_TOKEN}`]);
  });

  it('never warms up for reads, or for writes on a recently used connection', async () => {
    const ctx = setup();
    await ctx.fetchFn(URL_REST);
    ctx.advance(10_000);
    await ctx.fetchFn(URL_TOKEN, { method: 'POST' });
    ctx.advance(120_000);
    await ctx.fetchFn(URL_REST, { method: 'GET' });
    expect(ctx.warmUp).not.toHaveBeenCalled();
  });

  it('shares one warm-up between concurrent writes', async () => {
    const ctx = setup();
    await ctx.fetchFn(URL_REST);
    ctx.advance(60_000);
    await Promise.all([
      ctx.fetchFn(URL_TOKEN, { method: 'POST' }),
      ctx.fetchFn(URL_REST, { method: 'PATCH' }),
    ]);
    expect(ctx.warmUp).toHaveBeenCalledTimes(1);
    expect(ctx.base).toHaveBeenCalledTimes(3);
  });

  it('counts failed requests as activity and still sends the write if warm-up fails', async () => {
    const ctx = setup();
    ctx.base.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(ctx.fetchFn(URL_REST)).rejects.toThrow('Network request failed');
    ctx.advance(30_000);
    ctx.warmUp.mockImplementationOnce(() => Promise.resolve());
    await ctx.fetchFn(URL_TOKEN, { method: 'POST' });
    expect(ctx.warmUp).toHaveBeenCalledTimes(1);
    expect(ctx.base).toHaveBeenLastCalledWith(URL_TOKEN, { method: 'POST' });
  });
});
