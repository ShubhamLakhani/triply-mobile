import {
  clearOnboardingProgress,
  getCompletedStep,
  markStepCompleted,
  resolveResumeStep,
  STEP_ROUTES,
} from './progress';

jest.mock('@/services/storage/local-storage', () => {
  const store = new Map<string, string>();
  return {
    getDeviceLocalStorage: () => ({
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    }),
  };
});

const A = 'user-a';
const B = 'user-b';

describe('onboarding progress', () => {
  afterEach(() => {
    clearOnboardingProgress(A);
    clearOnboardingProgress(B);
  });

  it('resumes at the profile step whenever the server profile is incomplete', () => {
    markStepCompleted(A, 'photos');
    expect(resolveResumeStep(false, getCompletedStep(A))).toBe('profile');
  });

  it('resumes after the last completed step for a complete profile', () => {
    expect(resolveResumeStep(true, null)).toBe('interests');
    markStepCompleted(A, 'profile');
    expect(resolveResumeStep(true, getCompletedStep(A))).toBe('interests');
    markStepCompleted(A, 'preferences');
    expect(resolveResumeStep(true, getCompletedStep(A))).toBe('photos');
    markStepCompleted(A, 'photos');
    expect(resolveResumeStep(true, getCompletedStep(A))).toBe('ready');
  });

  it('never moves progress backwards and keeps users separate', () => {
    markStepCompleted(A, 'preferences');
    markStepCompleted(A, 'profile');
    expect(getCompletedStep(A)).toBe('preferences');
    expect(getCompletedStep(B)).toBeNull();
  });

  it('clearing the marker forgets the resume position (completion is server-side)', () => {
    markStepCompleted(A, 'interests');
    clearOnboardingProgress(A);
    expect(getCompletedStep(A)).toBeNull();
    expect(resolveResumeStep(true, getCompletedStep(A))).toBe('interests');
  });

  it('maps every step to a route', () => {
    expect(STEP_ROUTES.profile).toBe('/onboarding');
    expect(STEP_ROUTES.ready).toBe('/onboarding/ready');
  });
});
