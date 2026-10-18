import { isTimeoutError, TimeoutError, withTimeout } from './timeout';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves with the value when the promise settles before the timeout', async () => {
    const result = withTimeout(Promise.resolve('ok'), 1000);
    await expect(result).resolves.toBe('ok');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('passes through a normal rejection unchanged', async () => {
    const failure = new Error('boom');
    await expect(withTimeout(Promise.reject(failure), 1000)).rejects.toBe(failure);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects with a TimeoutError when the promise never settles', async () => {
    const result = withTimeout(new Promise<never>(() => undefined), 5000, 'Sign up');
    jest.advanceTimersByTime(4999);
    let settled = false;
    void result.catch(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    jest.advanceTimersByTime(1);
    const error: unknown = await result.catch((e: unknown) => e);
    expect(isTimeoutError(error)).toBe(true);
    expect(error).toBeInstanceOf(TimeoutError);
    expect((error as TimeoutError).timeoutMs).toBe(5000);
    expect((error as TimeoutError).message).toBe('Sign up timed out after 5000ms');
  });
});
