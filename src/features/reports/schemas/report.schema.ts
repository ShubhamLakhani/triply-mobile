import { z } from 'zod';

import { REPORT_DETAILS_MAX_LENGTH, REPORT_REASONS } from '../types';

/**
 * Input for report_user. The reporter is always auth.uid() and status is always 'open' on the
 * server, so no reporter, status or timestamp fields are accepted (`.strict()`).
 */
export const reportUserSchema = z
  .object({
    reported_user_id: z.uuid({ message: 'Invalid user.' }),
    reason: z.enum(REPORT_REASONS),
    details: z
      .string()
      .trim()
      .max(REPORT_DETAILS_MAX_LENGTH, {
        message: `Details must be at most ${REPORT_DETAILS_MAX_LENGTH} characters.`,
      })
      .optional(),
    related_match_id: z.uuid().optional(),
    related_trip_id: z.uuid().optional(),
  })
  .strict();

/** Validates the RPC response shape before it reaches UI code. */
export const reportResultSchema = z.object({
  report_id: z.uuid(),
  created_at: z.string().min(1),
});

export type ReportUserInput = z.input<typeof reportUserSchema>;
