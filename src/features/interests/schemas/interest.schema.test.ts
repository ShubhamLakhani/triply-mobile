import { interestSelectionSchema } from './interest.schema';

const id = (n: number) => `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('interestSelectionSchema', () => {
  it('accepts up to 10 unique interests and collapses duplicates', () => {
    expect(interestSelectionSchema.parse([id(1), id(1), id(2)])).toEqual([id(1), id(2)]);
    expect(
      interestSelectionSchema.safeParse(Array.from({ length: 10 }, (_, i) => id(i + 1))).success,
    ).toBe(true);
    expect(interestSelectionSchema.parse([])).toEqual([]);
  });

  it('rejects more than 10 interests and invalid ids', () => {
    expect(
      interestSelectionSchema.safeParse(Array.from({ length: 11 }, (_, i) => id(i + 1))).success,
    ).toBe(false);
    expect(interestSelectionSchema.safeParse(['hiking']).success).toBe(false);
  });
});
