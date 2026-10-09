import { z } from 'zod';

/** The only input to block_user / unblock_user. The blocker is always auth.uid() on the server. */
export const blockTargetSchema = z.uuid({ message: 'Invalid user.' });

/** Validates block_user's response (the caller's own block row). */
export const blockResultSchema = z.object({
  blocked_user_id: z.uuid(),
  created_at: z.string().min(1),
});
