import { z } from 'zod';

import { getSupabaseClient } from '@/services/supabase';

import { toOwnMatch, type OwnMatch } from '../types';

import { MatchError, toMatchError } from './match-errors';

export const MATCH_COLUMNS =
  'id, user_low_id, user_high_id, created_at, unmatched_at, unmatched_by' as const;

const uuid = z.uuid();

function parseUuid(value: string, label: string): string {
  const parsed = uuid.safeParse(value);
  if (!parsed.success)
    throw new MatchError('invalid_input', `Invalid ${label}.`, { cause: parsed.error });
  return parsed.data;
}

/** All of the caller's matches (active and unmatched history), newest first. */
export async function fetchOwnMatches(userId: string): Promise<OwnMatch[]> {
  const id = parseUuid(userId, 'user id');
  const { data, error } = await getSupabaseClient()
    .from('matches')
    .select(MATCH_COLUMNS)
    .or(`user_low_id.eq.${id},user_high_id.eq.${id}`)
    .order('created_at', { ascending: false });
  if (error) throw toMatchError(error);
  return data.map((match) => toOwnMatch(match, id));
}

/** One of the caller's matches, or null if it does not exist or is not theirs. */
export async function fetchOwnMatchById(userId: string, matchId: string): Promise<OwnMatch | null> {
  const id = parseUuid(userId, 'user id');
  const { data, error } = await getSupabaseClient()
    .from('matches')
    .select(MATCH_COLUMNS)
    .eq('id', parseUuid(matchId, 'match id'))
    .maybeSingle();
  if (error) throw toMatchError(error);
  return data ? toOwnMatch(data, id) : null;
}

/** Ends a match (participant only, idempotent, terminal) via the unmatch RPC. */
export async function unmatch(userId: string, matchId: string): Promise<OwnMatch> {
  const id = parseUuid(userId, 'user id');
  const { data, error } = await getSupabaseClient()
    .rpc('unmatch', { p_match_id: parseUuid(matchId, 'match id') })
    .single();
  if (error) throw toMatchError(error);
  return toOwnMatch(data, id);
}
