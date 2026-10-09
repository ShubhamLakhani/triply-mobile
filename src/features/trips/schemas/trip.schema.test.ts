import { createTripSchema, updateTripSchema } from './trip.schema';

const DESTINATION_ID = '3f1c2a9e-7b4d-4c1e-9a2b-5d6e7f8a9b0c';

describe('trip schemas', () => {
  it('accepts a valid new trip, including past dates and same-day trips', () => {
    expect(
      createTripSchema.parse({
        destination_id: DESTINATION_ID,
        start_date: '2026-12-04',
        end_date: '2026-12-12',
      }),
    ).toEqual({ destination_id: DESTINATION_ID, start_date: '2026-12-04', end_date: '2026-12-12' });
    expect(
      createTripSchema.safeParse({
        destination_id: DESTINATION_ID,
        start_date: '2024-01-01',
        end_date: '2024-01-01',
      }).success,
    ).toBe(true);
  });

  it('rejects an end date before the start date', () => {
    const result = createTripSchema.safeParse({
      destination_id: DESTINATION_ID,
      start_date: '2026-12-12',
      end_date: '2026-12-04',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['end_date']);
  });

  it('rejects malformed ids, dates and visibility values', () => {
    const base = {
      destination_id: DESTINATION_ID,
      start_date: '2026-12-04',
      end_date: '2026-12-12',
    };
    expect(createTripSchema.safeParse({ ...base, destination_id: 'bali' }).success).toBe(false);
    expect(createTripSchema.safeParse({ ...base, start_date: '04/12/2026' }).success).toBe(false);
    expect(createTripSchema.safeParse({ ...base, start_date: '1999-12-31' }).success).toBe(false);
    expect(createTripSchema.safeParse({ ...base, visibility: 'public' }).success).toBe(false);
    expect(createTripSchema.safeParse({ ...base, visibility: 'hidden' }).success).toBe(true);
  });

  it('never accepts owner, status or protected columns from input', () => {
    const base = {
      destination_id: DESTINATION_ID,
      start_date: '2026-12-04',
      end_date: '2026-12-12',
    };
    for (const extra of [
      { user_id: DESTINATION_ID },
      { status: 'active' },
      { id: DESTINATION_ID },
    ]) {
      expect(createTripSchema.safeParse({ ...base, ...extra }).success).toBe(false);
    }
    for (const field of ['user_id', 'status', 'created_at', 'updated_at', 'id']) {
      expect(updateTripSchema.safeParse({ [field]: 'x' }).success).toBe(false);
    }
  });

  it('allows partial updates and checks the range when both dates change', () => {
    expect(updateTripSchema.parse({ visibility: 'hidden' })).toEqual({ visibility: 'hidden' });
    expect(updateTripSchema.safeParse({ end_date: '2026-12-20' }).success).toBe(true);
    expect(
      updateTripSchema.safeParse({ start_date: '2026-12-20', end_date: '2026-12-10' }).success,
    ).toBe(false);
  });
});
