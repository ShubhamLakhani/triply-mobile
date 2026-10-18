import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Surface } from '@/components/ui/Surface';
import { useOwnInterests } from '@/features/interests/hooks/use-interests';
import { useOwnProfilePhotos } from '@/features/photos/hooks/use-profile-photos';
import { useMotionPreference } from '@/hooks/use-motion-preference';
import { useAnalytics } from '@/services/analytics';
import { colors, radius, spacing } from '@/theme';

import { OnboardingError, type OnboardingRequirement } from '../api/onboarding-api';
import { useCompleteOnboarding } from '../hooks/use-complete-onboarding';
import { useOnboardingStep } from '../hooks/use-onboarding-step';
import { clearOnboardingProgress, STEP_ROUTES, type OnboardingStep } from '../progress';

import { OnboardingShell } from './OnboardingShell';

const REQUIREMENT_STEP: Record<OnboardingRequirement, OnboardingStep> = {
  profile: 'profile',
  interests: 'interests',
  gender_preferences: 'preferences',
  age_range: 'preferences',
  photos: 'photos',
};

const REQUIREMENT_LABEL: Record<OnboardingRequirement, string> = {
  profile: 'your name, date of birth and gender',
  interests: '3 to 8 interests',
  gender_preferences: 'who you’d like to meet',
  age_range: 'an age range',
  photos: 'at least one photo',
};

/** In onboarding-step order, so "Fix it" goes to the earliest unmet step. */
function sortMissing(missing: OnboardingRequirement[]): OnboardingRequirement[] {
  const order: OnboardingRequirement[] = [
    'profile',
    'interests',
    'gender_preferences',
    'age_range',
    'photos',
  ];
  return order.filter((item) => missing.includes(item));
}

/**
 * Final step: the server validates every requirement and records completion
 * (complete_onboarding). The updated profile row flips the root guard to the app.
 */
export function ReadyStep() {
  const { userId, profile, back } = useOnboardingStep('ready');
  const photos = useOwnProfilePhotos(userId);
  const interests = useOwnInterests(userId);
  const complete = useCompleteOnboarding(userId);
  const analytics = useAnalytics();
  const { reduceMotion, duration } = useMotionPreference();
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<OnboardingRequirement[]>([]);

  const name = profile.data?.first_name;
  const fixStep = missing[0] ? REQUIREMENT_STEP[missing[0]] : null;

  const finish = async () => {
    setError(null);
    setMissing([]);
    try {
      await complete.mutateAsync();
      analytics.track('onboarding_completed', {
        photo_count: photos.data?.length ?? 0,
        interest_count: interests.data?.length ?? 0,
      });
      if (userId) clearOnboardingProgress(userId);
    } catch (cause) {
      if (cause instanceof OnboardingError && cause.code === 'incomplete') {
        const sorted = sortMissing(cause.missing);
        setMissing(sorted);
        setError(
          sorted.length > 0
            ? `Almost there. Still needed: ${sorted.map((item) => REQUIREMENT_LABEL[item]).join(', ')}.`
            : 'Your profile isn’t complete yet. Go back and check each step.',
        );
      } else if (cause instanceof OnboardingError && cause.code === 'account_inactive') {
        setError('Your account can’t make changes right now.');
      } else {
        setError(
          'We couldn’t finish setting up your profile. Check your connection and try again.',
        );
      }
    }
  };

  return (
    <OnboardingShell
      step="ready"
      title={name ? `You’re all set, ${name}` : 'You’re all set'}
      subtitle="Add a trip when you’re ready and we’ll show you who else will be there."
      primaryLabel="Start exploring"
      onPrimary={() => void finish()}
      primaryLoading={complete.isPending}
      secondaryLabel={fixStep ? 'Fix it now' : undefined}
      onSecondary={fixStep ? () => router.replace(STEP_ROUTES[fixStep] as never) : undefined}
      onBack={back}
      error={error}
      hideProgress
      testID="onboarding-ready"
    >
      <View style={styles.center}>
        <Animated.View
          entering={reduceMotion ? undefined : ZoomIn.duration(duration('brand'))}
          style={styles.badge}
        >
          <Icon name="check" size={40} rawColor={colors.onPrimary} />
        </Animated.View>
      </View>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInUp.duration(duration('standard')).delay(200)}
      >
        <Surface tone="tinted">
          <AppText variant="bodyStrong">What happens next</AppText>
          <AppText variant="small" color="textSecondary">
            Your profile is private until you add a trip. Only travellers with overlapping dates in
            the same place will see you.
          </AppText>
        </Surface>
      </Animated.View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: spacing.lg },
  badge: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
