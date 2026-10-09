import { decisionResultSchema, submitDecisionSchema } from './decision.schema';

const TARGET = '20000000-0000-4000-8000-00000000000b';
const TRIP = 'a1000000-0000-4000-8000-000000000001';

describe('submitDecisionSchema', () => {
  it('accepts like/pass with optional trip context', () => {
    expect(
      submitDecisionSchema.safeParse({ target_user_id: TARGET, decision: 'like' }).success,
    ).toBe(true);
    expect(
      submitDecisionSchema.safeParse({
        target_user_id: TARGET,
        decision: 'pass',
        source_trip_id: TRIP,
        target_trip_id: TRIP,
      }).success,
    ).toBe(true);
  });

  it('rejects unknown decisions and invalid ids', () => {
    expect(
      submitDecisionSchema.safeParse({ target_user_id: TARGET, decision: 'superlike' }).success,
    ).toBe(false);
    expect(
      submitDecisionSchema.safeParse({ target_user_id: 'nope', decision: 'like' }).success,
    ).toBe(false);
    expect(
      submitDecisionSchema.safeParse({
        target_user_id: TARGET,
        decision: 'like',
        source_trip_id: 'x',
      }).success,
    ).toBe(false);
  });

  it('never accepts client-supplied actor, match or timestamp fields', () => {
    for (const extra of [
      { actor_user_id: TARGET },
      { match_id: TARGET },
      { created_at: '2026-10-09T00:00:00Z' },
    ]) {
      expect(
        submitDecisionSchema.safeParse({ target_user_id: TARGET, decision: 'like', ...extra })
          .success,
      ).toBe(false);
    }
  });
});

describe('decisionResultSchema', () => {
  it('accepts a null match_id (no match or unmatched pair)', () => {
    expect(
      decisionResultSchema.safeParse({
        decision_id: TRIP,
        decision: 'like',
        matched: false,
        match_id: null,
        match_created: false,
      }).success,
    ).toBe(true);
  });

  it('rejects malformed responses', () => {
    expect(decisionResultSchema.safeParse({ decision_id: TRIP, decision: 'like' }).success).toBe(
      false,
    );
  });
});
