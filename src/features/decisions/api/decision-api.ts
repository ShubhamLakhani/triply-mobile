import { getSupabaseClient } from '@/services/supabase';

import {
  decisionResultSchema,
  submitDecisionSchema,
  type SubmitDecisionInput,
} from '../schemas/decision.schema';
import type { DecisionResult, UserDecision } from '../types';

import { DecisionError, toDecisionError } from './decision-errors';

export const DECISION_COLUMNS =
  'id, actor_user_id, target_user_id, decision, source_trip_id, target_trip_id, created_at, updated_at' as const;

/**
 * Records a like/pass through the submit_decision RPC (the only write path). A mutual like
 * creates the match atomically on the server and is reported via `matched`.
 */
export async function submitDecision(input: SubmitDecisionInput): Promise<DecisionResult> {
  const parsed = submitDecisionSchema.safeParse(input);
  if (!parsed.success) {
    throw new DecisionError('invalid_input', 'Decision input is invalid.', { cause: parsed.error });
  }
  const { target_user_id, decision, source_trip_id, target_trip_id } = parsed.data;
  const { data, error } = await getSupabaseClient()
    .rpc('submit_decision', {
      p_target_user_id: target_user_id,
      p_decision: decision,
      ...(source_trip_id ? { p_source_trip_id: source_trip_id } : {}),
      ...(target_trip_id ? { p_target_trip_id: target_trip_id } : {}),
    })
    .single();
  if (error) throw toDecisionError(error);

  const result = decisionResultSchema.safeParse(data);
  if (!result.success) {
    throw new DecisionError('unexpected_response', 'Unexpected decision response.', {
      cause: result.error,
    });
  }
  return result.data;
}

/** The caller's outgoing decisions, most recent first. */
export async function fetchOwnDecisions(userId: string): Promise<UserDecision[]> {
  const { data, error } = await getSupabaseClient()
    .from('user_decisions')
    .select(DECISION_COLUMNS)
    .eq('actor_user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw toDecisionError(error);
  return data;
}

/** The caller's current decision about one user, or null if none. */
export async function fetchOwnDecisionForUser(
  userId: string,
  targetUserId: string,
): Promise<UserDecision | null> {
  const { data, error } = await getSupabaseClient()
    .from('user_decisions')
    .select(DECISION_COLUMNS)
    .eq('actor_user_id', userId)
    .eq('target_user_id', targetUserId)
    .maybeSingle();
  if (error) throw toDecisionError(error);
  return data;
}
