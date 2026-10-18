import { getEnv } from '@/config/env';

/**
 * Per-attempt budget. Must exceed the time iOS needs to declare a silently dead connection
 * lost (observed 5.0–6.1 s): a warm-up cancelled earlier leaves the dead connection pooled and
 * the next write reuses it. A healthy connection answers in ~100 ms.
 */
export const WARM_UP_ATTEMPT_TIMEOUT_MS = 8_000;

/** One GET to the auth health endpoint. True when any HTTP response came back. */
async function ping(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WARM_UP_ATTEMPT_TIMEOUT_MS);
  try {
    const env = getEnv();
    await fetch(`${env.supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: { apikey: env.supabasePublishableKey },
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Makes sure the next request to Supabase gets a live connection.
 *
 * Why: an idle keep-alive (HTTP/3) connection can die silently — NAT/router UDP timeouts after
 * ~1–2 minutes, or iOS suspending the app. iOS then reuses it, and a POST/PATCH fails with
 * NSURLErrorNetworkConnectionLost (-1005) without being retried (seen in simulator E2E on
 * sign-in, the email-confirmation exchange and the profile save). This idempotent GET hits the
 * dead connection instead; once iOS has declared it lost, a second GET opens a fresh one,
 * which the write that follows then uses. Best effort: never throws.
 */
export async function warmUpSupabaseConnection(): Promise<void> {
  if (await ping()) return;
  await ping();
}
