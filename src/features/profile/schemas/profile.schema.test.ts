import { profileUpdateSchema } from './profile.schema';

describe('profileUpdateSchema', () => {
  it('trims text and turns empty strings into null', () => {
    expect(profileUpdateSchema.parse({ first_name: '  Asha ', bio: '   ' })).toEqual({
      first_name: 'Asha',
      bio: null,
    });
  });

  it('accepts a partial update with valid values', () => {
    expect(
      profileUpdateSchema.parse({
        date_of_birth: '1995-05-17',
        gender: 'non_binary',
        is_discoverable: true,
      }),
    ).toEqual({ date_of_birth: '1995-05-17', gender: 'non_binary', is_discoverable: true });
  });

  it('rejects protected columns', () => {
    for (const key of ['id', 'is_profile_complete', 'created_at', 'updated_at']) {
      expect(profileUpdateSchema.safeParse({ [key]: 'x' }).success).toBe(false);
    }
  });

  it('enforces the gender values allowed by the database', () => {
    expect(profileUpdateSchema.safeParse({ gender: 'prefer_not_to_say' }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ gender: 'robot' }).success).toBe(false);
  });

  it('rejects future, under-18 and implausible dates of birth', () => {
    const nextYear = `${new Date().getFullYear() + 1}-01-01`;
    const tenYearsAgo = `${new Date().getFullYear() - 10}-01-01`;
    expect(profileUpdateSchema.safeParse({ date_of_birth: nextYear }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ date_of_birth: tenYearsAgo }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ date_of_birth: '1899-12-31' }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ date_of_birth: '17/05/1995' }).success).toBe(false);
  });

  it('enforces database length limits', () => {
    expect(profileUpdateSchema.safeParse({ first_name: 'x'.repeat(81) }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ bio: 'x'.repeat(1001) }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ occupation: 'x'.repeat(121) }).success).toBe(false);
  });
});
