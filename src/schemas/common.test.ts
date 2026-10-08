import { emailSchema, nonEmptyTrimmedString } from './common';

describe('common schemas', () => {
  it('normalises email addresses', () => {
    expect(emailSchema.parse('  Traveler@Example.COM ')).toBe('traveler@example.com');
  });

  it('rejects invalid email addresses with a friendly message', () => {
    const result = emailSchema.safeParse('not-an-email');
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.message).toBe('Enter a valid email address.');
  });

  it('trims and bounds free text', () => {
    const schema = nonEmptyTrimmedString(5);
    expect(schema.parse('  Bali ')).toBe('Bali');
    expect(schema.safeParse('   ').success).toBe(false);
    expect(schema.safeParse('Lisbon').success).toBe(false);
  });
});
