import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getEnv } from '@/config/env';
import { getDeviceLocalStorage } from '@/services/storage/local-storage';

import type { Database } from './database.types';
import { withFreshConnection } from './fresh-connection-fetch';
import { createTimeoutFetch } from './timeout-fetch';
import { warmUpSupabaseConnection } from './warm-up';

/**
 * The single Supabase client for the app.
 *
 * - Uses the public publishable key only; authorization is enforced by RLS / RPC / Edge Functions.
 * - Session persistence follows the current Expo + Supabase recommendation (expo-sqlite localStorage).
 * - PKCE flow: email links come back with a one-time `code` that only this install can exchange
 *   (its code verifier is in local storage). Raw tokens in links are never accepted.
 * - Every HTTP request has a time budget (timeout-fetch.ts); nothing can spin forever.
 * - Writes after a quiet period first refresh the connection (fresh-connection-fetch.ts), so a
 *   POST never goes out on a keep-alive connection that died silently.
 * - Screens must not import this directly. Feature `api/` modules (Phase 1M+) wrap it with
 *   TanStack Query hooks.
 *
 * Typed with the CLI-generated `Database` (database.types.ts). Regenerate it with
 * `npm run supabase:types` after every schema migration; never edit it by hand.
 */
export type TriplySupabaseClient = SupabaseClient<Database>;

let client: TriplySupabaseClient | undefined;

export function getSupabaseClient(): TriplySupabaseClient {
  if (!client) {
    const env = getEnv();
    client = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
      auth: {
        storage: getDeviceLocalStorage(),
        persistSession: true,
        autoRefreshToken: true,
        flowType: 'pkce',
        // Deep-link auth callbacks are handled explicitly (features/auth/api/auth-links.ts).
        detectSessionInUrl: false,
      },
      global: {
        fetch: createTimeoutFetch(withFreshConnection(fetch, { warmUp: warmUpSupabaseConnection })),
      },
    });
  }
  return client;
}
