import { useQuery } from '@tanstack/react-query';

import { fetchOwnAccountState } from '../api/account-api';
import { AccountError } from '../api/account-errors';
import { accountKeys } from '../api/account-keys';

/**
 * The signed-in user's account state. Refetched on focus/reconnect like other server state and
 * immediately whenever a write fails with account_inactive (see query-client.ts), so a
 * suspension takes effect in the UI without a restart. Enforcement itself is server-side.
 */
export function useOwnAccountState(userId: string | null) {
  return useQuery({
    queryKey: accountKeys.own(userId ?? 'signed-out'),
    queryFn: () => {
      if (!userId) throw new AccountError('not_authenticated', 'Not signed in.');
      return fetchOwnAccountState();
    },
    enabled: userId !== null,
  });
}
