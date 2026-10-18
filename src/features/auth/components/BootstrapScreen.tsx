import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { LoadingState } from '@/components/feedback/LoadingState';
import { useMotionPreference } from '@/hooks/use-motion-preference';
import { colors, spacing } from '@/theme';

import type { AppAreaProblem } from '../routing/resolve-area';

const PROBLEM_COPY: Record<AppAreaProblem, string> = {
  session: 'We couldn’t restore your session. Check your connection and try again.',
  profile: 'We couldn’t load your profile. Check your connection and try again.',
  account: 'We couldn’t load your account. Check your connection and try again.',
  offline: 'You’re offline. Connect to the internet and try again.',
};

export interface BootstrapScreenProps {
  /** When set, shows a calm retry state instead of the loader. */
  onRetry?: () => void;
  onSignOut?: () => void;
  problem?: AppAreaProblem | null;
}

/** Full-screen brand bootstrap shown while the session and profile resolve. Prevents route flash. */
export function BootstrapScreen({ onRetry, onSignOut, problem }: BootstrapScreenProps) {
  const { reduceMotion, duration } = useMotionPreference();
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(duration('standard'))}
      style={styles.root}
      testID={onRetry ? 'bootstrap-error' : 'bootstrap-screen'}
    >
      <AppText variant="h1" color="primary">
        Triply
      </AppText>
      {onRetry ? (
        <View style={styles.error}>
          <AppText
            variant="body"
            color="textSecondary"
            align="center"
            testID="bootstrap-error-message"
          >
            {PROBLEM_COPY[problem ?? 'profile']}
          </AppText>
          <AppButton label="Try again" onPress={onRetry} testID="bootstrap-retry" />
          {onSignOut ? (
            <AppButton
              label="Sign out"
              variant="secondary"
              onPress={onSignOut}
              testID="bootstrap-sign-out"
            />
          ) : null}
        </View>
      ) : (
        <LoadingState label="Getting things ready" />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  error: { alignItems: 'center', gap: spacing.md },
});
