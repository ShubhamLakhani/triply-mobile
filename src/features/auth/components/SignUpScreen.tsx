import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { InlineMessage } from '@/components/ui/InlineMessage';
import { Surface } from '@/components/ui/Surface';
import { useMotionPreference } from '@/hooks/use-motion-preference';
import { useAnalytics } from '@/services/analytics';
import { spacing } from '@/theme';

import { resendSignUpEmail, signUpWithPassword } from '../api/auth-api';

import { AuthHero } from './AuthHero';
import { AuthLinkNotice } from './AuthLinkNotice';
import { authErrorMessage, CredentialsForm } from './CredentialsForm';

export function SignUpScreen() {
  const analytics = useAnalytics();
  const { reduceMotion, duration } = useMotionPreference();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendError, setResendError] = useState<string | null>(null);

  const resend = async () => {
    if (!pendingEmail) return;
    setResendState('sending');
    setResendError(null);
    try {
      await resendSignUpEmail(pendingEmail);
      setResendState('sent');
    } catch (cause) {
      setResendState('error');
      setResendError(authErrorMessage(cause));
    }
  };

  if (pendingEmail) {
    return (
      <AppScreen testID="check-email-screen" edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader onBack={() => setPendingEmail(null)} />
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(duration('standard'))}
          style={styles.checkEmail}
        >
          <AuthHero compact />
          <AuthLinkNotice />
          <AppText variant="h2">Check your inbox</AppText>
          <AppText variant="body" color="textSecondary">
            We sent a confirmation link to <AppText variant="bodyStrong">{pendingEmail}</AppText>.
            Open it on this phone and you’ll be signed in automatically.
          </AppText>
          <Surface tone="tinted">
            <AppText variant="small">Didn’t get it? Check spam, or resend in a moment.</AppText>
            <AppButton
              label={resendState === 'sent' ? 'Email sent again' : 'Resend email'}
              variant="secondary"
              loading={resendState === 'sending'}
              disabled={resendState === 'sent'}
              onPress={() => void resend()}
              testID="resend-email"
            />
            {resendError ? <InlineMessage tone="error" message={resendError} /> : null}
          </Surface>
          <Link href="/sign-in" replace accessibilityRole="link">
            <AppText variant="small" color="primary" style={styles.link}>
              Already confirmed? Sign in
            </AppText>
          </Link>
        </Animated.View>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      scroll
      keyboardAware
      testID="sign-up-screen"
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScreenHeader />
      <AuthHero compact />
      <View style={styles.heading}>
        <AppText variant="h2">Create your account</AppText>
        <AppText variant="body" color="textSecondary">
          Your email stays private. Next you’ll set up your profile.
        </AppText>
      </View>
      <CredentialsForm
        mode="sign-up"
        onSubmit={async (values) => {
          const result = await signUpWithPassword(values);
          analytics.track('sign_up_completed', {
            method: 'password',
            needs_email_confirmation: result.needsEmailConfirmation,
          });
          if (result.needsEmailConfirmation) setPendingEmail(values.email.trim().toLowerCase());
        }}
      />
      <View style={styles.footer}>
        <AppText variant="small" color="textSecondary">
          Have an account?{' '}
        </AppText>
        <Link href="/sign-in" replace accessibilityRole="link" testID="link-sign-in">
          <AppText variant="small" color="primary" style={styles.link}>
            Sign in
          </AppText>
        </Link>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs },
  footer: { flexDirection: 'row', alignItems: 'center' },
  link: { fontFamily: 'Inter_600SemiBold' },
  checkEmail: { gap: spacing.lg, paddingTop: spacing.md },
});
