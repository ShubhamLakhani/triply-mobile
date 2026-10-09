import { getSupabaseClient } from '@/services/supabase';

import {
  reportResultSchema,
  reportUserSchema,
  type ReportUserInput,
} from '../schemas/report.schema';
import type { OwnReport, ReportResult } from '../types';

import { ReportError, toReportError } from './report-errors';

/** Explicit columns: `status` is not granted to app clients, so `*` would be refused. */
export const REPORT_COLUMNS =
  'id, reported_user_id, reason, details, related_match_id, related_trip_id, created_at' as const;

/** Files a report through the report_user RPC (the only write path). */
export async function reportUser(input: ReportUserInput): Promise<ReportResult> {
  const parsed = reportUserSchema.safeParse(input);
  if (!parsed.success) {
    throw new ReportError('invalid_input', 'Report input is invalid.', { cause: parsed.error });
  }
  const { reported_user_id, reason, details, related_match_id, related_trip_id } = parsed.data;
  const { data, error } = await getSupabaseClient()
    .rpc('report_user', {
      p_reported_user_id: reported_user_id,
      p_reason: reason,
      ...(details ? { p_details: details } : {}),
      ...(related_match_id ? { p_related_match_id: related_match_id } : {}),
      ...(related_trip_id ? { p_related_trip_id: related_trip_id } : {}),
    })
    .single();
  if (error) throw toReportError(error);

  const result = reportResultSchema.safeParse(data);
  if (!result.success) {
    throw new ReportError('unexpected_response', 'Unexpected report response.', {
      cause: result.error,
    });
  }
  return result.data;
}

/** Reports the caller submitted, newest first (without moderation status). */
export async function fetchOwnReports(userId: string): Promise<OwnReport[]> {
  const { data, error } = await getSupabaseClient()
    .from('user_reports')
    .select(REPORT_COLUMNS)
    .eq('reporter_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw toReportError(error);
  return data;
}
