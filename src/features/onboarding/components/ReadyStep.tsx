import { useEffect, useState } from 'react';
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

import { useOnboardingStep } from '../hooks/use-onboarding-step';
import { clearOnboardingProgress } from '../progress';

import { OnboardingShell } from './OnboardingShell';

/** Final step: re-check the server row, then hand over to the app. */
export function ReadyStep() {
  const { userId, profile, back } = useOnboardingStep('ready');
  const photos = useOwnProfilePhotos(userId);
  const interests = useOwnInterests(userId);
  const analytics = useAnalytics();
  const { reduceMotion, duration } = useMotionPreference();
  const [error, setError] = useState<string | null>(null);

  const { refetch } = profile;
  useEffect(() => {
    void refetch();
  }, [refetch]);

  const complete = profile.data?.is_profile_complete === true;
  const name = profile.data?.first_name;

  const finish = () => {
    setError(null);
    if (!complete) {
      setError(
        'Your profile isn’t complete yet. Go back and check your name, date of birth and gender.',
      );
      return;
    }
    analytics.track('onboarding_completed', {
      photo_count: photos.data?.length ?? 0,
      interest_count: interests.data?.length ?? 0,
    });
    // Clearing the marker flips the root guard to `app`; the navigator then drops the
    // onboarding group and the entry route redirects to Discover. Navigating here directly
    // would target the tabs while they are still guarded.
    if (userId) clearOnboardingProgress(userId);
  };

  return (
    <OnboardingShell
      step="ready"
      title={name ? `You’re all set, ${name}` : 'You’re all set'}
      subtitle="Add a trip when you’re ready and we’ll show you who else will be there."
      primaryLabel="Start exploring"
      onPrimary={finish}
      // Wait for the server re-check started on mount; only a complete row may exit.
      primaryLoading={profile.isFetching}
      primaryDisabled={profile.data === undefined}
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
            Your profile is private until you add a trip. Only travellers with overlapping dates at
            the same destination will see you.
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
