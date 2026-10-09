import { reportUserSchema } from './report.schema';

const TARGET = '20000000-0000-4000-8000-00000000000b';
const MATCH = 'e0000000-0000-4000-8000-000000000001';

describe('reportUserSchema', () => {
  it('accepts every documented reason with optional context', () => {
    for (const reason of [
      'harassment',
      'spam',
      'scam',
      'inappropriate_content',
      'impersonation',
      'underage_concern',
      'safety_concern',
      'other',
    ] as const) {
      expect(reportUserSchema.safeParse({ reported_user_id: TARGET, reason }).success).toBe(true);
    }
    expect(
      reportUserSchema.safeParse({
        reported_user_id: TARGET,
        reason: 'scam',
        details: 'Asked for money.',
        related_match_id: MATCH,
        related_trip_id: MATCH,
      }).success,
    ).toBe(true);
  });

  it('enforces the 2000-character details limit after trimming', () => {
    const at = reportUserSchema.safeParse({
      reported_user_id: TARGET,
      reason: 'other',
      details: `  ${'x'.repeat(2000)}  `,
    });
    expect(at.success).toBe(true);
    expect(
      reportUserSchema.safeParse({
        reported_user_id: TARGET,
        reason: 'other',
        details: 'x'.repeat(2001),
      }).success,
    ).toBe(false);
  });

  it('rejects unknown reasons and invalid ids', () => {
    expect(reportUserSchema.safeParse({ reported_user_id: TARGET, reason: 'rude' }).success).toBe(
      false,
    );
    expect(reportUserSchema.safeParse({ reported_user_id: 'x', reason: 'spam' }).success).toBe(
      false,
    );
    expect(
      reportUserSchema.safeParse({
        reported_user_id: TARGET,
        reason: 'spam',
        related_match_id: 'x',
      }).success,
    ).toBe(false);
  });

  it('never accepts reporter, status or timestamp fields', () => {
    for (const extra of [
      { reporter_user_id: TARGET },
      { status: 'dismissed' },
      { created_at: '2026-10-09T00:00:00Z' },
    ]) {
      expect(
        reportUserSchema.safeParse({ reported_user_id: TARGET, reason: 'spam', ...extra }).success,
      ).toBe(false);
    }
  });
});
