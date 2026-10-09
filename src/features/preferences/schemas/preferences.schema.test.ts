import { discoveryPreferencesUpdateSchema, genderPreferencesSchema } from './preferences.schema';

describe('discovery preference schemas', () => {
  it('accepts valid preferences and nullable distance', () => {
    expect(
      discoveryPreferencesUpdateSchema.parse({
        min_age: 25,
        max_age: 40,
        minimum_overlap_days: 3,
        max_distance_km: null,
      }),
    ).toEqual({ min_age: 25, max_age: 40, minimum_overlap_days: 3, max_distance_km: null });
  });

  it.each([
    [{ min_age: 17 }],
    [{ max_age: 100 }],
    [{ min_age: 40, max_age: 30 }],
    [{ minimum_overlap_days: 0 }],
    [{ minimum_overlap_days: 61 }],
    [{ max_distance_km: 0 }],
    [{ max_distance_km: 20001 }],
    [{ min_age: 25.5 }],
    [{ user_id: 'x' }],
    [{ created_at: 'x' }],
  ])('rejects %o', (input) => {
    expect(discoveryPreferencesUpdateSchema.safeParse(input).success).toBe(false);
  });

  it('limits gender preferences to profile gender values and collapses duplicates', () => {
    expect(genderPreferencesSchema.parse(['woman', 'woman', 'non_binary'])).toEqual([
      'woman',
      'non_binary',
    ]);
    expect(genderPreferencesSchema.parse([])).toEqual([]);
    expect(genderPreferencesSchema.safeParse(['everyone']).success).toBe(false);
  });
});
