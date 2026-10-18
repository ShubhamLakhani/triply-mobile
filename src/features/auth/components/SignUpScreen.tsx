import { Link, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { AppText } from '@/components/ui/AppText';
import { useAnalytics } from '@/services/analytics';
import { spacing } from '@/theme';

import { signUpWithPassword } from '../api/auth-api';
import { emailSchema } from '../schemas/auth.schema';
import { usePendingVerification } from '../state/pending-verification';

import { AuthHero } from './AuthHero';
import { CredentialsForm } from './CredentialsForm';

/** Sign-up step 1: email + password. Step 2 (the emailed 6-digit code) is VerifyEmailScreen. */
export function SignUpScreen() {
  const analytics = useAnalytics();
  const startVerification = usePendingVerification((state) => state.start);
  const pendingEmail = usePendingVerification((state) => state.email);

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
          Your email stays private. We’ll send you a 6-digit code to confirm it.
        </AppText>
      </View>
      <CredentialsForm
        mode="sign-up"
        initialEmail={pendingEmail ?? ''}
        onSubmit={async (values) => {
          const result = await signUpWithPassword(values);
          analytics.track('sign_up_completed', {
            method: 'password',
            needs_email_confirmation: result.needsEmailConfirmation,
          });
          if (result.needsEmailConfirmation) {
            startVerification(emailSchema.parse(values.email), Date.now());
            router.push('/verify-email');
          }
          // Without confirmation (not used by Triply) the session lands and the guard moves on.
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
});
