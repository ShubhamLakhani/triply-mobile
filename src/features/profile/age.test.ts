import { isAdult, isFutureDate, toIsoDate } from './age';

describe('age helpers (client mirror of private.is_adult)', () => {
  const today = new Date(2026, 9, 9); // 9 Oct 2026, local time

  it('treats the 18th birthday as adult', () => {
    expect(isAdult('2008-10-09', today)).toBe(true);
    expect(isAdult('2008-10-10', today)).toBe(false);
    expect(isAdult('1990-01-01', today)).toBe(true);
  });

  it('handles leap-day birthdays like the database (adult from 1 March in non-leap years)', () => {
    expect(isAdult('2008-02-29', new Date(2026, 1, 28))).toBe(false);
    expect(isAdult('2008-02-29', new Date(2026, 2, 1))).toBe(true);
  });

  it('rejects malformed dates', () => {
    expect(isAdult('not-a-date', today)).toBe(false);
  });

  it('detects future dates and formats ISO dates', () => {
    expect(toIsoDate(today)).toBe('2026-10-09');
    expect(isFutureDate('2026-10-10', today)).toBe(true);
    expect(isFutureDate('2026-10-09', today)).toBe(false);
  });
});
