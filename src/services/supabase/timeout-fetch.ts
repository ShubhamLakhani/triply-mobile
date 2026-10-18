import { TimeoutError } from '@/utils/timeout';

type Fetch = typeof fetch;

/**
 * Per-request time budgets for every Supabase HTTP call (Auth, PostgREST, RPC, Storage).
 *
 * React Native's Android networking (OkHttp) is created with no connect/read timeouts, so a
 * request on a stalled connection can stay pending forever. This transport aborts it instead,
 * which frees the socket and lets every caller settle with a retryable error.
 */
export const SUPABASE_FETCH_TIMEOUTS = {
  /** Auth, REST and RPC requests. */
  defaultMs: 30_000,
  /** Photo uploads/downloads (up to 10 MiB on slow mobile networks). */
  storageMs: 180_000,
  /** Sign-out: auth-js clears the local session even when this request fails. */
  logoutMs: 10_000,
} as const;

export type SupabaseFetchTimeouts = { [K in keyof typeof SUPABASE_FETCH_TIMEOUTS]: number };

function requestUrl(input: Parameters<Fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function timeoutForUrl(url: string, budgets: SupabaseFetchTimeouts): number {
  if (url.includes('/storage/v1/')) return budgets.storageMs;
  if (url.includes('/auth/v1/logout')) return budgets.logoutMs;
  return budgets.defaultMs;
}

/** Wraps a fetch implementation with an aborting timeout chosen from the request URL. */
export function createTimeoutFetch(
  baseFetch: Fetch,
  budgets: SupabaseFetchTimeouts = SUPABASE_FETCH_TIMEOUTS,
): Fetch {
  return (input, init) => {
    const timeoutMs = timeoutForUrl(requestUrl(input), budgets);
    const controller = new AbortController();
    const callerSignal = init?.signal;
    const forwardAbort = () => controller.abort();
    if (callerSignal?.aborted) controller.abort();
    else callerSignal?.addEventListener('abort', forwardAbort);

    return new Promise<Response>((resolve, reject) => {
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new TimeoutError(timeoutMs, 'Network request'));
      }, timeoutMs);
      const settle = () => {
        clearTimeout(timer);
        callerSignal?.removeEventListener('abort', forwardAbort);
      };
      baseFetch(input, { ...init, signal: controller.signal }).then(
        (response) => {
          settle();
          resolve(response);
        },
        (error: unknown) => {
          settle();
          if (!timedOut) reject(error);
        },
      );
    });
  };
}
