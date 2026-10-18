/** Rejection used when an operation takes longer than its budget. Retryable (no `code`). */
export class TimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, label = 'Operation') {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Settles with `promise`, or rejects with a TimeoutError once `timeoutMs` has passed, so callers
 * (and their loading states) always settle. It does not cancel the underlying work: pair it with
 * an aborting transport (see services/supabase/timeout-fetch.ts) when the socket must be freed.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label?: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(timeoutMs, label)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
