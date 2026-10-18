/**
 * Typed analytics event catalogue.
 *
 * Privacy rule: never include message text, bios, names, dates of birth, emails, phone numbers,
 * exact locations, photo paths, report details or any raw profile value. Step names and counts
 * only.
 */
export type AnalyticsPropertyValue = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;
export type AnalyticsEventMapBase = Record<string, AnalyticsProperties>;

export type OnboardingStepName = 'profile' | 'interests' | 'preferences' | 'photos' | 'ready';

export interface AnalyticsEventMap extends AnalyticsEventMapBase {
  onboarding_started: Record<never, never>;
  onboarding_step_viewed: { step: OnboardingStepName };
  onboarding_step_completed: { step: OnboardingStepName; skipped: boolean };
  onboarding_completed: { photo_count: number; interest_count: number };
  profile_edit_opened: { section: 'basics' | 'interests' | 'preferences' | 'photos' };
  photo_upload_completed: { photo_count: number };
  sign_in_completed: { method: 'password' };
  sign_up_completed: { method: 'password'; needs_email_confirmation: boolean };
}
