import { PROFILE_COLUMNS } from '@/features/profile/api/profile-api';
import type { Profile } from '@/features/profile/types';
import { getErrorDetails, getSupabaseClient, TRIPLY_SQLSTATE } from '@/services/supabase';

/** What complete_onboarding() can report as missing (`details` of SQLSTATE TR002). */
export const ONBOARDING_REQUIREMENTS = [
  'profile',
  'photos',
  'interests',
  'gender_preferences',
  'age_range',
] as const;
export type OnboardingRequirement = (typeof ONBOARDING_REQUIREMENTS)[number];

export type OnboardingErrorCode = 'incomplete' | 'account_inactive' | 'unknown';

/** Typed error for onboarding completion. `missing` lists unmet requirements (TR002). */
export class OnboardingError extends Error {
  readonly code: OnboardingErrorCode;
  readonly missing: OnboardingRequirement[];

  constructor(
    code: OnboardingErrorCode,
    message: string,
    options: { cause?: unknown; missing?: OnboardingRequirement[] } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'OnboardingError';
    this.code = code;
    this.missing = options.missing ?? [];
  }
}

export function toOnboardingError(error: { code?: string }): OnboardingError {
  switch (error.code) {
    case TRIPLY_SQLSTATE.onboardingIncomplete: {
      const missing = (getErrorDetails(error) ?? '')
        .split(',')
        .filter((key): key is OnboardingRequirement =>
          (ONBOARDING_REQUIREMENTS as readonly string[]).includes(key),
        );
      return new OnboardingError('incomplete', 'Onboarding requirements not met.', {
        cause: error,
        missing,
      });
    }
    case TRIPLY_SQLSTATE.accountInactive:
      return new OnboardingError('account_inactive', 'Account is not active.', { cause: error });
    default:
      return new OnboardingError('unknown', 'Onboarding completion failed.', { cause: error });
  }
}

/**
 * Asks the server to complete onboarding. The database validates every requirement in one
 * transaction (core profile 18+, a primary photo, 3–8 interests, at least one gender
 * preference, a valid age range) and sets profiles.onboarding_completed_at once. Idempotent.
 * Returns the updated own profile row (same columns as fetchOwnProfile).
 */
export async function completeOnboarding(): Promise<Profile> {
  const { data, error } = await getSupabaseClient()
    .rpc('complete_onboarding')
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw toOnboardingError(error);
  return data;
}
