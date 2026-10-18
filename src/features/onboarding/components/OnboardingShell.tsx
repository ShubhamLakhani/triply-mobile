import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';

import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { InlineMessage } from '@/components/ui/InlineMessage';
import { SegmentedProgress } from '@/components/ui/SegmentedProgress';
import { useAuthSession } from '@/features/auth/hooks/use-auth-session';
import { useMotionPreference } from '@/hooks/use-motion-preference';
import { captureError } from '@/services/observability';
import { spacing } from '@/theme';

import { ONBOARDING_STEPS, stepIndex, type OnboardingStep } from '../progress';

export interface OnboardingShellProps {
  step: OnboardingStep;
  title: string;
  subtitle?: string;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  /** Secondary text action under the primary button (e.g. "Skip for now"). */
  secondaryLabel?: string;
  onSecondary?: () => void;
  onBack?: (() => void) | false;
  error?: string | null;
  /** Hide the progress segments (used by the final "ready" step). */
  hideProgress?: boolean;
  testID?: string;
}

/** Header action so nobody is trapped in onboarding (wrong account, under 18, …). */
function OnboardingSignOut({ onError }: { onError: (message: string | null) => void }) {
  const { signOut } = useAuthSession();
  const [pending, setPending] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      accessibilityState={{ disabled: pending, busy: pending }}
      disabled={pending}
      hitSlop={12}
      onPress={async () => {
        onError(null);
        setPending(true);
        try {
          // Progress is saved on the server; the step marker is per user and survives this.
          await signOut();
        } catch (cause) {
          captureError(cause, { source: 'onboarding-sign-out' });
          onError('Couldn’t sign out. Check your connection and try again.');
          setPending(false);
        }
      }}
      testID="onboarding-sign-out"
    >
      <AppText variant="small" color={pending ? 'textSecondary' : 'primary'}>
        Sign out
      </AppText>
    </Pressable>
  );
}

/**
 * Shared chrome for every onboarding step: header + segmented progress, animated content,
 * and a pinned footer with the primary action. Steps supply only their fields.
 *
 * Android hardware back follows the header: it goes to the previous step when there is one
 * (`onBack`), and keeps the platform default on the first step.
 */
export function OnboardingShell({
  step,
  title,
  subtitle,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  onBack,
  error,
  hideProgress,
  testID,
}: OnboardingShellProps) {
  const { reduceMotion, duration } = useMotionPreference();
  const entering = reduceMotion ? undefined : FadeInRight.duration(duration('standard'));
  const total = ONBOARDING_STEPS.length - 1; // "ready" is the celebration, not a progress step
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const onHardwareBack = useEffectEvent((): boolean => {
    if (typeof onBack !== 'function') return false;
    onBack();
    return true;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => onHardwareBack());
    return () => subscription.remove();
  }, []);
  const footerError = error ?? signOutError;

  return (
    <AppScreen
      keyboardAware
      testID={testID}
      contentStyle={styles.content}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScreenHeader onBack={onBack} right={<OnboardingSignOut onError={setSignOutError} />} />
      {hideProgress ? null : (
        <SegmentedProgress total={total} current={Math.min(stepIndex(step), total - 1)} />
      )}
      <Animated.ScrollView
        entering={entering}
        key={step}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heading}>
          <AppText variant="h2">{title}</AppText>
          {subtitle ? (
            <AppText variant="body" color="textSecondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {children}
      </Animated.ScrollView>
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(duration('standard'))}
        style={styles.footer}
      >
        {footerError ? (
          <InlineMessage
            tone="error"
            message={footerError}
            testID={testID ? `${testID}-error` : undefined}
          />
        ) : null}
        <AppButton
          label={primaryLabel}
          fullWidth
          onPress={onPrimary}
          disabled={primaryDisabled}
          loading={primaryLoading}
          testID={testID ? `${testID}-primary` : undefined}
        />
        {secondaryLabel && onSecondary ? (
          <AppButton
            label={secondaryLabel}
            variant="secondary"
            fullWidth
            onPress={onSecondary}
            disabled={primaryLoading}
            testID={testID ? `${testID}-secondary` : undefined}
          />
        ) : null}
      </Animated.View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingBottom: spacing.md, gap: spacing.sm },
  scroll: { flex: 1 },
  scrollContent: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
  heading: { gap: spacing.xs },
  footer: { gap: spacing.sm },
});
