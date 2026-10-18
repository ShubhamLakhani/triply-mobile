type Fetch = typeof fetch;

/** Idle time after which a pooled connection may be dead (seen at ~100 s on iOS / HTTP/3). */
export const CONNECTION_STALE_AFTER_MS = 25_000;

function requestMethod(input: Parameters<Fetch>[0], init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input === 'object' && 'method' in input) return input.method.toUpperCase();
  return 'GET';
}

export interface FreshConnectionOptions {
  /** Refreshes the connection (an idempotent request). Must not throw. */
  warmUp: () => Promise<void>;
  staleAfterMs?: number;
  now?: () => number;
}

/**
 * Before a write (anything but GET/HEAD) that follows a quiet period, runs one idempotent
 * warm-up request first.
 *
 * Why: an idle keep-alive connection can die silently (NAT/router UDP timeouts drop HTTP/3
 * connections after ~1–2 minutes; iOS also drops them while the app is suspended). iOS then
 * reuses it, and a POST fails with NSURLErrorNetworkConnectionLost (-1005) without being
 * retried; GETs are retried on a fresh connection. Found in simulator E2E on sign-in and on
 * the email-confirmation code exchange. Concurrent writes share one warm-up.
 */
export function withFreshConnection(baseFetch: Fetch, options: FreshConnectionOptions): Fetch {
  const staleAfterMs = options.staleAfterMs ?? CONNECTION_STALE_AFTER_MS;
  const now = options.now ?? Date.now;
  let lastActivityAt: number | null = null;
  let warming: Promise<void> | null = null;

  const ensureFresh = () => {
    warming ??= options.warmUp().finally(() => {
      warming = null;
      lastActivityAt = now();
    });
    return warming;
  };

  return async (input, init) => {
    const method = requestMethod(input, init);
    const isWrite = method !== 'GET' && method !== 'HEAD';
    // No request yet in this process means no pooled connection to this host either.
    if (isWrite && lastActivityAt !== null && now() - lastActivityAt > staleAfterMs) {
      await ensureFresh();
    }
    try {
      return await baseFetch(input, init);
    } finally {
      lastActivityAt = now();
    }
  };
}
