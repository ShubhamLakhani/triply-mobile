import { ProfileError } from '../api/profile-errors';

/** User-safe message for a failed profile save (never raw database text). */
export function profileErrorMessage(error: unknown): string {
  if (error instanceof ProfileError) {
    switch (error.code) {
      case 'invalid_input':
      case 'rejected_by_database':
        return 'Some details weren’t accepted. Check your date of birth and try again.';
      case 'not_authenticated':
        return 'Please sign in again to continue.';
      default:
        return 'We couldn’t save your profile. Please try again.';
    }
  }
  return 'We couldn’t save your profile. Please try again.';
}
