import { z } from 'zod';

/** Values of public.account_states.status (M-02 migration). The safety hold is never exposed. */
export const ACCOUNT_STATUSES = ['active', 'suspended', 'banned', 'deletion_pending'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const accountStateSchema = z.object({
  status: z.enum(ACCOUNT_STATUSES),
  suspended_until: z.string().nullable(),
});

/** The caller's effective account state (get_my_account_state RPC). */
export type AccountState = z.infer<typeof accountStateSchema>;
