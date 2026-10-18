import { InterestError } from '@/features/interests/api/interest-errors';
import { PreferenceError } from '@/features/preferences/api/preference-errors';

import { ProfileError } from '../api/profile-errors';

/** Shown for any write rejected because the account is not active (all features use it). */
export const ACCOUNT_INACTIVE_MESSAGE = 'Your account can’t make changes right now.';

/** User-safe message for a failed profile save (never raw database text). */
export function profileErrorMessage(error: unknown): string {
  if (error instanceof ProfileError) {
    switch (error.code) {
      case 'under_18':
        return 'You need to be 18 or over to use Triply.';
      case 'date_of_birth_locked':
        return 'Your date of birth can’t be changed after sign-up. Contact support if it’s wrong.';
      case 'core_profile_required':
        return 'Your first name and gender are required.';
      case 'account_inactive':
        return ACCOUNT_INACTIVE_MESSAGE;
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

/** User-safe message for a failed interest save. */
export function interestErrorMessage(error: unknown): string {
  if (error instanceof InterestError) {
    switch (error.code) {
      case 'minimum_required':
        return 'Keep at least 3 interests on your profile.';
      case 'limit_reached':
        return 'You can choose up to 8 interests.';
      case 'interest_unavailable':
        return 'One of those interests isn’t available any more. Pick another one.';
      case 'account_inactive':
        return ACCOUNT_INACTIVE_MESSAGE;
      default:
        break;
    }
  }
  return 'We couldn’t save your interests. Please try again.';
}

/** User-safe message for a failed preferences save. */
export function preferenceErrorMessage(error: unknown): string {
  if (error instanceof PreferenceError) {
    switch (error.code) {
      case 'gender_required':
        return 'Choose at least one option for who you’d like to meet.';
      case 'account_inactive':
        return ACCOUNT_INACTIVE_MESSAGE;
      default:
        break;
    }
  }
  return 'We couldn’t save your preferences. Please try again.';
}
