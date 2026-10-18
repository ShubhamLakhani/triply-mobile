import { getSupabaseClient } from '@/services/supabase';

import { accountStateSchema, type AccountState } from '../types';

import { AccountError, toAccountError } from './account-errors';

/**
 * The caller's effective account status. Reads only through the RPC: the table itself has no
 * client privileges, and the RPC never returns the internal safety hold or reason.
 */
export async function fetchOwnAccountState(): Promise<AccountState> {
  const { data, error } = await getSupabaseClient().rpc('get_my_account_state').single();
  if (error) throw toAccountError(error);
  const parsed = accountStateSchema.safeParse(data);
  if (!parsed.success) {
    throw new AccountError('unexpected_response', 'Unexpected account state.', {
      cause: parsed.error,
    });
  }
  return parsed.data;
}
