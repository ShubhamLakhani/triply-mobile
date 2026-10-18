import { useCallback, useSyncExternalStore } from 'react';

import { getDeviceLocalStorage } from '@/services/storage/local-storage';

/**
 * Ordered onboarding steps. Every step before `ready` is required: complete_onboarding() on the
 * Ready step checks them all server-side and sets profiles.onboarding_completed_at.
 */
export const ONBOARDING_STEPS = ['profile', 'interests', 'preferences', 'photos', 'ready'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const STEP_ROUTES: Record<OnboardingStep, string> = {
  profile: '/onboarding',
  interests: '/onboarding/interests',
  preferences: '/onboarding/preferences',
  photos: '/onboarding/photos',
  ready: '/onboarding/ready',
};

const KEY_PREFIX = 'triply.onboarding.v1.';
const listeners = new Set<() => void>();

function key(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function storage(): Storage | null {
  try {
    return getDeviceLocalStorage();
  } catch {
    return null;
  }
}

/**
 * Local, per-user record of the furthest step COMPLETED on this device (never sensitive data:
 * it holds a step name only). It only decides where onboarding resumes; whether onboarding is
 * finished is always the server's onboarding_completed_at.
 */
export function getCompletedStep(userId: string): OnboardingStep | null {
  const value = storage()?.getItem(key(userId));
  return value && (ONBOARDING_STEPS as readonly string[]).includes(value)
    ? (value as OnboardingStep)
    : null;
}

export function markStepCompleted(userId: string, step: OnboardingStep): void {
  const current = getCompletedStep(userId);
  if (current && stepIndex(current) >= stepIndex(step)) return;
  storage()?.setItem(key(userId), step);
  emit();
}

export function clearOnboardingProgress(userId: string): void {
  storage()?.removeItem(key(userId));
  emit();
}

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[stepIndex(step) + 1] ?? null;
}

/**
 * Where a returning user resumes. The server profile row wins: an incomplete profile always
 * restarts at the profile step. Otherwise continue after the last step completed here.
 */
export function resolveResumeStep(
  isProfileComplete: boolean,
  completedStep: OnboardingStep | null,
): OnboardingStep {
  if (!isProfileComplete) return 'profile';
  if (completedStep === null) return 'interests';
  return nextStep(completedStep) ?? 'ready';
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reactive view of the local resume marker for one user. */
export function useOnboardingProgress(userId: string | null) {
  const read = useCallback(() => (userId ? getCompletedStep(userId) : null), [userId]);
  const completedStep = useSyncExternalStore(subscribe, read, read);
  return { completedStep, inProgress: completedStep !== null };
}
