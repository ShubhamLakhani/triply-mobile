export const MINIMUM_AGE = 18;

/** Formats a local calendar date as YYYY-MM-DD. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Client-side mirror of private.is_adult() for instant form feedback only.
 * The database is the authority (it evaluates current_date in UTC, so a user whose
 * 18th birthday is "today" in their own time zone may differ by a few hours).
 */
export function isAdult(dateOfBirth: string, today: Date = new Date()): boolean {
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  if (!year || !month || !day) return false;
  const threshold = toIsoDate(
    new Date(today.getFullYear() - MINIMUM_AGE, today.getMonth(), today.getDate()),
  );
  return dateOfBirth <= threshold;
}

export function isFutureDate(isoDate: string, today: Date = new Date()): boolean {
  return isoDate > toIsoDate(today);
}

/** Whole years since the given YYYY-MM-DD date, or null if unparsable. */
export function ageFromDateOfBirth(dateOfBirth: string, today: Date = new Date()): number | null {
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  if (!year || !month || !day) return null;
  let age = today.getFullYear() - year;
  const beforeBirthday =
    today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}
