import type { Tables } from '@/services/supabase';

/** Values accepted by the user_decisions_decision_valid CHECK constraint. */
export const DECISIONS = ['like', 'pass'] as const;
export type Decision = (typeof DECISIONS)[number];

/** An outgoing decision row (generated types). Incoming decisions are never readable. */
export type UserDecision = Tables<'user_decisions'>;

/**
 * Result of submit_decision. It never says whether the other user liked you unless a match
 * now exists (`matched`).
 */
export interface DecisionResult {
  decision_id: string;
  decision: Decision;
  matched: boolean;
  match_id: string | null;
  match_created: boolean;
}
