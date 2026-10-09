import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getEnv } from '@/config/env';
import { getDeviceLocalStorage } from '@/services/storage/local-storage';

import type { Database } from './database.types';

/**
 * The single Supabase client for the app.
 *
 * - Uses the public publishable key only; authorization is enforced by RLS / RPC / Edge Functions.
 * - Session persistence follows the current Expo + Supabase recommendation (expo-sqlite localStorage).
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
        // Deep-link auth callbacks are handled explicitly by expo-linking in Phase 1M.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
