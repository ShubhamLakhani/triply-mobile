import type { Tables } from '@/services/supabase';

/** Values accepted by the user_reports_reason_valid CHECK constraint. */
export const REPORT_REASONS = [
  'harassment',
  'spam',
  'scam',
  'inappropriate_content',
  'impersonation',
  'underage_concern',
  'safety_concern',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Maximum length of optional report details (matches the database constraint). */
export const REPORT_DETAILS_MAX_LENGTH = 2000;

/**
 * A report the signed-in user submitted. Moderation `status` is intentionally excluded: app
 * clients have no read grant on it. Reports against the user are never readable.
 */
export type OwnReport = Pick<
  Tables<'user_reports'>,
  | 'id'
  | 'reported_user_id'
  | 'reason'
  | 'details'
  | 'related_match_id'
  | 'related_trip_id'
  | 'created_at'
>;

/** Result of report_user. */
export interface ReportResult {
  report_id: string;
  created_at: string;
}
