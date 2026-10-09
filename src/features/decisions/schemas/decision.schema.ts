import { z } from 'zod';

import { DECISIONS } from '../types';

/**
 * Input for submit_decision. The actor is always the signed-in user (auth.uid() on the
 * server), so no actor, match or timestamp fields are accepted (`.strict()`).
 */
export const submitDecisionSchema = z
  .object({
    target_user_id: z.uuid({ message: 'Invalid user.' }),
    decision: z.enum(DECISIONS),
    source_trip_id: z.uuid().optional(),
    target_trip_id: z.uuid().optional(),
  })
  .strict();

/** Validates the RPC response shape before it reaches UI code. */
export const decisionResultSchema = z.object({
  decision_id: z.uuid(),
  decision: z.enum(DECISIONS),
  matched: z.boolean(),
  match_id: z.uuid().nullable(),
  match_created: z.boolean(),
});

export type SubmitDecisionInput = z.input<typeof submitDecisionSchema>;
